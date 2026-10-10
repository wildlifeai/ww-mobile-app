import { commandRegistry } from '../../ble/protocol/commandRegistry'
import { classifyHimax, HimaxUpdateRecord, isRunningFromSelectedSlot, planPair } from '../himaxFirmwareState'

const build = (cameraVariant: 'RP3' | 'HM0360' | null, version: string) => ({ id: `fw-${version}`, version, cameraVariant })

/** An `AI slots` reply, parsed by the registry from the words the camera sends */
const slots = (activeSlot: 0 | 1, running: 'RP3' | 'HM0360', slotA: string, slotB: string) => {
    const name = (label: string) => (label === 'RP3' ? 'RP3 (day/colour)' : label === 'HM0360' ? 'HM0360 (night/IR)' : label)
    const cmd = commandRegistry.slots()
    cmd.collect(`Active slot ${activeSlot} running '${name(running)}'. Slot A: '${name(slotA)}', Slot B: '${name(slotB)}'. Auto-switch: off`)
    return cmd.parser()
}

// WILD-DJZQ on the bench, 9 October 2026: running the 10:09 colour build when
// the dev deploy left the catalogue holding only the 10:56 night build (#437)
const RUNNING = 'WW500_C02 10:09:08 Oct  9 2026'
const COLOUR_1009 = build('RP3', RUNNING)
const COLOUR_1056 = build('RP3', 'WW500_C02 10:56:11 Oct  9 2026')
const NIGHT_1056 = build('HM0360', 'WW500_C02 10:56:08 Oct  9 2026')

const pairOf = (rp3: ReturnType<typeof build> | null, hm0360: ReturnType<typeof build> | null, any = rp3 ?? hm0360) =>
    ({ RP3: rp3, HM0360: hm0360, any })
const noRecord = (current: string | null, latest: ReturnType<typeof pairOf>, slotsReply: ReturnType<typeof slots> | null = null) =>
    classifyHimax({ current, slots: slotsReply, record: null, latest })

/**
 * #437: the update installs both camera images or neither, so with one
 * camera's build in the catalogue there is nothing to update to. These are
 * the cases #446 pinned on `himaxUpdateState`, which this classifier replaced.
 * Without `slots` the camera is compared with either camera's latest.
 */
describe('classifyHimax without a record or slots', () => {
    it('does not count a camera as outdated against one camera\'s build, and names the missing camera', () => {
        expect(noRecord(RUNNING, pairOf(null, NIGHT_1056))).toEqual({ state: 'missing_variant', missingVariant: 'RP3', recordStatus: null })
        expect(noRecord(RUNNING, pairOf(COLOUR_1056, null))).toEqual({ state: 'missing_variant', missingVariant: 'HM0360', recordStatus: null })
    })

    it('names no missing camera when the device runs the one build there is', () => {
        expect(noRecord(RUNNING, pairOf(COLOUR_1009, null)).state).toBe('up_to_date')
    })

    it('counts the camera as outdated once both cameras\' builds are there', () => {
        expect(noRecord(RUNNING, pairOf(COLOUR_1056, NIGHT_1056)).state).toBe('outdated')
    })

    it('keeps the either-camera rule for a complete pair', () => {
        expect(noRecord(NIGHT_1056.version, pairOf(COLOUR_1056, NIGHT_1056)).state).toBe('up_to_date')
    })

    it('says nothing about a version it could not read', () => {
        expect(noRecord(null, pairOf(null, NIGHT_1056)).state).toBe('unknown')
    })

    it('compares a catalogue without camera labels with its newest build', () => {
        const legacy = build(null, 'WW500_C02 10:56:08 Oct  9 2026')
        expect(noRecord(RUNNING, { RP3: null, HM0360: null, any: legacy }).state).toBe('outdated')
    })
})

// #374: each camera has its own build string, so the camera is compared with
// the latest build of the camera it runs, once `slots` says which that is
describe('classifyHimax with slots and no record', () => {
    const colourRunning = slots(0, 'RP3', 'RP3', 'HM0360')

    it('compares the camera with the latest build of the camera it runs', () => {
        expect(noRecord(COLOUR_1056.version, pairOf(COLOUR_1056, NIGHT_1056), colourRunning).state).toBe('up_to_date')
        // The night build's string from a camera that says it runs the colour image is not up to date
        expect(noRecord(NIGHT_1056.version, pairOf(COLOUR_1056, NIGHT_1056), colourRunning).state).toBe('outdated')
    })

    it('still names the missing camera when the running camera has no build in the catalogue', () => {
        expect(noRecord(RUNNING, pairOf(null, NIGHT_1056), colourRunning)).toEqual(
            expect.objectContaining({ state: 'missing_variant', missingVariant: 'RP3' }))
    })
})

/**
 * The camera's states around an update that started on camera E in slot B
 * (the night camera, HM0360) and wrote camera X (colour, RP3) to slot A first
 * (research for #374, Q2). "Active slot" is the selector, the slot that boots
 * next; `firmware` resets the written slot's label to `unknown`, and only a
 * cold boot labels it again.
 */
const S0 = slots(1, 'HM0360', 'RP3', 'HM0360') // healthy, nothing written
const S2 = slots(0, 'HM0360', 'unknown', 'HM0360') // image 1 written, camera still awake on E
const S3W = slots(0, 'RP3', 'unknown', 'HM0360') // stopped before the reset, booted X at its next wake
const S3C = slots(0, 'RP3', 'RP3', 'HM0360') // stopped after the reset, during image 2's transfer
const C = slots(1, 'HM0360', 'RP3', 'unknown') // image 2's command went out, then the app stopped

describe('isRunningFromSelectedSlot', () => {
    it('is true once the camera has started the image its selector names', () => {
        expect(isRunningFromSelectedSlot(S0)).toBe(true)
        expect(isRunningFromSelectedSlot(S3W)).toBe(true)
        expect(isRunningFromSelectedSlot(S3C)).toBe(true)
        expect(isRunningFromSelectedSlot(C)).toBe(true)
    })

    it('is false while the camera still runs the image it had before a write', () => {
        expect(isRunningFromSelectedSlot(S2)).toBe(false)
        // A slot switch not yet restarted
        expect(isRunningFromSelectedSlot(slots(0, 'HM0360', 'RP3', 'unknown'))).toBe(false)
    })
})

describe('classifyHimax with this phone\'s record of a pair update', () => {
    const NIGHT_OLD = 'WW500_C02 10:02:35 Oct  8 2026'
    const COLOUR_NEW = build('RP3', 'WW500_C02 10:09:08 Oct  9 2026')
    const NIGHT_NEW = build('HM0360', 'WW500_C02 10:09:02 Oct  9 2026')
    const latest = pairOf(COLOUR_NEW, NIGHT_NEW)
    const record = (sent: number, flashed: number): HimaxUpdateRecord => ({
        startedAt: '2026-10-09T10:49:00.000Z',
        endVariant: 'HM0360',
        startActiveSlot: 1,
        startVersion: NIGHT_OLD,
        images: [
            { variant: 'RP3', version: COLOUR_NEW.version, filename: 'R6A09A09.IMG' },
            { variant: 'HM0360', version: NIGHT_NEW.version, filename: 'H6A09A09.IMG' },
        ],
        sent,
        flashed,
    })
    const classify = (current: string, slotsReply: ReturnType<typeof slots> | null, rec: HimaxUpdateRecord, cat = latest) =>
        classifyHimax({ current, slots: slotsReply, record: rec, latest: cat })

    it('reads the bench camera of 9 October as unfinished, where Firmware Status said up to date', () => {
        // Stopped while image 2 was copying, after image 1's reset (23:49):
        // the colour image runs from slot A at its latest build
        const result = classify(COLOUR_NEW.version, S3C, record(1, 1))
        expect(result).toEqual(expect.objectContaining({ state: 'unfinished', endVariant: 'HM0360', done: 1, total: 2, recordStatus: 'pending' }))
        // and finishing writes the night image alone
        expect(result.state === 'unfinished' && result.plan).toEqual([NIGHT_NEW])
        // Without the record the same camera reads up to date: the limit of a record on one phone
        expect(noRecord(COLOUR_NEW.version, latest, S3C).state).toBe('up_to_date')
    })

    it('reads a camera that booted image 1 at a wake, with no reset, as unfinished with one image left', () => {
        const result = classify(COLOUR_NEW.version, S3W, record(1, 1))
        expect(result.state).toBe('unfinished')
        expect(result.state === 'unfinished' && result.plan).toEqual([NIGHT_NEW])
    })

    it('leaves both images to write while the camera still runs its old image after image 1', () => {
        const result = classify(NIGHT_OLD, S2, record(1, 1))
        expect(result.state).toBe('unfinished')
        expect(result.state === 'unfinished' && result.plan).toEqual([COLOUR_NEW, NIGHT_NEW])
    })

    it('writes both images again when a newer pair is out', () => {
        const NIGHT_NEWER = build('HM0360', 'WW500_C02 08:30:12 Oct 10 2026')
        const COLOUR_NEWER = build('RP3', 'WW500_C02 08:30:20 Oct 10 2026')
        const result = classify(COLOUR_NEW.version, S3C, record(1, 1), pairOf(COLOUR_NEWER, NIGHT_NEWER))
        expect(result.state === 'unfinished' && result.plan).toEqual([COLOUR_NEWER, NIGHT_NEWER])
    })

    it('reads an update whose last command went out before the app stopped as finished, once the camera runs it', () => {
        const result = classify(NIGHT_NEW.version, C, record(2, 1))
        expect(result).toEqual(expect.objectContaining({ state: 'up_to_date', recordStatus: 'finished' }))
    })

    it('keeps an update unfinished until every image has gone out, whatever the running build', () => {
        // The night camera was already on its latest build and only image 1 went out
        const result = classifyHimax({ current: NIGHT_NEW.version, slots: S2, record: { ...record(1, 1), startVersion: NIGHT_NEW.version }, latest })
        expect(result.state).toBe('unfinished')
    })

    it('drops a record when the camera is where the update found it', () => {
        // The write was refused, or failed before the selector moved
        expect(classify(NIGHT_OLD, S0, record(1, 0))).toEqual(expect.objectContaining({ state: 'outdated', recordStatus: 'stale' }))
    })

    it('drops a record of an update that never sent a write', () => {
        expect(classify(NIGHT_OLD, S0, record(0, 0)).recordStatus).toBe('stale')
    })

    it('drops a record once the camera runs the end camera\'s build from its selected slot', () => {
        // Finished by another phone, or by a switch back once both were written
        const result = classify(NIGHT_NEW.version, slots(1, 'HM0360', 'RP3', 'HM0360'), record(2, 2))
        expect(result).toEqual(expect.objectContaining({ state: 'up_to_date', recordStatus: 'finished' }))
    })

    describe('without slots, as Start Monitoring\'s check that sends nothing (#268)', () => {
        it('reads the record as unfinished', () => {
            expect(classify(COLOUR_NEW.version, null, record(1, 1)).state).toBe('unfinished')
        })

        it('reads it as finished when the camera runs the end camera\'s new build', () => {
            expect(classify(NIGHT_NEW.version, null, record(2, 2)).recordStatus).toBe('finished')
        })

        it('cannot tell a camera nothing reached, so keeps the record', () => {
            expect(classify(NIGHT_OLD, null, record(1, 0)).recordStatus).toBe('pending')
        })
    })
})

describe('planPair', () => {
    const latest = pairOf(COLOUR_1056, NIGHT_1056)

    it('writes the other camera first and the end camera last', () => {
        expect(planPair('HM0360', S0, RUNNING, latest)).toEqual([COLOUR_1056, NIGHT_1056])
        expect(planPair('RP3', slots(0, 'RP3', 'RP3', 'HM0360'), RUNNING, latest)).toEqual([NIGHT_1056, COLOUR_1056])
    })

    it('drops the other camera\'s image when the camera already runs it from its selected slot', () => {
        expect(planPair('HM0360', S3C, COLOUR_1056.version, latest)).toEqual([NIGHT_1056])
    })

    it('keeps both while the camera has not restarted into its selected slot', () => {
        // Image 2 written to slot A, the camera still on image 1 in slot B
        expect(planPair('RP3', slots(0, 'HM0360', 'unknown', 'HM0360'), NIGHT_1056.version, latest)).toEqual([NIGHT_1056, COLOUR_1056])
    })
})
