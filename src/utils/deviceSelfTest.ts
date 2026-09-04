/**
 * Decoder for the WW500 self-test bitmask ("selftest" BLE command,
 * response "Error bits = 0xNNNN").
 *
 * The bit assignments MUST mirror the firmware's selfTest.h
 * (Seeed_Grove_Vision_AI_Module_V2 → ww500_md/selfTest.h):
 * bits 0-7 are BLE-processor errors, bits 8-15 are AI-processor errors.
 */

export enum SelfTestBit {
    // BLE processor (bits 0-7)
    LOW_BATTERY = 0,
    AI_PROC_NOT_RESPONDING = 1,
    LORAWAN_ERROR = 2,
    WATCHDOG_RESET = 3,
    BROWNOUT_RESET = 4,
    // AI processor (bits 8-15)
    AI_NO_MAIN_CAMERA = 8,
    AI_NO_HM0360 = 9,
    AI_NO_FLASH = 10,
    AI_NO_SD_CARD = 11,
    AI_PDM_ERROR = 12,
    AI_NN_ERROR = 13,
}

export interface SelfTestIssue {
    bit: SelfTestBit
    severity: 'error' | 'warning'
    title: string
    hint: string
}

const ISSUE_TABLE: Array<Omit<SelfTestIssue, never>> = [
    {
        bit: SelfTestBit.LOW_BATTERY,
        severity: 'warning',
        title: '🔋 Battery low',
        hint: 'Replace the batteries before deploying.',
    },
    {
        bit: SelfTestBit.AI_PROC_NOT_RESPONDING,
        severity: 'error',
        title: '⚠️ AI processor not responding',
        hint: 'The camera processor did not answer. Power-cycle the device; if it persists, reflash the firmware.',
    },
    {
        bit: SelfTestBit.LORAWAN_ERROR,
        severity: 'warning',
        title: '📡 LoRaWAN error',
        hint: 'The device could not join or use the LoRaWAN network.',
    },
    {
        bit: SelfTestBit.WATCHDOG_RESET,
        severity: 'warning',
        title: '🐶 Recovered from a watchdog reset',
        hint: 'The device restarted itself after a hang. Worth noting if it happens repeatedly.',
    },
    {
        bit: SelfTestBit.BROWNOUT_RESET,
        severity: 'warning',
        title: '⚡ Recovered from a power brownout',
        hint: 'The supply voltage dipped. Check the batteries and connections.',
    },
    {
        bit: SelfTestBit.AI_NO_MAIN_CAMERA,
        severity: 'error',
        title: '📷 Main camera not responding',
        hint: 'The active camera did not initialise — check its ribbon cable. Captures will fail until fixed.',
    },
    {
        bit: SelfTestBit.AI_NO_HM0360,
        severity: 'error',
        title: '🌙 Night-IR sensor (HM0360) not responding',
        hint: 'Check the HM0360 cable. Motion detection, the day/night light sensor and night captures will not work without it.',
    },
    {
        bit: SelfTestBit.AI_NO_FLASH,
        severity: 'warning',
        title: '💡 LED flash circuit fault',
        hint: 'The flash/IR illumination driver did not respond — night images will be dark.',
    },
    {
        bit: SelfTestBit.AI_NO_SD_CARD,
        severity: 'error',
        title: '💾 SD card missing',
        hint: 'Insert a FAT32 SD card — the device cannot store images or settings without it.',
    },
    {
        bit: SelfTestBit.AI_PDM_ERROR,
        severity: 'warning',
        title: '🎤 Microphone fault',
        hint: 'The PDM microphone failed its self-test.',
    },
    {
        bit: SelfTestBit.AI_NN_ERROR,
        severity: 'warning',
        title: '🧠 Neural network error',
        hint: 'The on-device AI model failed to load — species detection is off. Re-run "Prepare SD Card" or transfer a model.',
    },
]

/** Extract the numeric bitmask from the "Error bits = 0xNNNN" response (or a bare hex string). */
export function parseSelfTestBits(raw: string | null | undefined): number | null {
    if (!raw) return null
    const m = String(raw).match(/0x([0-9a-fA-F]+)/)
    if (!m) return null
    const v = parseInt(m[1], 16)
    return isNaN(v) ? null : v
}

/** Decode a bitmask into the list of active issues (empty = all healthy). */
export function decodeSelfTest(bits: number): SelfTestIssue[] {
    return ISSUE_TABLE.filter(issue => (bits & (1 << issue.bit)) !== 0)
}

/**
 * The exact line the device sends, both as the reply to `selftest` and, unasked,
 * after every wake. Anchored on the label: `parseSelfTestBits` alone matches any
 * `0x` in any string, and plenty of device chatter carries hex
 * (`Wakeup_event = 0x0000`, `Image Event Start Capture (0x0a01)`).
 */
export const ERROR_BITS_LINE = /^\s*Error bits\s*=\s*0x[0-9a-fA-F]+/i

/** The AI processor's half of the mask. */
export const AI_BITS_MASK = 0xff00

/**
 * The BLE processor presets every AI bit at boot and clears them only once the
 * Himax reports for itself. A reading with the whole AI range set is that preset,
 * not five simultaneous hardware failures. Bits 8 and 9 are exactly what the
 * camera checks need, so the range cannot simply be masked; the pattern is
 * rejected instead.
 */
export const isBootPreset = (bits: number) => (bits & AI_BITS_MASK) === AI_BITS_MASK

/** Every bit the app knows how to name. Anything outside it is reported as unknown. */
export const KNOWN_BITS_MASK = ISSUE_TABLE.reduce((mask, issue) => mask | (1 << issue.bit), 0)

/**
 * The AI-side faults that make a deployment pointless: no main camera, no
 * motion sensor, or no working model. The pre-deployment checks block Start
 * Monitoring on these.
 */
export const CRITICAL_AI_MASK =
    (1 << SelfTestBit.AI_NO_MAIN_CAMERA) |
    (1 << SelfTestBit.AI_NO_HM0360) |
    (1 << SelfTestBit.AI_NN_ERROR)

/**
 * Warning strings for the initialisation banners, one per set bit, in bit order,
 * plus one for any bit outside the known set. The wording is what
 * `useBleInitialization` and `useDevicePreDeploymentChecks` have shown since the
 * first release; both used to carry their own copy of the table.
 */
const WARNING_TEXT: Record<SelfTestBit, string> = {
    [SelfTestBit.LOW_BATTERY]: 'Low Battery detected (Bit 0)',
    [SelfTestBit.AI_PROC_NOT_RESPONDING]: 'AI Processor not responding (Bit 1)',
    [SelfTestBit.LORAWAN_ERROR]: 'LoRaWAN Error (Bit 2)',
    [SelfTestBit.WATCHDOG_RESET]: 'Watchdog Reset occurred (Bit 3)',
    [SelfTestBit.BROWNOUT_RESET]: 'Brownout Reset occurred (Bit 4)',
    [SelfTestBit.AI_NO_MAIN_CAMERA]: 'Main Camera Error (Bit 8)',
    [SelfTestBit.AI_NO_HM0360]: 'Motion Detector Camera Error (Bit 9)',
    [SelfTestBit.AI_NO_FLASH]: 'LED Flash Circuit Failure (Bit 10)',
    [SelfTestBit.AI_NO_SD_CARD]: 'Device has no SD card detected (Bit 11)',
    [SelfTestBit.AI_PDM_ERROR]: 'PDM Microphone Failure (Bit 12)',
    [SelfTestBit.AI_NN_ERROR]: 'Neural Network Error (Bit 13)',
}

export function selfTestWarnings(bits: number): string[] {
    if (bits === 0) return []
    const warnings = ISSUE_TABLE
        .filter(issue => (bits & (1 << issue.bit)) !== 0)
        .map(issue => WARNING_TEXT[issue.bit])
    if ((bits & ~KNOWN_BITS_MASK) !== 0) {
        warnings.push(`Unknown hardware issue (Code: ${formatSelfTestBits(bits)})`)
    }
    return warnings
}

/** `0x0A00` style, the way the device prints it. */
export const formatSelfTestBits = (bits: number) =>
    '0x' + bits.toString(16).toUpperCase().padStart(4, '0')
