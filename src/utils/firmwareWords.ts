import type { FirmwareTarget, UpdatePhase } from '../screens/Devices/hooks/useFirmwareUpdate'

/**
 * Words for the firmware screens an operator sees (#344): a version as a build
 * date or a release number, one line for what an update will do, one line for
 * where it is, and one for how it ended. File names, CRCs and raw build
 * strings stay in the Engineer Console's view and the logs.
 */

/**
 * "30 Sep build" for an AI firmware string such as "WW500_C02 20:26:50 Sep 30 2026"
 * ("30 Sep 20:26 build" with the time), "0.30.52" for a BLE version such as
 * "00.30.52", otherwise the string as given.
 */
export const friendlyVersion = (version?: string | null, withTime = false): string => {
    if (!version) return ''
    const build = version.match(/(\d{2}):(\d{2}):\d{2}\s+([A-Za-z]{3})\s+(\d{1,2})\s+\d{4}/)
    if (build) return withTime ? `${build[4]} ${build[3]} ${build[1]}:${build[2]} build` : `${build[4]} ${build[3]} build`
    const release = version.match(/(\d+)\.(\d+)\.(\d+)/)
    if (release) return release.slice(1).map(n => String(Number(n))).join('.')
    return version.trim()
}

/** "the 30 Sep build" in a sentence; a release number stays bare */
const inSentence = (version: string): string => version.endsWith(' build') ? `the ${version}` : version

/** The one line before an update: where the camera is, and where the update takes it. */
export const updateSummary = (current?: string | null, latest?: string | null, upToDate = false): string => {
    // Two builds of the same day differ only by the time (Dev took two on
    // 1 October 2026, minutes apart), so then both carry it
    const sameDay = !upToDate && !!current && !!latest && current.trim() !== latest.trim()
        && friendlyVersion(current) === friendlyVersion(latest)
    const from = friendlyVersion(current, sameDay)
    const to = friendlyVersion(latest, sameDay)
    if (upToDate) return to ? `Up to date: ${to}.` : 'Up to date.'
    if (from && from !== 'Unknown' && to) return `Update from ${inSentence(from)} to ${inSentence(to)}.`
    if (to) return `Update to ${inSentence(to)}.`
    return 'Update to the latest firmware.'
}

/** One status line while an update runs. */
export const updateStep = (
    target: FirmwareTarget,
    phase: UpdatePhase,
    pair?: { total: number; done: number } | null,
): string => {
    const image = target === 'himax' && pair && pair.total > 1
        ? ` image ${Math.min(pair.done + 1, pair.total)} of ${pair.total}`
        : ''
    switch (phase) {
        // Between the two images the hook checks the camera again while it
        // boots the first new image: to the operator, that is the restart
        case 'preflight': return pair && pair.done > 0 ? 'Restarting the camera' : 'Checking the camera'
        case 'downloading': return `Downloading${image}`
        case 'entering_dfu':
        case 'scanning': return 'Preparing the camera'
        case 'transferring':
        case 'sending': return `Sending${image} to the camera`
        case 'waking':
        case 'flashing': return target === 'himax'
            ? `Installing${image}, which takes a few minutes`
            : 'Installing'
        case 'rebooting':
        case 'reconnecting':
        case 'verifying': return 'Restarting the camera'
        case 'complete': return 'Done'
        case 'failed': return 'Update failed'
        default: return ''
    }
}

/** The one result line once an update has finished. */
export const updateResult = (newVersion?: string | null): string =>
    newVersion
        ? `Updated to ${inSentence(friendlyVersion(newVersion))}.`
        : 'Update sent. The camera finishes it the next time it restarts.'

/**
 * The small line under the log while an image goes to the camera:
 * "212 of 476 KB, 7.9 KB/s, about 30 s left"
 */
export const transferLine = (bytesSent: number, totalBytes: number, elapsedMs: number, remainingMs: number): string => {
    const kb = (bytes: number) => Math.round(bytes / 1024)
    const parts = [`${kb(bytesSent)} of ${kb(totalBytes)} KB`]
    if (elapsedMs > 0 && bytesSent > 0) parts.push(`${((bytesSent / elapsedMs) * 1000 / 1024).toFixed(1)} KB/s`)
    if (remainingMs > 0) {
        const seconds = Math.ceil(remainingMs / 1000)
        parts.push(seconds < 60 ? `about ${seconds} s left` : `about ${Math.ceil(seconds / 60)} min left`)
    }
    return parts.join(', ')
}
