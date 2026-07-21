import { BleSession } from '../session/createBleSession'
import { commandRegistry } from '../protocol/commandRegistry'
import { log, logWarn } from '../../utils/logger'
import { FACTORY_DEFAULTS, OP_PARAMETER } from '../../hooks/useDeviceSettings'

export interface ResetToDefaultsOptions {
    onProgress?: (step: string, progress: number) => void
    isCancelled?: () => boolean
    currentOps?: string[] | null
    skipIdentityReset?: boolean
    /**
     * Keep the loaded AI model: skip erasemodel AND leave op14/op15
     * (MODEL_PROJECT/MODEL_VERSION) untouched. Deployment flows must set
     * this - syncAiModel is the model authority there, and the old
     * behaviour erased the freshly-synced model AFTER the sync step
     * (pipeline order: syncAiModel -> ... -> resetOps), so every model
     * deployment started modelless: MD wakes fired but the NN never ran.
     */
    preserveModel?: boolean
}

/**
 * Full factory reset: reads current OPs, writes only those that differ
 * from FACTORY_DEFAULTS, erases any loaded AI model, clears the
 * deployment ID, and zeroes GPS.
 *
 * Each setop/setgps command receives a confirmation response from the
 * firmware, so no verification pass is needed.
 */
export async function executeResetToDefaults(
    session: BleSession,
    options?: ResetToDefaultsOptions
): Promise<void> {
    const { onProgress, isCancelled } = options || {}

    // Step 1: Read current OPs (this also wakes the device from DPD)
    onProgress?.('Reading current parameters...', 0.1)
    log('[ResetDefaults] Reading current operational parameters...')
    let currentOps: string[] | null = options?.currentOps !== undefined ? options.currentOps : null
    if (options?.currentOps === undefined) {
        try {
            currentOps = await session.execute(commandRegistry.getops)
            log(`[ResetDefaults] Current OPs: ${currentOps?.join(' ')}`)
        } catch (err) {
            logWarn('[ResetDefaults] Could not read current OPs, will write all defaults', err)
        }
    } else {
        log(`[ResetDefaults] Using provided current OPs: ${currentOps?.join(' ')}`)
    }

    if (isCancelled && isCancelled()) throw new Error('Reset cancelled')

    // Step 2: Diff against FACTORY_DEFAULTS — only write what differs
    const opsToWrite: { index: number; value: number }[] = []
    for (const [indexStr, defaultValue] of Object.entries(FACTORY_DEFAULTS)) {
        const index = parseInt(indexStr, 10)

        // 1) Do not reset sequence number if it is higher than 0
        if (index === OP_PARAMETER.SEQUENCE_NUMBER && currentOps && currentOps.length > index) {
            if (parseInt(currentOps[index], 10) > 0) continue
        }

        // 1a) Device capability gate: never write an op the connected firmware
        // does not report. Pre-camera-stack firmware has a 23-entry table where
        // indices 21/22 mean FLASH_LED_START_TIME/DURATION - writing the newer
        // MD-flash defaults there would silently program wrong behaviour
        // (writes beyond the table merely bounce off the firmware bounds check,
        // but 21/22 exist with different semantics).
        if (currentOps && currentOps.length > 0) {
            if (index >= currentOps.length) continue
            if (currentOps.length <= 23 &&
                (index === OP_PARAMETER.MD_FLASH_LED ||
                 index === OP_PARAMETER.MD_FLASH_BRIGHTNESS_PERCENT)) {
                continue
            }
        }

        // 1b) Preserve the model binding when the caller owns model state
        if (options?.preserveModel &&
            (index === OP_PARAMETER.MODEL_PROJECT || index === OP_PARAMETER.MODEL_VERSION)) {
            continue
        }

        // 2) Do not reset tracking parameters and counters
        if (
            index === OP_PARAMETER.NUM_NN_ANALYSES ||
            index === OP_PARAMETER.NUM_POSITIVE_NN_ANALYSES ||
            index === OP_PARAMETER.NUM_COLD_BOOTS ||
            index === OP_PARAMETER.NUM_WARM_BOOTS ||
            index === OP_PARAMETER.NUM_PICTURES ||
            index === OP_PARAMETER.IMAGES_COUNT ||
            index === OP_PARAMETER.IMAGES_FILE_INDEX
        ) {
            continue
        }

        if (currentOps && currentOps.length > index && currentOps[index] === defaultValue.toString()) continue
        opsToWrite.push({ index, value: defaultValue })
    }

    // Check if model needs erasing
    const hasModel = !currentOps ||
        (currentOps.length > OP_PARAMETER.MODEL_PROJECT && currentOps[OP_PARAMETER.MODEL_PROJECT] !== '0') ||
        (currentOps.length > OP_PARAMETER.MODEL_VERSION && currentOps[OP_PARAMETER.MODEL_VERSION] !== '0')

    log(`[ResetDefaults] ${opsToWrite.length} OPs need writing, model loaded: ${hasModel}`)

    // Step 3: Erase AI model if one is loaded (never in deployment flows -
    // erasing here destroyed the flash cache the sync step had just ensured)
    if (hasModel && !options?.preserveModel) {
        onProgress?.('Erasing AI model...', 0.2)
        log('[ResetDefaults] Erasing AI model...')
        try {
            await session.execute(() => commandRegistry.erasemodel())
            log('[ResetDefaults] AI model erased')
        } catch (err) {
            logWarn('[ResetDefaults] erasemodel failed (may not have a model loaded):', err)
        }
    }

    if (isCancelled && isCancelled()) throw new Error('Reset cancelled')

    // Step 4: Write OPs that differ from defaults
    let opsWritten = 0
    for (const { index, value } of opsToWrite) {
        if (isCancelled && isCancelled()) {
            throw new Error('Reset cancelled')
        }

        log(`[ResetDefaults] Setting OP ${index} = ${value}`)
        await session.execute(() => commandRegistry.setop({ index, value }))
        opsWritten++

        // Progress: 0.3 to 0.7 across all OP writes
        const progress = opsToWrite.length > 0
            ? 0.3 + (opsWritten / opsToWrite.length) * 0.4
            : 0.7
        onProgress?.(`Resetting parameter ${index}...`, progress)
    }

    // Step 5: Clear deployment ID
    if (!options?.skipIdentityReset) {
        onProgress?.('Clearing deployment ID...', 0.8)
        log('[ResetDefaults] Clearing deployment ID...')
        await session.execute(() => commandRegistry.setdid(null))
    } else {
        log('[ResetDefaults] Skipping clearing deployment ID (skipIdentityReset = true)')
    }

    if (isCancelled && isCancelled()) throw new Error('Reset cancelled')

    // Step 6: Zero GPS
    if (!options?.skipIdentityReset) {
        onProgress?.('Zeroing GPS...', 0.9)
        log('[ResetDefaults] Zeroing GPS...')
        await session.execute(() => commandRegistry.setgps('0,0,0'))
    } else {
        log('[ResetDefaults] Skipping zeroing GPS (skipIdentityReset = true)')
    }

    onProgress?.('Reset complete', 1.0)
    log(`[ResetDefaults] Factory reset complete. ${opsWritten} OPs written.`)
}
