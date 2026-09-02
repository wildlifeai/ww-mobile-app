/**
 * Parser for the firmware's `AE light check` telemetry line.
 *
 * The device sends this after every light check, triggered by `AI light`, by an
 * ordinary capture, or by the op24 timer wake, carrying its own day/night
 * verdict. The wording has changed with the algorithm and will change again, so
 * this parser is deliberately loose about everything except the verdict.
 *
 * Two wordings are in the field today. The mean-based algorithm:
 *
 *   AE light check: mean AE=77 (min 75, max 80, 16 frames) thr=65, AGain=0, conv=Y, gain railed = N -> BRIGHT
 *
 * and the gain-based one, which has no mean and no threshold at all:
 *
 *   AE light check: AGain = 3, conv=N -> DARK (change)
 *
 * Older firmware spelled the same fields out in full (`threshold = 65`,
 * `analog gain = 4`, `converged = no`, `gain railed = yes`, `(changed)`), and
 * bench logs from that period still parse.
 *
 * ## What the app does with it
 *
 * Nothing that matters. The measurement the app reports is built from the raw
 * `HM0360 AE regs` block, which every firmware sends after every capture and
 * every light check regardless of algorithm. This line is recorded beside it as
 * the device's opinion, so a bench run can compare what the firmware decided
 * against what the app's own rules would have decided from the same registers
 * (see `utils/lightSensorRules.ts`). A version of this parser that *required*
 * the mean and threshold turned the September 2026 firmware's rewording into a
 * 15 second timeout and a false hardware-fault alert.
 *
 * This is unsolicited telemetry, not a command response, which is why it lives
 * here rather than in commandRegistry.ts: nothing requested it and no command is
 * waiting on it.
 *
 * Firmware source: lightSensor.c, `decideDarkBrightGainBased()` and
 * `decideDarkBright()`, selected by `AE_DECISION_GAIN_BASED` at compile time.
 */

/** One parsed decision. Only the verdict is guaranteed. */
export interface LightCheck {
  /** true = DARK, false = BRIGHT. The one field every wording carries */
  dark: boolean
  /** Mean AE (0-255) over the sampled frames. Absent from the gain-based algorithm */
  meanAE: number | null
  /** op23 at the moment of the decision. Absent from the gain-based algorithm, which ignores it */
  threshold: number | null
  /** Spread across the samples; a wide spread means the AE loop was still hunting */
  minAE: number | null
  maxAE: number | null
  /** How many frames were averaged */
  frames: number | null
  /** Analog gain register, 0-7 */
  analogGain: number | null
  /** false in real darkness, because the sensor rails. A confidence signal, not an error */
  converged: boolean | null
  /** Both gains at their ceiling: the mean-based algorithm short-circuits to DARK on this */
  gainRailed: boolean | null
  /** Present only when this reading flipped the decision */
  changed: boolean
  /** The line as received, so a log row can be re-parsed if the format grows */
  raw: string
}

/**
 * Anchored on the `AE light check:` prefix *and* a `-> DARK|BRIGHT` verdict.
 * The prefix alone also appears in "Skipping NN processing (AE light check).",
 * which is printed during the capture phase and carries no reading; requiring the
 * verdict is what keeps that line out.
 *
 * The `[LS]` prefix is added by the firmware only for humans reading a serial log
 * and is not part of what arrives over BLE. Tolerated here so the same parser can
 * be pointed at a bench log.
 */
const DECISION_LINE = /^\s*(?:\[LS\]\s*)?AE light check:.*->\s*(DARK|BRIGHT)\b/i

const num = (line: string, re: RegExp): number | null => {
  const m = line.match(re)
  return m ? parseInt(m[1], 10) : null
}

/** yes/no from the older wording, Y/N from the current one. */
const bool = (line: string, re: RegExp): boolean | null => {
  const m = line.match(re)
  return m ? /^(yes|y)$/i.test(m[1]) : null
}

/**
 * Parse one line of device output. Returns null for anything that is not a
 * decision line, so callers can pass every incoming line straight through.
 *
 * Every field is matched by its own label rather than by position, and each
 * label pattern accepts both the spelled-out and the abbreviated form. An
 * unknown field is ignored; a missing field yields null.
 */
export const parseLightCheck = (line: string): LightCheck | null => {
  const verdict = line.match(DECISION_LINE)
  if (!verdict) return null

  return {
    dark: /^dark$/i.test(verdict[1]),
    meanAE: num(line, /mean AE\s*=\s*(\d+)/i),
    threshold: num(line, /\b(?:threshold|thr)\s*=\s*(\d+)/i),
    minAE: num(line, /\bmin\s+(\d+)/i),
    maxAE: num(line, /\bmax\s+(\d+)/i),
    frames: num(line, /(\d+)\s+frames/i),
    analogGain: num(line, /\b(?:analog gain|AGain)\s*=\s*(\d+)/i),
    converged: bool(line, /\b(?:converged|conv)\s*=\s*(yes|no|Y|N)\b/i),
    gainRailed: bool(line, /gain railed\s*=\s*(yes|no|Y|N)\b/i),
    changed: /\(changed?\)/i.test(line),
    raw: line.trim(),
  }
}

/**
 * One line for a log or a console row: the verdict plus whichever inputs this
 * wording carried. "DARK, gain 3, not converged" or "BRIGHT, mean 77 vs 65".
 *
 * `verdict: false` leaves the verdict out, for a caller that has already
 * printed it in its own style and only wants the reasons.
 */
export const summariseLightCheck = (check: LightCheck, opts: { verdict?: boolean } = {}): string => {
  const parts: string[] = opts.verdict === false ? [] : [check.dark ? 'DARK' : 'BRIGHT']
  if (check.meanAE !== null && check.threshold !== null) parts.push(`mean ${check.meanAE} vs ${check.threshold}`)
  else if (check.meanAE !== null) parts.push(`mean ${check.meanAE}`)
  if (check.analogGain !== null) parts.push(`gain ${check.analogGain}`)
  if (check.converged === false) parts.push('not converged')
  if (check.gainRailed) parts.push('gain railed')
  if (check.changed) parts.push('changed')
  return parts.join(', ') || 'no details sent'
}
