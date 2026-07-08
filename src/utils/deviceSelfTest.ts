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
