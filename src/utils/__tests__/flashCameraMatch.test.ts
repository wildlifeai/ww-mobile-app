import { checkFlashAgainstCamera } from '../flashCameraMatch'

/**
 * #321. The project's flash LED and the device's active camera are chosen in
 * different places and were never compared. Since #304 the device no longer
 * switches slots on the light verdict, so whichever camera is active at
 * deployment time is the one the whole deployment uses, and an IR flash in
 * front of the colour camera is black frames for the entire run.
 *
 * The table is exhaustive over (mode, led, camera) on purpose: the two failing
 * combinations are easy to state, and every other combination has to stay
 * quiet, or the warning becomes noise an operator learns to scroll past.
 */
describe('checkFlashAgainstCamera', () => {
    const ir = { flash_mode: 'always_on', flash_led: 'ir' }
    const white = { flash_mode: 'always_on', flash_led: 'white' }

    it('calls IR flash on the colour camera broken', () => {
        const verdict = checkFlashAgainstCamera(ir, 'RP3')
        expect(verdict.kind).toBe('mismatch')
        expect(verdict).toMatchObject({ severity: 'broken' })
        // The operator needs the reason, not just the fact.
        expect((verdict as any).message).toMatch(/IR-cut filter/)
    })

    it('calls white flash on the mono camera wasteful, not broken', () => {
        const verdict = checkFlashAgainstCamera(white, 'HM0360')
        expect(verdict).toMatchObject({ kind: 'mismatch', severity: 'wasteful' })
    })

    it('is quiet when the flash suits the camera', () => {
        expect(checkFlashAgainstCamera(ir, 'HM0360')).toEqual({ kind: 'ok' })
        expect(checkFlashAgainstCamera(white, 'RP3')).toEqual({ kind: 'ok' })
    })

    it('is quiet when there is no flash, whatever the camera', () => {
        for (const camera of ['RP3', 'HM0360', 'unknown'] as const) {
            expect(checkFlashAgainstCamera({ flash_mode: 'off', flash_led: 'ir' }, camera))
                .toEqual({ kind: 'ok' })
        }
    })

    it('reports unknown rather than agreement when the camera could not be read', () => {
        expect(checkFlashAgainstCamera(ir, 'unknown')).toEqual({ kind: 'unknown' })
        expect(checkFlashAgainstCamera(white, 'unknown')).toEqual({ kind: 'unknown' })
    })

    /**
     * A row that predates the flash columns resolves to mode 'off' by
     * `DEFAULT_FLASH_MODE`, deliberately, so it must not warn. If that default
     * ever moves to 'light_sensor' this test is the one that will notice.
     */
    it('does not warn for a project with no flash columns at all', () => {
        expect(checkFlashAgainstCamera({}, 'RP3')).toEqual({ kind: 'ok' })
        expect(checkFlashAgainstCamera(null, 'RP3')).toEqual({ kind: 'ok' })
        expect(checkFlashAgainstCamera(undefined, 'RP3')).toEqual({ kind: 'ok' })
    })

    it('applies to every flash mode that actually lights the LED', () => {
        for (const mode of ['light_sensor', 'always_on', 'time_of_day']) {
            expect(checkFlashAgainstCamera({ flash_mode: mode, flash_led: 'ir' }, 'RP3'))
                .toMatchObject({ kind: 'mismatch', severity: 'broken' })
        }
    })
})
