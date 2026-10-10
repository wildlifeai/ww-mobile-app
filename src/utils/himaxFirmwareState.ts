import { CameraVariant, parseVariant } from './cameraVariant'

/**
 * Where a camera's AI firmware stands, for Firmware Status, the update screen
 * and Start Monitoring, and which images an update still has to write (#374).
 *
 * A pair update writes the other camera's image first and the running
 * camera's last, and the camera starts a written image at its next boot of
 * any kind, a wake from sleep included. An update cut short between the two
 * leaves the camera on the other camera, with the other slot on an older
 * build, and nothing on the camera says so: `AI ver` names the running build
 * only, and `AI slots` labels name a camera, not a build. So the phone that
 * ran the update keeps a record of it (`services/himaxUpdateRecord.ts`), and
 * this weighs the record against what the camera says.
 */

/** A camera with a build of its own */
export type HimaxVariant = Exclude<CameraVariant, 'unknown'>

/** The `AI slots` reply, as `commandRegistry.slots` parses it */
export interface SlotsReply {
    /** The slot the bootloader starts next (the selector), not always the one running */
    activeSlot: number
    /** The camera the running image is built for */
    running: string
    /** Each slot's camera, labelled at its image's first cold boot; `unknown` until then */
    slotA: string
    slotB: string
}

/** What the comparisons need from a firmware row */
interface BuildLike {
    version?: string | null
}

interface LatestBuilds<T extends BuildLike> {
    RP3: T | null
    HM0360: T | null
    /** The newest row of any camera, for a catalogue without camera labels */
    any?: T | null
}

/**
 * This phone's record of a pair update it ran on a device, saved to disk so it
 * survives a dropped link, a killed app or a flat phone. Only that phone has
 * it: another phone sees the camera alone.
 */
export interface HimaxUpdateRecord {
    startedAt: string
    /** The camera the update ends on: the one running when it started */
    endVariant: HimaxVariant
    /** `AI slots`' selector and `AI ver` before the first write, to tell a camera nothing reached */
    startActiveSlot: number | null
    startVersion: string | null
    /** The pair in the order it is written, the end camera's image last */
    images: Array<{ variant: HimaxVariant; version: string; filename: string }>
    /** Images whose `AI firmware` went out, saved before each one is sent: a write whose reply is lost may still have landed */
    sent: number
    /** Images the camera answered `Firmware update OK` for */
    flashed: number
}

/**
 * What became of a record: `pending` while the update is unfinished,
 * `finished` once the camera runs the end camera's new image, `stale` when
 * nothing reached the camera. The caller drops a finished or stale record.
 */
type RecordStatus = 'pending' | 'finished' | 'stale' | null

type HimaxStatus<T> =
    | { state: 'unknown' }
    | { state: 'up_to_date' }
    | { state: 'outdated' }
    /** The catalogue has one camera's build and the camera is not on it: the update installs both, so it waits (#437) */
    | { state: 'missing_variant'; missingVariant: HimaxVariant }
    /** An update stopped part way: `plan` is what finishing it writes */
    | { state: 'unfinished'; endVariant: HimaxVariant; done: number; total: number; plan: T[] }

const trim = (version?: string | null): string | null => version?.trim() || null

/**
 * True when the camera runs the image in the slot its selector names, which
 * the next `AI firmware` relies on: `firmware` writes the slot opposite the
 * selector, so straight after a write, before the camera restarts, a second
 * one lands on the slot it is running from. The selected slot's label says so
 * when the image there has cold-booted; `firmware` resets it to `unknown`, and
 * then the other slot's label still naming the running camera means the
 * camera has not restarted. Both labels unknown cannot be told apart.
 */
export const isRunningFromSelectedSlot = (slots: SlotsReply): boolean => {
    const running = parseVariant(slots.running)
    if (running === 'unknown') return true
    const selected = parseVariant(slots.activeSlot === 1 ? slots.slotB : slots.slotA)
    const other = parseVariant(slots.activeSlot === 1 ? slots.slotA : slots.slotB)
    if (selected !== 'unknown') return selected === running
    return other !== running
}

/**
 * The images an update ending on `endVariant` writes: the other camera's
 * latest, then the end camera's. The first is dropped when the camera already
 * runs it, the state an update cut short after image 1 leaves, so finishing
 * that writes one image.
 */
export const planPair = <T extends BuildLike>(
    endVariant: HimaxVariant,
    slots: SlotsReply | null,
    current: string | null,
    latest: LatestBuilds<T>,
): T[] => {
    const otherVariant: HimaxVariant = endVariant === 'RP3' ? 'HM0360' : 'RP3'
    const first = latest[otherVariant]
    const last = latest[endVariant]
    const onFirst = !!first && !!slots && parseVariant(slots.running) === otherVariant
        && isRunningFromSelectedSlot(slots) && !!trim(current) && trim(current) === trim(first.version)
    return (onFirst ? [last] : [first, last]).filter((build): build is T => !!build)
}

const recordStatus = <T extends BuildLike>(
    record: HimaxUpdateRecord,
    current: string | null,
    slots: SlotsReply | null,
    latest: LatestBuilds<T>,
): RecordStatus => {
    if (record.sent <= 0) return 'stale'
    if (!current) return 'pending'
    // The end camera's build as the update wrote it, or a newer one installed since
    const endBuilds = [record.images[record.images.length - 1]?.version, latest[record.endVariant]?.version].map(trim)
    const allSent = record.sent >= record.images.length
    // Without `slots` (Start Monitoring's check sends nothing, #268) only
    // `AI ver` can tell, and it names the end camera's new build only once
    // the update has finished
    if (!slots) return allSent && endBuilds.includes(current) ? 'finished' : 'pending'
    if (slots.activeSlot === record.startActiveSlot && current === trim(record.startVersion)) return 'stale'
    const finished = allSent && parseVariant(slots.running) === record.endVariant
        && endBuilds.includes(current) && isRunningFromSelectedSlot(slots)
    return finished ? 'finished' : 'pending'
}

/**
 * The camera's AI firmware state, and what became of this phone's record of an
 * update to it.
 *
 * With no record, or one the camera shows finished or stale, the camera is
 * compared with the latest build of the camera it is running. Each camera has
 * its own build string and the camera runs one of them, so comparing with the
 * newest row of either flagged the camera whenever the other camera's build
 * was newer. When `slots` is not known (it failed, or the caller sends no
 * command), it falls back to matching either camera's latest, which passes an
 * update cut short between its images; the record is what catches that one.
 * An unknown version is unknown, not outdated: it is not actionable.
 */
export const classifyHimax = <T extends BuildLike>({ current, slots, record, latest }: {
    current: string | null
    slots: SlotsReply | null
    record: HimaxUpdateRecord | null
    latest: LatestBuilds<T>
}): HimaxStatus<T> & { recordStatus: RecordStatus } => {
    const cur = trim(current)
    const status = record ? recordStatus(record, cur, slots, latest) : null
    if (record && status === 'pending') {
        const total = record.images.length
        return {
            state: 'unfinished',
            endVariant: record.endVariant,
            done: Math.min(Math.max(record.flashed, 0), total),
            total,
            plan: planPair(record.endVariant, slots, cur, latest),
            recordStatus: status,
        }
    }
    if (!cur) return { state: 'unknown', recordStatus: status }

    const rp3 = trim(latest.RP3?.version)
    const hm0360 = trim(latest.HM0360?.version)
    if (rp3 || hm0360) {
        const running = slots ? parseVariant(slots.running) : 'unknown'
        const upToDate = running === 'unknown' ? [rp3, hm0360].includes(cur) : cur === trim(latest[running]?.version)
        if (upToDate) return { state: 'up_to_date', recordStatus: status }
        const missingVariant: HimaxVariant | null = !latest.RP3 ? 'RP3' : !latest.HM0360 ? 'HM0360' : null
        return missingVariant
            ? { state: 'missing_variant', missingVariant, recordStatus: status }
            : { state: 'outdated', recordStatus: status }
    }
    const newest = trim(latest.any?.version)
    return { state: newest && cur !== newest ? 'outdated' : 'up_to_date', recordStatus: status }
}
