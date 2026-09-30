import { renderHook } from '@testing-library/react-native'

import { useDeploymentConfiguration } from '../useDeploymentConfiguration'
import { OP_PARAMETER } from '../useDeviceSettings'

jest.mock('../../utils/logger', () => ({ log: jest.fn(), logWarn: jest.fn(), logError: jest.fn() }))

/**
 * What reaches the wire when a deployment writes the project's capture flash.
 *
 * The device is reset to FACTORY_DEFAULTS immediately before this runs, which
 * leaves op13 = 0 and op34 = 0: without these writes a deployment captures
 * unlit and, since the firmware gates the motion-frame IR behind the same
 * test, sees nothing at night (#282).
 */
describe('useDeploymentConfiguration configureFlash', () => {
    /** A session that records the setop lines it is asked to send. */
    const makeSession = () => {
        const lines: string[] = []
        return {
            lines,
            execute: jest.fn(async (build: any) => {
                const command = typeof build === 'function' ? build() : build
                lines.push(command?.build?.() ?? '')
                return true
            }),
        }
    }

    /** A post-reset op table: factory defaults for the four flash parameters. */
    const opsAfterReset = (length = 37): string[] =>
        Array.from({ length }, (_, index) =>
            index === OP_PARAMETER.MD_FLASH_LED ? '2' : index === OP_PARAMETER.MD_FLASH_BRIGHTNESS_PERCENT ? '50' : '0')

    const configureFlash = () => renderHook(() => useDeploymentConfiguration()).result.current.configureFlash

    it('writes the LED and the mode a light-sensor project asks for', async () => {
        const session = makeSession()

        await configureFlash()(session, { flash_mode: 'light_sensor', flash_led: 'ir' }, opsAfterReset())

        expect(session.lines).toContain(`AI setop ${OP_PARAMETER.FLASH_LED} 2`)
        expect(session.lines).toContain(`AI setop ${OP_PARAMETER.FLASH_MODE} 1`)
    })

    it('writes the time-of-day window as UTC minutes', async () => {
        const session = makeSession()

        await configureFlash()(session, {
            flash_mode: 'time_of_day',
            flash_led: 'white',
            flash_window_start_minutes_utc: 1080,
            flash_window_minutes: 600,
        }, opsAfterReset())

        expect(session.lines).toContain(`AI setop ${OP_PARAMETER.FLASH_LED} 1`)
        expect(session.lines).toContain(`AI setop ${OP_PARAMETER.FLASH_MODE} 3`)
        expect(session.lines).toContain(`AI setop ${OP_PARAMETER.FLASH_TOD_START} 1080`)
        expect(session.lines).toContain(`AI setop ${OP_PARAMETER.FLASH_TOD_DURATION} 600`)
    })

    it('writes nothing when the device already holds what the project asks for', async () => {
        const session = makeSession()
        const ops = opsAfterReset()
        ops[OP_PARAMETER.FLASH_LED] = '2'
        ops[OP_PARAMETER.FLASH_MODE] = '1'

        await configureFlash()(session, { flash_mode: 'light_sensor', flash_led: 'ir' }, ops)

        expect(session.lines).toHaveLength(0)
    })

    it('leaves the flash off, LED included, for a project that wants none', async () => {
        const session = makeSession()
        const ops = opsAfterReset()
        ops[OP_PARAMETER.FLASH_LED] = '2'
        ops[OP_PARAMETER.FLASH_MODE] = '1'

        await configureFlash()(session, { flash_mode: 'off', flash_led: 'ir' }, ops)

        expect(session.lines).toContain(`AI setop ${OP_PARAMETER.FLASH_LED} 0`)
        expect(session.lines).toContain(`AI setop ${OP_PARAMETER.FLASH_MODE} 0`)
    })

    it('writes op13 only on firmware with no flash mode', async () => {
        const session = makeSession()

        await configureFlash()(session, { flash_mode: 'always_on', flash_led: 'ir' }, opsAfterReset(32))

        expect(session.lines).toEqual([`AI setop ${OP_PARAMETER.FLASH_LED} 2`])
    })
})

/** A session that records every command line it is asked to send. */
const makeRecordingSession = () => {
    const lines: string[] = []
    return {
        lines,
        execute: jest.fn(async (build: any) => {
            const command = typeof build === 'function' ? build() : build
            lines.push(command?.build?.() ?? '')
            return true
        }),
    }
}

/**
 * op17 comes from the project's sensitivity. Every deployment used to write
 * the constant 1, and because the writes are diff-based a device already at 1
 * got no command at all, so the gap left nothing in any log (#316).
 */
describe('useDeploymentConfiguration configureCaptureMethod sensitivity', () => {
    /** Factory defaults as far as this step cares: op17 at 1, everything else 0. */
    const opsAfterReset = (): string[] =>
        Array.from({ length: 37 }, (_, index) => (index === OP_PARAMETER.MD_SENSITIVITY ? '1' : '0'))

    const configureCaptureMethod = () =>
        renderHook(() => useDeploymentConfiguration()).result.current.configureCaptureMethod

    it.each([
        ['activity', 3],
        ['mixed', 2],
    ] as const)('writes the project sensitivity for %s capture', async (captureMethod, level) => {
        const session = makeRecordingSession()

        await configureCaptureMethod()(session, { deploymentId: 'd', captureMethod, mdSensitivity: level }, opsAfterReset())

        expect(session.lines).toContain(`AI setop ${OP_PARAMETER.MD_SENSITIVITY} ${level}`)
    })

    it('defaults to medium when the project has no sensitivity', async () => {
        const session = makeRecordingSession()

        await configureCaptureMethod()(session, { deploymentId: 'd', captureMethod: 'activity' }, opsAfterReset())

        expect(session.lines).toContain(`AI setop ${OP_PARAMETER.MD_SENSITIVITY} 2`)
    })

    it('turns motion detection off for timelapse whatever the sensitivity', async () => {
        const session = makeRecordingSession()

        await configureCaptureMethod()(session, { deploymentId: 'd', captureMethod: 'timelapse', mdSensitivity: 3 }, opsAfterReset())

        expect(session.lines).toContain(`AI setop ${OP_PARAMETER.MD_SENSITIVITY} 0`)
    })
})

/**
 * The exact bytes of the GPS write. The firmware splits the argument on
 * spaces (after turning underscores into spaces) and needs six fields; the
 * decimal "lat,lon,alt" this path used to send was one token, discarded
 * without an error, so no deployment ever wrote EXIF GPS and privacy mode
 * never cleared the previous position (#315).
 */
describe('useDeploymentConfiguration setDeploymentId GPS', () => {
    const setDeploymentId = () =>
        renderHook(() => useDeploymentConfiguration()).result.current.setDeploymentId

    const gpsLine = (lines: string[]) => lines.find(line => line.startsWith('AI setgps '))

    it('sends a real position in the six-field format', async () => {
        const session = makeRecordingSession()

        await setDeploymentId()(session, 'd', { latitude: -45.5, longitude: 167.75, altitude: 320.5 }, true, ['0'])

        expect(gpsLine(session.lines)).toBe(`AI setgps 45°30'0.00"_S_167°45'0.00"_E_320.50_Above`)
    })

    it('zeroes the position in the same format when GPS is not recorded', async () => {
        const session = makeRecordingSession()

        await setDeploymentId()(session, 'd', { latitude: -45.5, longitude: 167.75, altitude: 320.5 }, false, ['0'])

        expect(gpsLine(session.lines)).toBe(`AI setgps 0°0'0.00"_N_0°0'0.00"_E_0.00_Above`)
    })
})
