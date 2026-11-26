/**
 * The device's lines in words for the Live Deployment Monitor: UI presentation only.
 * Device replies are matched in commandRegistry.ts, never here.
 */

import { parseLightCheck, summariseLightCheck } from './protocol/lightCheck'
import { BLE_PROTOCOL_TIMINGS } from './protocol/protocolConstants'
import { CAPTURE_FAILED_LINE } from './protocol/commandRegistry'
import { parseSelfTestBits, PROVISIONAL_BIT } from '../utils/deviceSelfTest'

export type MonitorCategory = 'motion' | 'timelapse' | 'capture' | 'capture_failed' | 'nn_positive' | 'nn_negative' | 'sleep' | 'wake' | 'selftest_ok' | 'selftest_warn' | 'info'

export interface MonitorEvent {
  category: MonitorCategory
  label: string
  icon: string
  details?: string
  /** Counted in the stats bar but not listed in the activity log. */
  isHidden?: boolean
  /** Listed in the activity log but not counted: the same event is already
   *  counted by another line the device sends for it. */
  skipStats?: boolean
}

/**
 * Classify raw BLE messages for the Live Deployment Monitor view.
 * Returns null if the message should not be displayed in the monitor log.
 */
export function classifyForMonitor(rawMessage: string): MonitorEvent | null {
  const content = rawMessage.replace(/\0/g, '').trim()

  // --- WAKE & MOTION EVENTS ---
  // One motion wake reaches the app as up to four lines: "Wake (MD)", the NN
  // verdict, "HM0360 motion in N blocks:" and "Captured ...". The wake line is
  // the event: it is counted and it is the one row listed. Listing the blocks
  // line as well showed "Motion detected" twice per wake (bench, 5 Sep 2026),
  // and listing it instead left the log empty: with one picture per trigger
  // the HM0360 reports 0 blocks on every wake, because the first frame has no
  // reference, so no wake was ever listed (bench, 29 Sep 2026).
  //
  // The wake is `Wake (Motion)` from BLE firmware with ww-hardware #60 and
  // `Wake (MD)` before it; both stay while cameras run either (#412). `MD`
  // alone counts only before `...` or a time: that firmware also passes on
  // `MD sensitivity set to N`, the reply to `md`, which is not motion.
  if (/^Wake\s*\((MD|Motion)\)/i.test(content)) return { category: 'motion', label: 'Motion detected', icon: 'run', details: content }
  if (/^MD(\.\.\.|\s+\d)/i.test(content)) return { category: 'motion', label: 'Motion detected', icon: 'run', details: content }

  // Himax WW500 hardware outputs block counts dynamically
  const motionMatch = content.match(/^HM0360 motion in (\d+) blocks:/i)
  if (motionMatch) {
    const blocks = parseInt(motionMatch[1], 10)
    if (blocks > 0) {
      return { category: 'motion', label: `Motion detected (${blocks} blocks)`, icon: 'run', details: content, skipStats: true, isHidden: true }
    } else {
      return null // Safely ignore 0 block updates to prevent UI noise
    }
  }

  // --- TIMELAPSE EVENTS ---
  if (/^Timer\s/i.test(content) || /^Wake\s*\(Timer\)/i.test(content)) return { category: 'timelapse', label: 'Timelapse triggered', icon: 'timer-sand', details: content }



  // --- CAPTURE EVENTS ---
  // A capture the camera abandoned, motion and timelapse ones included, from
  // the firmware of Seeed PR #275; shown, not hidden, since nothing else on
  // the monitor says a photo was lost (#476)
  if (CAPTURE_FAILED_LINE.test(content)) return { category: 'capture_failed', label: 'Photo failed', icon: 'camera-off', details: content }

  const captureMatch = content.match(/^Captured\s+(\d+)\s+images/i)
  if (captureMatch) {
    const fileMatch = content.match(/Last is\s+(.+)$/i)
    // Hidden because it clutters the UI (stats bar tracks photo count)
    return { category: 'capture', label: `Captured ${captureMatch[1]} photos`, icon: 'camera', details: fileMatch ? fileMatch[1] : undefined, isHidden: true }
  }

  // --- NEURAL NETWORK EVENTS ---
  if (/^NN\+/i.test(content)) return { category: 'nn_positive', label: 'Target species detected!', icon: 'target-account' }
  if (/^NN-/i.test(content)) return { category: 'nn_negative', label: 'Photo taken — no target detected', icon: 'image-outline' }

  // --- HEARTBEAT EVENT ---
  // The reply to the app's keep-alive, which only goes out after
  // HEARTBEAT_IDLE_MS with nothing received, motion lines included.
  if (/^heartbeat is\s/i.test(content)) return { category: 'selftest_ok', label: `No motion in the last ${BLE_PROTOCOL_TIMINGS.HEARTBEAT_IDLE_MS / 1000} seconds`, icon: 'check-circle' }

  // --- SELF-TEST EVENTS ---
  // Bit 15 alone (0x8000) is the reading a warm wake sends before the SD card
  // is mounted, with the final one close behind (Seeed issue #290), so it is
  // as quiet as 0x0000. Anything else set is a warning.
  if (/^Error bits = 0x/i.test(content)) {
    const bits = parseSelfTestBits(content)
    // eslint-disable-next-line no-bitwise
    if (bits === null || (bits & ~PROVISIONAL_BIT) !== 0) return { category: 'selftest_warn', label: 'Self-test warning', icon: 'alert', details: content }
    return null
  }

  // --- LIGHT SENSOR DECISION ---
  // The day/night verdict, sent after every light check: one per capture and one
  // per periodic re-check (every 15 minutes by default). It explains a camera
  // switch or an armed flash, but at that rate it crowded the motion rows out of
  // the monitor (bench, 5 Sep 2026), so it is classified and kept off the log.
  // The Light Sensor screen shows the same verdicts with their inputs. Raw AE
  // registers stay filtered below.
  const lightCheck = parseLightCheck(content)
  if (lightCheck) {
    return {
      category: 'info',
      label: `Light check: ${summariseLightCheck(lightCheck)}`,
      icon: lightCheck.dark ? 'weather-night' : 'white-balance-sunny',
      details: content,
      isHidden: true,
    }
  }

  // --- FILTER OUT KNOWN NOISE ---
  const ignoredPatterns = [
    /^Retrying transmission/i, /^RTC set to/i, /^UTC is:/i, /^System time set successfully/i, /^Device GPS set/i, /^Location is:/i,
    /^AI processor is in DPD/i, /^AI processor not responding/i, /^Disconnecting/i, /^Failed to join/i,
    /^Sleep/i, /^(Wake|Waking AI processor|AI processor is awake)/i, /^Error bits = 0x0000/i,
    // Command echoes
    /^setutc\s/i, /^AI setop\s/i, /^AI getop/i, /^setgps\s/i, /^AI info/i, /^ver/i, /^battery/i, /^get heartbeat/i, /^flash[rgb]\s/i, /^selftest/i, /^status/i, /^getutc/i,
    // OpParam responses (already shown in stats header)
    /^Op(?:Param)?(?:\s+|\[)\d+\]?\s*=/i, /^Set\s+OpParam/i,
    // Debug & Matrix Noise
    /^HM0360 AE regs:/i, /^Integration time/i, /^Analog gain/i, /^Digital gain/i, /^AE Mean/i, /^AEConverged/i,
    // Catches pure hex matrices, often dumped out over device UART during motion scan checks
    /^([0-9a-fA-F]{2}\s*)+$/i
  ]

  for (const pattern of ignoredPatterns) {
    if (pattern.test(content)) return null
  }

  // Pass-through everything else as an info message so we can debug unknown lines
  return { category: 'info', label: 'Device says:', icon: 'information', details: content }
}
