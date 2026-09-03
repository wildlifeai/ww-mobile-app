/**
 * The HM0360 AE register block the device sends after every capture and every
 * light check, and the one parser for it, shared by the Light Sensor screen
 * and Capture Picture.
 *
 *   HM0360 AE regs:
 *     Integration time = 284 lines
 *     Analog gain = 4
 *     Digital gain = 255
 *     AE Mean = 24
 *     AEConverged?: N
 */

export interface AEData {
    integration: string
    analogGain: string
    digitalGain: string
    aeMean: string
    aeConverged: string
}

export const EMPTY_AE: AEData = { integration: '', analogGain: '', digitalGain: '', aeMean: '', aeConverged: '' }

/**
 * Lift whichever AE register fields this line carries into a copy of `prev`.
 * Returns null when the line carried none, so callers can tell "nothing here"
 * from "same as before".
 *
 * The block is five lines on the wire. Whether they reach the app as five
 * events or one depends on how the relay framed them, so each field is matched
 * unanchored and a block is treated as complete when its last field,
 * `AEConverged`, has been seen.
 */
export const grabAeFields = (line: string, prev: AEData | null): AEData | null => {
    const next: AEData = { ...(prev ?? EMPTY_AE) }
    let updated = false
    const grab = (re: RegExp, key: keyof AEData) => {
        const m = line.match(re)
        if (m) { next[key] = m[1]; updated = true }
    }
    grab(/Integration time\s*=\s*(\d+)/i, 'integration')
    grab(/\bAnalog gain\s*=\s*(\d+)/i, 'analogGain')
    grab(/\bDigital gain\s*=\s*(\d+)/i, 'digitalGain')
    grab(/\bAE Mean\s*=\s*(\d+)/i, 'aeMean')
    grab(/AEConverged\?:\s*(Y|N)/i, 'aeConverged')
    return updated ? next : null
}
