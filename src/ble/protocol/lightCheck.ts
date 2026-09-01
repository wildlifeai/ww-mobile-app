/**
 * Parser for the firmware's `AE light check` telemetry line.
 *
 * The device sends this after every light check — triggered by `AI light`, by an
 * ordinary capture, or by the op24 timer wake — carrying the day/night decision
 * together with every input that produced it:
 *
 *   AE light check: mean AE = 71 (min 71, max 71) over 16 frames, threshold = 65,
 *   analog gain = 4, converged = no, gain railed = yes -> DARK (flash wanted) (changed)
 *
 * This is unsolicited telemetry, not a command response, which is why it lives
 * here rather than in commandRegistry.ts: nothing requested it and no command is
 * waiting on it. `AI light` is acknowledged immediately with "Checking light
 * level..." and the reading arrives separately, afterwards.
 *
 * Firmware source: lightSensor.c `decideDarkBright()`.
 */

/** One parsed decision. Only mean, threshold and the verdict are guaranteed. */
export interface LightCheck {
  /** Mean AE (0-255) over the sampled frames — the value compared against the threshold */
  meanAE: number
  /** op23 at the moment of the decision, so the margin can be shown rather than just the verdict */
  threshold: number
  /** true = DARK (flash wanted), false = BRIGHT */
  dark: boolean
  /** Spread across the samples; a wide spread means the AE loop was still hunting */
  minAE: number | null
  maxAE: number | null
  /** How many frames were averaged */
  frames: number | null
  analogGain: number | null
  /** false in real darkness, because the sensor rails. A confidence signal, not an error */
  converged: boolean | null
  /** Both gains at their ceiling: short-circuits to DARK regardless of the mean */
  gainRailed: boolean | null
  /** Present only when this reading flipped the decision */
  changed: boolean
  /** The line as received, so a log row can be re-parsed if the format grows */
  raw: string
}

/**
 * Anchored on the full `AE light check: mean AE =` prefix, not on `AE light check`
 * alone. The shorter string also appears in "Skipping NN processing (AE light
 * check)." — console-only today, but matching the full prefix costs nothing and
 * removes the ambiguity permanently.
 *
 * The `[LS]` prefix is added by the firmware only for humans reading a serial log
 * and is not part of what arrives over BLE. Tolerated here so the same parser can
 * be pointed at a bench log.
 */
const DECISION_LINE = /^\s*(?:\[LS\]\s*)?AE light check:\s*mean AE\s*=/i

const num = (line: string, re: RegExp): number | null => {
  const m = line.match(re)
  return m ? parseInt(m[1], 10) : null
}

const bool = (line: string, re: RegExp): boolean | null => {
  const m = line.match(re)
  return m ? /^yes$/i.test(m[1]) : null
}

/**
 * Parse one line of device output. Returns null for anything that is not a
 * decision line, so callers can pass every incoming line straight through.
 *
 * Every field is matched by its own label rather than by position. Fields have
 * been added to this line as the light-sensor work progressed (`analog gain` and
 * `converged` are recent) and more are expected, so splitting on commas would
 * break on the next firmware change. An unknown field is ignored; a missing
 * optional field yields null.
 */
export const parseLightCheck = (line: string): LightCheck | null => {
  if (!DECISION_LINE.test(line)) return null

  const meanAE = num(line, /mean AE\s*=\s*(\d+)/i)
  const threshold = num(line, /threshold\s*=\s*(\d+)/i)
  const verdict = line.match(/->\s*(DARK|BRIGHT)/i)

  // The three fields that carry the decision itself. Without any one of them the
  // line cannot be interpreted, and a partial reading is worse than none — it
  // would be logged and charted as though it were real.
  if (meanAE === null || threshold === null || !verdict) return null

  return {
    meanAE,
    threshold,
    dark: /^dark$/i.test(verdict[1]),
    minAE: num(line, /\bmin\s+(\d+)/i),
    maxAE: num(line, /\bmax\s+(\d+)/i),
    frames: num(line, /over\s+(\d+)\s+frames/i),
    analogGain: num(line, /analog gain\s*=\s*(\d+)/i),
    converged: bool(line, /converged\s*=\s*(yes|no)/i),
    gainRailed: bool(line, /gain railed\s*=\s*(yes|no)/i),
    changed: /\(changed\)/i.test(line),
    raw: line.trim(),
  }
}

/**
 * How far the reading sat from the threshold. Positive means brighter than the
 * threshold, negative means darker.
 *
 * Note this can disagree with `dark`: a railed sensor is forced to DARK whatever
 * the mean says, which is exactly the case the UI needs to be able to explain.
 */
export const lightMargin = (check: LightCheck): number => check.meanAE - check.threshold
