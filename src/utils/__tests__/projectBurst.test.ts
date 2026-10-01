import {
    DEFAULT_PHOTO_INTERVAL_MS,
    DEFAULT_PHOTOS_PER_TRIGGER,
    describeProjectBurst,
    resolveProjectBurst,
    resolveProjectBurstOps,
    shortBurstLabel,
} from '../projectBurst'

/**
 * The project's burst as the device's op5 and op6 (#317). The project counts
 * the JPEGs the user sees; with the raw BMP recorded the firmware alternates
 * the two through op5, so op5 is doubled.
 */
describe('projectBurst', () => {
    describe('resolveProjectBurst', () => {
        it('takes the project values inside the CHECK ranges', () => {
            expect(resolveProjectBurst({ photos_per_trigger: 10, photo_interval_milliseconds: 200 }))
                .toEqual({ photosPerTrigger: 10, intervalMs: 200 })
            expect(resolveProjectBurst({ photos_per_trigger: 1, photo_interval_milliseconds: 2000 }))
                .toEqual({ photosPerTrigger: 1, intervalMs: 2000 })
        })

        it('falls back to the column defaults for a missing project or missing values', () => {
            const defaults = { photosPerTrigger: DEFAULT_PHOTOS_PER_TRIGGER, intervalMs: DEFAULT_PHOTO_INTERVAL_MS }
            expect(defaults).toEqual({ photosPerTrigger: 3, intervalMs: 1000 })
            expect(resolveProjectBurst(undefined)).toEqual(defaults)
            expect(resolveProjectBurst({ photos_per_trigger: null, photo_interval_milliseconds: null })).toEqual(defaults)
        })

        it('treats a value outside the CHECK range as unset, 0 included', () => {
            expect(resolveProjectBurst({ photos_per_trigger: 0, photo_interval_milliseconds: 0 }))
                .toEqual({ photosPerTrigger: 3, intervalMs: 1000 })
            expect(resolveProjectBurst({ photos_per_trigger: 11, photo_interval_milliseconds: 2001 }))
                .toEqual({ photosPerTrigger: 3, intervalMs: 1000 })
            expect(resolveProjectBurst({ photos_per_trigger: 2.5, photo_interval_milliseconds: 199 }))
                .toEqual({ photosPerTrigger: 3, intervalMs: 1000 })
        })
    })

    describe('resolveProjectBurstOps', () => {
        it('writes the project count as op5 when only JPEGs are recorded', () => {
            expect(resolveProjectBurstOps({ photos_per_trigger: 3, photo_interval_milliseconds: 1000 }))
                .toEqual({ numPictures: 3, pictureIntervalMs: 1000, intervalBeforeDpdMs: 2000 })
        })

        it('doubles op5 when the raw BMP is recorded, and leaves op6 alone', () => {
            expect(resolveProjectBurstOps({ photos_per_trigger: 3, photo_interval_milliseconds: 1000 }, true))
                .toEqual({ numPictures: 6, pictureIntervalMs: 1000, intervalBeforeDpdMs: 2000 })
        })

        it('doubles the default when the project has no value', () => {
            expect(resolveProjectBurstOps(null, true)).toEqual({ numPictures: 6, pictureIntervalMs: 1000, intervalBeforeDpdMs: 2000 })
        })
    })

    /**
     * op8 outlasts op6 whenever there is a next capture to wait for: the
     * firmware sleeps mid-burst once op8 runs out (Seeed #208).
     */
    describe('op8, the camera awake time', () => {
        const op8 = (photos: number, interval: number, rawBmp = false) =>
            resolveProjectBurstOps({ photos_per_trigger: photos, photo_interval_milliseconds: interval }, rawBmp).intervalBeforeDpdMs

        it('is the interval plus a second for a burst', () => {
            expect(op8(3, 1000)).toBe(2000)
            expect(op8(3, 2000)).toBe(3000)
            expect(op8(2, 200)).toBe(1200)
        })

        it('stays at the usual 1000 ms for a single picture, whatever the interval', () => {
            expect(op8(1, 1000)).toBe(1000)
            expect(op8(1, 2000)).toBe(1000)
        })

        it('counts captures, so a single photo with its raw BMP still waits out the interval', () => {
            expect(op8(1, 1500, true)).toBe(2500)
        })
    })

    describe('labels', () => {
        it('describes the burst and the op8 written for the deployment log', () => {
            expect(describeProjectBurst({ photos_per_trigger: 3, photo_interval_milliseconds: 1000 }))
                .toBe('Pictures per trigger: 3, 1000 ms apart (awake 2000 ms)')
            expect(describeProjectBurst({ photos_per_trigger: 3, photo_interval_milliseconds: 2000 }))
                .toBe('Pictures per trigger: 3, 2000 ms apart (awake 3000 ms)')
            expect(describeProjectBurst({ photos_per_trigger: 1, photo_interval_milliseconds: 1000 }))
                .toBe('Pictures per trigger: 1 (awake 1000 ms)')
        })

        it('names the count in two words for the feature row', () => {
            expect(shortBurstLabel({ photos_per_trigger: 3 })).toBe('3 photos')
            expect(shortBurstLabel({ photos_per_trigger: 1 })).toBe('1 photo')
        })
    })
})
