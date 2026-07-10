/**
 * configVerification — verify-only counterpart of executeResetToDefaults.
 *
 * After a Himax firmware update on an empty SD card the firmware regenerates
 * /MANIFEST/CONFIG.TXT from its in-RAM operational parameters at the next DPD
 * entry, so the authoritative check is the OP vector itself (`getop -1`), not
 * the file: read every OP and report non-volatile values that differ from
 * FACTORY_DEFAULTS — without writing anything.
 *
 * See documentation/development reports/empty_sd_update_architecture.md §2.2.
 */

import { commandRegistry } from '../protocol/commandRegistry'
import { BleSession } from '../session/createBleSession'
import { FACTORY_DEFAULTS, OP_PARAMETER } from '../../hooks/useDeviceSettings'

export interface ConfigCheckResult {
    verified: boolean
    /** OP index → { expected, actual } for every non-volatile mismatch */
    mismatches: Record<number, { expected: number; actual: string }>
    /** Number of parameters actually compared (excludes volatile + absent) */
    checkedCount: number
}

/**
 * Run-time counters and state the firmware legitimately mutates, plus the
 * model bindings (set by deployment, not factory defaults) — excluded from
 * the comparison.
 */
const VOLATILE_OPS = new Set<number>([
    OP_PARAMETER.SEQUENCE_NUMBER,
    OP_PARAMETER.NUM_NN_ANALYSES,
    OP_PARAMETER.NUM_POSITIVE_NN_ANALYSES,
    OP_PARAMETER.NUM_COLD_BOOTS,
    OP_PARAMETER.NUM_WARM_BOOTS,
    OP_PARAMETER.IMAGES_COUNT,
    OP_PARAMETER.IMAGES_FILE_INDEX,
    OP_PARAMETER.AE_FLASH_STATE,
    OP_PARAMETER.MODEL_PROJECT,
    OP_PARAMETER.MODEL_VERSION,
])

export async function verifyConfigDefaults(session: BleSession): Promise<ConfigCheckResult> {
    const currentOps = await session.execute(commandRegistry.getops)
    const mismatches: ConfigCheckResult['mismatches'] = {}
    let checkedCount = 0

    for (const [indexStr, expected] of Object.entries(FACTORY_DEFAULTS)) {
        const index = Number(indexStr)
        if (VOLATILE_OPS.has(index)) continue
        // Older firmware exposes fewer OPs — absent indices are not mismatches
        if (index >= currentOps.length) continue
        checkedCount++
        const actual = currentOps[index]
        if (actual !== String(expected)) {
            mismatches[index] = { expected, actual }
        }
    }

    return { verified: Object.keys(mismatches).length === 0, mismatches, checkedCount }
}
