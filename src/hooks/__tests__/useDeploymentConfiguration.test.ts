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
