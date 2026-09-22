import {
    DEFAULT_FLASH_LED,
    DEFAULT_FLASH_MODE,
    FLASH_LED_OPTIONS,
    FLASH_LED_OP_VALUE,
    FLASH_MODE_OPTIONS,
    FLASH_MODE_OP_VALUE,
    describeProjectFlash,
    flashColumnsFromFields,
    formatUtcMinutes,
    resolveProjectFlash,
    resolveProjectFlashOps,
    shortFlashLabel,
} from '../projectFlash'

describe('projectFlash', () => {
    describe('resolveProjectFlashOps', () => {
        it('maps every mode to the firmware op34 value', () => {
            expect(resolveProjectFlashOps({ flash_mode: 'off', flash_led: 'ir' }).mode).toBe(0)
            expect(resolveProjectFlashOps({ flash_mode: 'light_sensor', flash_led: 'ir' }).mode).toBe(1)
            expect(resolveProjectFlashOps({ flash_mode: 'always_on', flash_led: 'ir' }).mode).toBe(2)
            expect(resolveProjectFlashOps({ flash_mode: 'time_of_day', flash_led: 'ir' }).mode).toBe(3)
        })

        it('maps the LED to op13, white 1 and IR 2', () => {
            expect(resolveProjectFlashOps({ flash_mode: 'always_on', flash_led: 'white' }).led).toBe(1)
            expect(resolveProjectFlashOps({ flash_mode: 'always_on', flash_led: 'ir' }).led).toBe(2)
        })

        it('clears the LED when the mode is off, so the night IR gate closes too', () => {
            expect(resolveProjectFlashOps({ flash_mode: 'off', flash_led: 'ir' }).led).toBe(0)
        })

        // The fallback is deliberately not the column's own default of
        // light_sensor: the firmware's AE light check is still being worked on,
        // so no code path here may land on a mode that depends on it.
        it('falls back to no flash for a row that predates the columns', () => {
            const ops = resolveProjectFlashOps({})
            expect(DEFAULT_FLASH_MODE).toBe('off')
            expect(DEFAULT_FLASH_LED).toBe('ir')
            expect(ops.mode).toBe(0)
            expect(ops.led).toBe(0)
        })

        it('falls back for a value outside the check constraint rather than guessing', () => {
            const ops = resolveProjectFlashOps({ flash_mode: 'strobe', flash_led: 'uv' })
            expect(ops.mode).toBe(0)
            expect(ops.led).toBe(0)
        })

        it('writes the window only in time-of-day mode', () => {
            const tod = resolveProjectFlashOps({
                flash_mode: 'time_of_day',
                flash_led: 'ir',
                flash_window_start_minutes_utc: 1080,
                flash_window_minutes: 600,
            })
            expect(tod.windowStart).toBe(1080)
            expect(tod.windowMinutes).toBe(600)

            const alwaysOn = resolveProjectFlashOps({
                flash_mode: 'always_on',
                flash_led: 'ir',
                flash_window_start_minutes_utc: 1080,
                flash_window_minutes: 600,
            })
            expect(alwaysOn.windowStart).toBe(0)
            expect(alwaysOn.windowMinutes).toBe(0)
        })

        it('drops a window outside the column range', () => {
            const ops = resolveProjectFlashOps({
                flash_mode: 'time_of_day',
                flash_led: 'ir',
                flash_window_start_minutes_utc: 1440,
                flash_window_minutes: 0,
            })
            expect(ops.windowStart).toBe(0)
            expect(ops.windowMinutes).toBe(0)
        })

        it('accepts a null project', () => {
            expect(resolveProjectFlashOps(null)).toEqual({ mode: 0, led: 0, windowStart: 0, windowMinutes: 0 })
        })
    })

    describe('resolveProjectFlash', () => {
        it('keeps the column vocabulary', () => {
            expect(resolveProjectFlash({ flash_mode: 'time_of_day', flash_led: 'white' }))
                .toEqual({ mode: 'time_of_day', led: 'white', windowStart: 0, windowMinutes: 0 })
        })
    })

    describe('formatUtcMinutes', () => {
        it('renders minutes after midnight as hh:mm', () => {
            expect(formatUtcMinutes(0)).toBe('00:00')
            expect(formatUtcMinutes(1080)).toBe('18:00')
            expect(formatUtcMinutes(1439)).toBe('23:59')
        })
    })

    // The form-to-columns step the project form and the Dev Deployment Test
    // share (#301), so both store the same thing for the same fields.
    describe('flashColumnsFromFields', () => {
        it('carries the window only in time-of-day mode', () => {
            expect(flashColumnsFromFields('time_of_day', 'ir', '18:00', '600')).toEqual({
                flash_mode: 'time_of_day',
                flash_led: 'ir',
                flash_window_start_minutes_utc: 1080,
                flash_window_minutes: 600,
            })
            expect(flashColumnsFromFields('always_on', 'white', '18:00', '600')).toEqual({
                flash_mode: 'always_on',
                flash_led: 'white',
                flash_window_start_minutes_utc: null,
                flash_window_minutes: null,
            })
        })

        it('stores null rather than a guess for a window it cannot read', () => {
            const columns = flashColumnsFromFields('time_of_day', 'ir', '25:99', 'soon')
            expect(columns.flash_window_start_minutes_utc).toBeNull()
            expect(columns.flash_window_minutes).toBeNull()
            expect(flashColumnsFromFields('time_of_day', 'ir', '06:30', '0').flash_window_minutes).toBeNull()
        })
    })

    describe('option lists', () => {
        it('offer every mode and every LED exactly once, in the column vocabulary', () => {
            expect(FLASH_MODE_OPTIONS.map(o => o.value).sort()).toEqual(Object.keys(FLASH_MODE_OP_VALUE).sort())
            expect(FLASH_LED_OPTIONS.map(o => o.value).sort()).toEqual(Object.keys(FLASH_LED_OP_VALUE).sort())
        })

        it('lead with off and mark the light sensor as in development', () => {
            expect(FLASH_MODE_OPTIONS[0].value).toBe('off')
            expect(FLASH_MODE_OPTIONS.find(o => o.value === 'light_sensor')?.label).toMatch(/in development/)
        })
    })

    describe('labels', () => {
        it('describes each mode for the log and the project card', () => {
            expect(describeProjectFlash({ flash_mode: 'off', flash_led: 'ir' })).toBe('Flash off')
            expect(describeProjectFlash({ flash_mode: 'light_sensor', flash_led: 'ir' }))
                .toBe('IR flash, light sensor decides')
            expect(describeProjectFlash({ flash_mode: 'always_on', flash_led: 'white' }))
                .toBe('white flash, always on')
            expect(describeProjectFlash({
                flash_mode: 'time_of_day',
                flash_led: 'ir',
                flash_window_start_minutes_utc: 1200,
                flash_window_minutes: 480,
            })).toBe('IR flash, 20:00 UTC for 480 min')
        })

        it('says so when time-of-day has no window', () => {
            expect(describeProjectFlash({ flash_mode: 'time_of_day', flash_led: 'ir' }))
                .toBe('IR flash, time of day (no window set)')
        })

        it('keeps the icon label short', () => {
            expect(shortFlashLabel({ flash_mode: 'off', flash_led: 'ir' })).toBe('No flash')
            expect(shortFlashLabel({ flash_mode: 'light_sensor', flash_led: 'ir' })).toBe('IR auto')
            expect(shortFlashLabel({ flash_mode: 'always_on', flash_led: 'white' })).toBe('white always')
            expect(shortFlashLabel({
                flash_mode: 'time_of_day',
                flash_led: 'ir',
                flash_window_start_minutes_utc: 1200,
                flash_window_minutes: 480,
            })).toBe('IR 20:00')
        })
    })
})
