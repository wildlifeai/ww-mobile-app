import { BleSession } from '../session/createBleSession'
import { commandRegistry } from '../protocol/commandRegistry'
import { log, logWarn } from '../../utils/logger'
import { FACTORY_DEFAULTS, OP_PARAMETER } from '../../hooks/useDeviceSettings'

export interface ResetToDefaultsOptions {
    onProgress?: (step: string, progress: number) => void
    isCancelled?: () => boolean
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
    let currentOps: string[] | null = null
    try {
        currentOps = await session.execute(commandRegistry.getops)
        log(`[ResetDefaults] Current OPs: ${currentOps?.join(' ')}`)
    } catch (err) {
        logWarn('[ResetDefaults] Could not read current OPs, will write all defaults', err)
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

    // Step 3: Erase AI model if one is loaded
    if (hasModel) {
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
    onProgress?.('Clearing deployment ID...', 0.8)
    log('[ResetDefaults] Clearing deployment ID...')
    await session.execute(() => commandRegistry.setdid(null))

    if (isCancelled && isCancelled()) throw new Error('Reset cancelled')

    // Step 6: Zero GPS
    onProgress?.('Zeroing GPS...', 0.9)
    log('[ResetDefaults] Zeroing GPS...')
    await session.execute(() => commandRegistry.setgps('0,0,0'))

    onProgress?.('Reset complete', 1.0)
    log(`[ResetDefaults] Factory reset complete. ${opsWritten} OPs written.`)
}
