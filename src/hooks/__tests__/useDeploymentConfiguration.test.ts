import { renderHook } from '@testing-library/react-native'

import { useDeploymentConfiguration } from '../useDeploymentConfiguration'
import { OP_PARAMETER } from '../useDeviceSettings'
import { createBleSession } from '../../ble/session/createBleSession'
import { mdIntervalHold } from '../../ble/session/mdIntervalHold'
import { keepAwake, KeepAwakeSession } from '../../ble/session/keepAwake'
import { flashHold } from '../../ble/session/flashHold'
import { flashLedHold } from '../../ble/session/flashLedHold'

jest.mock('../../utils/logger', () => ({ log: jest.fn(), logWarn: jest.fn(), logError: jest.fn() }))
jest.mock('../../ble/session/createBleSession', () => ({ createBleSession: jest.fn() }))

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
 * A motion test holds op11 at its interval and puts the original back when it
 * ends, or on the next test if the link dropped first. The Start Monitoring
 * card tests at the 1000 ms a deployment writes, so from the op table alone a
 * later restore could not tell the deployment's value from the test's, and
 * would switch motion detection off on a deployed camera (#274).
 */
describe('useDeploymentConfiguration configure and the motion test op11 hold', () => {
    const opsAfterReset = (): string[] => Array.from({ length: 37 }, () => '0')

    it('drops any op11 hold or owed restore before it writes anything', async () => {
        const session = makeRecordingSession()
        ;(createBleSession as jest.Mock).mockReturnValue(session)
        let linesAtForget = -1
        jest.spyOn(mdIntervalHold, 'forget').mockImplementation(async () => { linesAtForget = session.lines.length })

        const configure = renderHook(() => useDeploymentConfiguration()).result.current.configure
        await configure({ id: 'dev-1', connected: true } as any, { deploymentId: 'd', captureMethod: 'activity' }, opsAfterReset())

        expect(mdIntervalHold.forget).toHaveBeenCalledWith('dev-1')
        expect(linesAtForget).toBe(0)
        expect(session.lines).toContain(`AI setop ${OP_PARAMETER.MD_INTERVAL} 1000`)
    })
})

/**
 * A motion test with the flash holds op34 (flashHold) and op13 and op9
 * (flashLedHold), and a dropped test leaves their originals owed for the next
 * test to pay. The deployment writes op34 and op13 from the project, and the
 * project's LED can be the one the test held, so a restore owed from before it
 * would take the project's flash off a deployed camera (#383, #387).
 */
describe('useDeploymentConfiguration configure and the motion test flash holds', () => {
    const opsAfterReset = (): string[] => Array.from({ length: 37 }, () => '0')

    it('drops the flash holds and any owed restore before it writes anything', async () => {
        const session = makeRecordingSession()
        ;(createBleSession as jest.Mock).mockReturnValue(session)
        const linesAtForget: Record<string, number> = {}
        jest.spyOn(flashHold, 'forget').mockImplementation(async () => { linesAtForget.op34 = session.lines.length })
        jest.spyOn(flashLedHold, 'forget').mockImplementation(async () => { linesAtForget.op13 = session.lines.length })

        const configure = renderHook(() => useDeploymentConfiguration()).result.current.configure
        await configure({ id: 'dev-1', connected: true } as any, {
            deploymentId: 'd',
            captureMethod: 'activity',
            flash: { flash_mode: 'always_on', flash_led: 'ir' },
        }, opsAfterReset())

        expect(flashHold.forget).toHaveBeenCalledWith('dev-1')
        expect(flashLedHold.forget).toHaveBeenCalledWith('dev-1')
        expect(linesAtForget).toEqual({ op34: 0, op13: 0 })
        expect(session.lines).toContain(`AI setop ${OP_PARAMETER.FLASH_LED} 2`)
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

/**
 * Pictures per trigger (op5), their interval (op6) and the op8 that outlasts
 * it, from the project (#317). The reset before this preserves op5, so the
 * card's old count survives it, sets op6 to the factory 500 ms, which no other
 * step writes, and op8 to the factory 1000 ms, which a burst has to exceed:
 * the firmware sleeps mid-burst once op8 runs out (Seeed #208).
 */
describe('useDeploymentConfiguration burst', () => {
    /** A post-reset table: op5 as an earlier deployment left it, op6 and op8 at their factory values. */
    const opsAfterReset = (op5 = '1', op8 = '1000'): string[] =>
        Array.from({ length: 37 }, (_, index) =>
            index === OP_PARAMETER.NUM_PICTURES ? op5
                : index === OP_PARAMETER.PICTURE_INTERVAL ? '500'
                    : index === OP_PARAMETER.INTERVAL_BEFORE_DPD ? op8
                        : '0')

    const hook = () => renderHook(() => useDeploymentConfiguration()).result.current

    const BURST_OPS: number[] = [OP_PARAMETER.NUM_PICTURES, OP_PARAMETER.PICTURE_INTERVAL, OP_PARAMETER.INTERVAL_BEFORE_DPD]
    const burstLines = (lines: string[]) => lines.filter(line => BURST_OPS.some(index => line.startsWith(`AI setop ${index} `)))
    const op8Lines = (lines: string[]) => lines.filter(line => line.startsWith(`AI setop ${OP_PARAMETER.INTERVAL_BEFORE_DPD} `))

    it('3 x 1000 ms: op5 3, op6 1000 and op8 2000', async () => {
        const session = makeRecordingSession()

        await hook().configureBurst(session, { photos_per_trigger: 3, photo_interval_milliseconds: 1000 }, opsAfterReset())

        expect(session.lines).toEqual([
            `AI setop ${OP_PARAMETER.NUM_PICTURES} 3`,
            `AI setop ${OP_PARAMETER.PICTURE_INTERVAL} 1000`,
            `AI setop ${OP_PARAMETER.INTERVAL_BEFORE_DPD} 2000`,
        ])
    })

    it('3 x 2000 ms: op8 3000', async () => {
        const session = makeRecordingSession()

        await hook().configureBurst(session, { photos_per_trigger: 3, photo_interval_milliseconds: 2000 }, opsAfterReset())

        expect(op8Lines(session.lines)).toEqual([`AI setop ${OP_PARAMETER.INTERVAL_BEFORE_DPD} 3000`])
    })

    it('1 photo: op8 stays at 1000, written only when the device holds something else', async () => {
        const settled = makeRecordingSession()
        await hook().configureBurst(settled, { photos_per_trigger: 1, photo_interval_milliseconds: 2000 }, opsAfterReset())
        expect(op8Lines(settled.lines)).toEqual([])

        const raised = makeRecordingSession()
        await hook().configureBurst(raised, { photos_per_trigger: 1, photo_interval_milliseconds: 2000 }, opsAfterReset('1', '3000'))
        expect(op8Lines(raised.lines)).toEqual([`AI setop ${OP_PARAMETER.INTERVAL_BEFORE_DPD} 1000`])
    })

    it('doubles op5 when the raw BMP is recorded, and writes op6 unchanged', async () => {
        const session = makeRecordingSession()

        await hook().configureBurst(session, { photos_per_trigger: 3, photo_interval_milliseconds: 1000 }, opsAfterReset(), true)

        expect(session.lines).toEqual([
            `AI setop ${OP_PARAMETER.NUM_PICTURES} 6`,
            `AI setop ${OP_PARAMETER.PICTURE_INTERVAL} 1000`,
            `AI setop ${OP_PARAMETER.INTERVAL_BEFORE_DPD} 2000`,
        ])
    })

    it('writes the column defaults for a project with no values', async () => {
        const session = makeRecordingSession()

        await hook().configureBurst(session, {}, opsAfterReset())

        expect(session.lines).toEqual([
            `AI setop ${OP_PARAMETER.NUM_PICTURES} 3`,
            `AI setop ${OP_PARAMETER.PICTURE_INTERVAL} 1000`,
            `AI setop ${OP_PARAMETER.INTERVAL_BEFORE_DPD} 2000`,
        ])
    })

    it('skips a value the device already holds', async () => {
        const session = makeRecordingSession()

        // op5 survived the reset at 3; op6 is always 500 after it
        await hook().configureBurst(session, { photos_per_trigger: 3, photo_interval_milliseconds: 1000 }, opsAfterReset('3', '2000'))

        expect(session.lines).toEqual([`AI setop ${OP_PARAMETER.PICTURE_INTERVAL} 1000`])
    })

    it('configure writes the burst after the capture method, so its op8 is the one that stays', async () => {
        const session = makeRecordingSession()
        ;(createBleSession as jest.Mock).mockReturnValue(session)

        await hook().configure({ id: 'dev' } as any, {
            deploymentId: 'd',
            captureMethod: 'timelapse',
            timelapseInterval: 300,
            burst: { photos_per_trigger: 5, photo_interval_milliseconds: 800 },
        }, opsAfterReset())

        expect(burstLines(session.lines)).toEqual([
            `AI setop ${OP_PARAMETER.NUM_PICTURES} 5`,
            `AI setop ${OP_PARAMETER.PICTURE_INTERVAL} 800`,
            `AI setop ${OP_PARAMETER.INTERVAL_BEFORE_DPD} 1800`,
        ])
        expect(session.lines.indexOf(`AI setop ${OP_PARAMETER.NUM_PICTURES} 5`))
            .toBeGreaterThan(session.lines.indexOf(`AI setop ${OP_PARAMETER.CAMERA_ENABLED} 1`))
    })

    it('configure ends on the burst op8 even when the capture method had to write 1000 first', async () => {
        // A table where op8 is not the factory 1000, so the capture method
        // writes it. The burst then compares against that write, not against
        // the stale 2000, and must not skip its own.
        const session = makeRecordingSession()
        ;(createBleSession as jest.Mock).mockReturnValue(session)
        const ops = opsAfterReset('3', '2000')

        await hook().configure({ id: 'dev' } as any, {
            deploymentId: 'd',
            captureMethod: 'activity',
            burst: { photos_per_trigger: 3, photo_interval_milliseconds: 1000 },
        }, ops)

        expect(op8Lines(session.lines)).toEqual([
            `AI setop ${OP_PARAMETER.INTERVAL_BEFORE_DPD} 1000`,
            `AI setop ${OP_PARAMETER.INTERVAL_BEFORE_DPD} 2000`,
        ])
        // The caller's table is left as it was
        expect(ops[OP_PARAMETER.INTERVAL_BEFORE_DPD]).toBe('2000')
    })

    it('configure leaves op5 and op6 alone and op8 at 1000 without one, as the dev deployment needs', async () => {
        const session = makeRecordingSession()
        ;(createBleSession as jest.Mock).mockReturnValue(session)

        await hook().configure({ id: 'dev' } as any, {
            deploymentId: 'd',
            captureMethod: 'activity',
        }, opsAfterReset())

        expect(burstLines(session.lines)).toEqual([])
    })

    /**
     * keepAwake keeps the op8 a hold raised from, to put back. A deployment
     * that raised op8 for a burst must not have that earlier 1000 written back
     * over it: neither by the release of a hold still open on the screen (the
     * motion test on Start Monitoring), nor by a later hold that turns an owed
     * restore into the value its release writes.
     */
    describe('and keepAwake', () => {
        /** A session keepAwake can read op8 from, recording what it sends. */
        const holdSession = (op8: string): KeepAwakeSession & { lines: string[] } => {
            const lines: string[] = []
            return {
                lines,
                getOps: jest.fn(async () => opsAfterReset('3', op8)),
                execute: jest.fn(async (build: any) => {
                    const command = typeof build === 'function' ? build() : build
                    lines.push(command?.build?.() ?? '')
                    return true
                }) as KeepAwakeSession['execute'],
            }
        }

        const deployBurst = async () => {
            const deployment = makeRecordingSession()
            ;(createBleSession as jest.Mock).mockReturnValue(deployment)
            await hook().configure({ id: 'dev' } as any, {
                deploymentId: 'd',
                captureMethod: 'activity',
                burst: { photos_per_trigger: 3, photo_interval_milliseconds: 2000 },
            }, opsAfterReset())
            return deployment
        }

        beforeEach(() => keepAwake.clear())
        afterEach(() => keepAwake.clear())

        it('a hold open before the deployment writes nothing back afterwards', async () => {
            const screen = holdSession('1000')
            await keepAwake.acquire(screen, 'dev', 3000)
            expect(op8Lines(screen.lines)).toEqual([`AI setop ${OP_PARAMETER.INTERVAL_BEFORE_DPD} 3000`])

            const deployment = await deployBurst()
            expect(op8Lines(deployment.lines)).toEqual([`AI setop ${OP_PARAMETER.INTERVAL_BEFORE_DPD} 3000`])

            await keepAwake.release(screen, 'dev')
            expect(op8Lines(screen.lines)).toEqual([`AI setop ${OP_PARAMETER.INTERVAL_BEFORE_DPD} 3000`])
            expect(keepAwake.holds('dev')).toBe(false)
        })

        it('a restore owed from before the deployment is not written by a later hold', async () => {
            // A hold whose link dropped: the hold is gone, the original 1000 stays owed
            await keepAwake.acquire(holdSession('1000'), 'dev', 3000)
            ;(keepAwake as any).holdsByDevice.delete('dev')

            await deployBurst()

            // Capture Picture afterwards: its 3 s hold matches the deployed op8
            const later = holdSession('3000')
            await keepAwake.acquire(later, 'dev', 3000)
            await keepAwake.release(later, 'dev')

            expect(op8Lines(later.lines)).toEqual([])
        })
    })
})

/**
 * The detection threshold (op16), from the project (#342). The reset before
 * this sets op16 to the factory 18, which is 57%, the column default, and no
 * other step writes it, so a threshold tuned at the bench was lost at every
 * deployment.
 */
describe('useDeploymentConfiguration detection threshold', () => {
    /** A post-reset table: op16 at its factory 18 unless told otherwise. */
    const opsAfterReset = (op16 = '18'): string[] =>
        Array.from({ length: 37 }, (_, index) => (index === OP_PARAMETER.MODEL_THRESHOLD ? op16 : '0'))

    const hook = () => renderHook(() => useDeploymentConfiguration()).result.current

    const op16Lines = (lines: string[]) => lines.filter(line => line.startsWith(`AI setop ${OP_PARAMETER.MODEL_THRESHOLD} `))

    it('writes op16 from the project percent', async () => {
        const session = makeRecordingSession()

        await hook().configureDetectionThreshold(session, { detection_threshold_pct: 80 }, opsAfterReset())

        expect(session.lines).toEqual([`AI setop ${OP_PARAMETER.MODEL_THRESHOLD} 77`])
    })

    it('writes both ends of the range', async () => {
        const low = makeRecordingSession()
        await hook().configureDetectionThreshold(low, { detection_threshold_pct: 50 }, opsAfterReset())
        expect(low.lines).toEqual([`AI setop ${OP_PARAMETER.MODEL_THRESHOLD} 0`])

        const high = makeRecordingSession()
        await hook().configureDetectionThreshold(high, { detection_threshold_pct: 99 }, opsAfterReset())
        expect(high.lines).toEqual([`AI setop ${OP_PARAMETER.MODEL_THRESHOLD} 126`])
    })

    it('writes nothing for the default, which the reset has already left', async () => {
        const session = makeRecordingSession()

        await hook().configureDetectionThreshold(session, { detection_threshold_pct: 57 }, opsAfterReset())
        await hook().configureDetectionThreshold(session, {}, opsAfterReset())

        expect(session.lines).toEqual([])
    })

    it('skips a value the device already holds', async () => {
        const session = makeRecordingSession()

        await hook().configureDetectionThreshold(session, { detection_threshold_pct: 80 }, opsAfterReset('77'))

        expect(session.lines).toEqual([])
    })

    it('puts a device off the default back on it for a default project', async () => {
        // A table where op16 is not 18, as a caller without a reset could pass
        const session = makeRecordingSession()

        await hook().configureDetectionThreshold(session, { detection_threshold_pct: null }, opsAfterReset('64'))

        expect(session.lines).toEqual([`AI setop ${OP_PARAMETER.MODEL_THRESHOLD} 18`])
    })

    it('configure writes op16 from the project, against its own copy of the table', async () => {
        const session = makeRecordingSession()
        ;(createBleSession as jest.Mock).mockReturnValue(session)
        const ops = opsAfterReset()

        await hook().configure({ id: 'dev' } as any, {
            deploymentId: 'd',
            captureMethod: 'activity',
            detectionThreshold: { detection_threshold_pct: 90 },
        }, ops)

        expect(op16Lines(session.lines)).toEqual([`AI setop ${OP_PARAMETER.MODEL_THRESHOLD} 103`])
        // The caller's table is left as it was
        expect(ops[OP_PARAMETER.MODEL_THRESHOLD]).toBe('18')
    })

    it('configure skips op16 when the device already holds the project value', async () => {
        const session = makeRecordingSession()
        ;(createBleSession as jest.Mock).mockReturnValue(session)

        await hook().configure({ id: 'dev' } as any, {
            deploymentId: 'd',
            captureMethod: 'activity',
            detectionThreshold: { detection_threshold_pct: 90 },
        }, opsAfterReset('103'))

        expect(op16Lines(session.lines)).toEqual([])
    })

    it('configure leaves op16 alone without one', async () => {
        const session = makeRecordingSession()
        ;(createBleSession as jest.Mock).mockReturnValue(session)

        await hook().configure({ id: 'dev' } as any, {
            deploymentId: 'd',
            captureMethod: 'activity',
        }, opsAfterReset('64'))

        expect(op16Lines(session.lines)).toEqual([])
    })
})

/**
 * op32, the LoRaWAN ping period (Charles Palmer, 6 October 2026): 0 never
 * joins, 720 is the default. A deployment writes it from the project's
 * lorawan_required, after the reset has put the default there.
 */
describe('useDeploymentConfiguration configureLorawan', () => {
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
    const ops = (length: number, op32: string) =>
        Array.from({ length }, (_, index) => (index === OP_PARAMETER.LORAWAN_PING_MINUTES ? op32 : '0'))
    const configureLorawan = () => renderHook(() => useDeploymentConfiguration()).result.current.configureLorawan

    it('turns LoRaWAN off for a project that does not require it', async () => {
        const session = makeSession()
        await configureLorawan()(session, false, ops(37, '720'))
        expect(session.lines).toEqual(['AI setop 32 0'])
    })

    it('turns it on, at the default ping, for a project that requires it', async () => {
        const session = makeSession()
        await configureLorawan()(session, true, ops(37, '0'))
        expect(session.lines).toEqual(['AI setop 32 720'])
    })

    it('writes nothing when the device already holds it', async () => {
        const session = makeSession()
        await configureLorawan()(session, true, ops(37, '720'))
        expect(session.lines).toEqual([])
    })

    it('leaves op32 alone on firmware where it was the hi-res switch', async () => {
        // Before ae_review the table stopped at op33 and op32 was CAM_RESOLUTION
        const session = makeSession()
        await configureLorawan()(session, false, ops(34, '0'))
        expect(session.lines).toEqual([])
    })
})
