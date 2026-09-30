import { endDeploymentSequence, END_DEPLOYMENT_CAMERA_COPY } from '../useMonitoringActions'
import { commandRegistry } from '../../ble/protocol/commandRegistry'
import { bleTransport } from '../../ble/protocol/bleTransportController'
import { rxRouter } from '../../ble/protocol/rxRouter'
import { DeploymentService } from '../../services/DeploymentService'
import * as transport from '../../ble/transport'

jest.mock('../../ble/transport', () => ({ writeToDevice: jest.fn() }))
jest.mock('../../services/DeploymentService', () => ({ DeploymentService: { endDeployment: jest.fn(async () => {}) } }))
jest.mock('../../utils/logger', () => ({ log: jest.fn(), logWarn: jest.fn(), logError: jest.fn() }))

const DEVICE_ID = 'seq_dev'
const bleDevice = { id: DEVICE_ID, name: 'WILD-TEST', connected: true } as any
const mockWrite = transport.writeToDevice as jest.Mock

const fakeProgress = () => {
    const logs: string[] = []
    const steps: string[] = []
    return {
        logs, steps,
        addLog: (m: string) => { logs.push(m) },
        setFinishStep: (s: string) => { steps.push(s) },
        setFinishProgress: jest.fn(),
    } as any
}

/** Stands in for `useDeviceSettings.quiesceDevice`: it clears op11 through the session it is given. */
const quiesceDevice = jest.fn(async (_d: unknown, options?: any) => {
    try {
        await options.sessionScope.execute(() => commandRegistry.setop({ index: 11, value: '0' }))
    } catch {
        // quiesceDevice logs a failed step and carries on
    }
})

/**
 * #293, as the operator meets it: Stop Monitoring against a camera asleep in its
 * motion loop. It used to sit under "Disconnecting" for about 40 s.
 */
describe('endDeploymentSequence against a camera that does not answer', () => {
    beforeEach(() => {
        jest.useFakeTimers()
        mockWrite.mockReset()
        bleTransport.clearAll()
        rxRouter.clearBuffer(DEVICE_ID)
        // The nRF answers `dis`; the Himax answers nothing.
        mockWrite.mockImplementation(async (_p: unknown, payload: string) => {
            if (payload === 'dis') rxRouter.handleIncomingBytes(DEVICE_ID, Buffer.from('Disconnecting\n'))
            return true
        })
    })

    afterEach(() => {
        bleTransport.clearAll()
        rxRouter.clearBuffer(DEVICE_ID)
        jest.useRealTimers()
    })

    it('gives up after one probe, says so, ends the record and still disconnects', async () => {
        const progress = fakeProgress()
        const started = Date.now()
        let result: { cameraAnswered: boolean } | undefined
        const run = endDeploymentSequence({
            bleDevice, deploymentId: 'dep-1', userId: 'user-1', notes: '', quiesceDevice, progress, disconnect: true,
        }).then(r => { result = r })

        await jest.advanceTimersByTimeAsync(8_100)
        await run

        expect(result).toEqual({ cameraAnswered: false })
        // One probe, then nothing more for the Himax; `dis` still went.
        const sent = mockWrite.mock.calls.map((c: any[]) => c[1])
        expect(sent).toEqual(['AI getop -1', 'dis'])
        expect(Date.now() - started).toBeLessThanOrEqual(8_100)

        expect(DeploymentService.endDeployment).toHaveBeenCalledWith('dep-1', 'user-1', '')
        expect(progress.steps).toContain(END_DEPLOYMENT_CAMERA_COPY.step)
        expect(progress.logs).toContain(END_DEPLOYMENT_CAMERA_COPY.gaveUp)
        expect(progress.logs).toContain(END_DEPLOYMENT_CAMERA_COPY.notStopped)
        expect(progress.logs).not.toContain('Device stopped')
        expect(progress.logs).toContain('Device disconnected')
    })
})
