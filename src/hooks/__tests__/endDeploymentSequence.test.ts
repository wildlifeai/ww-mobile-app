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
const endDeployment = DeploymentService.endDeployment as jest.Mock

const LORAWAN_OFF = "LoRaWAN is off. Use 'AI setop 32 <minutes>' or 'join'"

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

/** The camera sends a line over Bluetooth. */
const say = (line: string) => rxRouter.handleIncomingBytes(DEVICE_ID, Buffer.from(`${line}\n`))

const resetLink = () => {
    mockWrite.mockReset()
    endDeployment.mockReset()
    bleTransport.clearAll()
    rxRouter.clearBuffer(DEVICE_ID)
}

const run = (progress: any) => endDeploymentSequence({
    bleDevice, deploymentId: 'dep-1', userId: 'user-1', notes: '', quiesceDevice, progress, disconnect: true,
})

/**
 * #293, as the operator meets it: Stop Monitoring against a camera asleep in its
 * motion loop. It used to sit under "Disconnecting" for about 40 s.
 */
describe('endDeploymentSequence against a camera that does not answer', () => {
    beforeEach(() => {
        jest.useFakeTimers()
        resetLink()
        // The nRF answers `ping` and `dis`; the Himax answers nothing.
        mockWrite.mockImplementation(async (_p: unknown, payload: string) => {
            if (payload === 'ping') say(LORAWAN_OFF)
            if (payload === 'dis') say('Disconnecting')
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
        const ending = run(progress).then(r => { result = r })

        await jest.advanceTimersByTimeAsync(8_100)
        await ending

        expect(result).toEqual({ cameraAnswered: false })
        // One probe, then nothing more for the Himax; `dis` still went.
        const sent = mockWrite.mock.calls.map((c: any[]) => c[1])
        expect(sent).toEqual(['ping', 'AI getop -1', 'dis'])
        expect(Date.now() - started).toBeLessThanOrEqual(8_100)

        expect(endDeployment).toHaveBeenCalledWith('dep-1', 'user-1', '')
        expect(progress.steps).toContain(END_DEPLOYMENT_CAMERA_COPY.step)
        expect(progress.logs).toContain(END_DEPLOYMENT_CAMERA_COPY.gaveUp)
        expect(progress.logs).toContain(END_DEPLOYMENT_CAMERA_COPY.notStopped)
        expect(progress.logs).not.toContain('Device stopped')
        expect(progress.logs).toContain('Device disconnected')
    })
})

/**
 * #557: a LoRaWAN deployment sends a final check-in, then the record ends, then
 * LoRaWAN goes off, so the check-in falls inside the deployment and the camera
 * stops checking in once collected.
 */
describe('endDeploymentSequence on a LoRaWAN deployment', () => {
    /** Everything the camera was sent, and where the record's end came among it. */
    let order: string[]

    /**
     * A camera that answers every command, with op 32 at `op32`. After a `ping`
     * the nRF says `pingReply` and, 5 s later, `uplink`, as the network answers.
     */
    const camera = ({ op32, pingReply = 'OK', uplink }: { op32: string; pingReply?: string; uplink?: string }) => {
        const ops = Array(37).fill('0')
        ops[32] = op32
        mockWrite.mockImplementation(async (_p: unknown, payload: string) => {
            order.push(payload.replace(/^(AI set(?:did|gps)) .*/, '$1'))
            const setop = /^AI setop (\d+) (\d+)$/.exec(payload)
            if (payload === 'ping') {
                say(pingReply)
                if (uplink) setTimeout(() => say(uplink), 5_000)
            } else if (payload === 'AI getop -1') say(`OpParams ${ops.join(' ')}`)
            else if (payload.startsWith('AI setdid')) say('Deployment ID set to 00000000-0000-0000-0000-000000000000')
            else if (payload.startsWith('AI setgps')) say('Device GPS set')
            else if (setop) say(`Set OpParam ${setop[1]} = ${setop[2]}`)
            else if (payload === 'dis') say('Disconnecting')
            return true
        })
    }

    /** Run the sequence to its end, letting the camera's 5 s go by. */
    const stop = async () => {
        const progress = fakeProgress()
        let result: { cameraAnswered: boolean } | undefined
        const ending = run(progress).then(r => { result = r })
        await jest.advanceTimersByTimeAsync(40_000)
        await ending
        return { progress, result }
    }

    beforeEach(() => {
        jest.useFakeTimers()
        resetLink()
        order = []
        endDeployment.mockImplementation(async () => { order.push('record ended') })
    })

    afterEach(() => {
        bleTransport.clearAll()
        rxRouter.clearBuffer(DEVICE_ID)
        jest.useRealTimers()
    })

    it('sends a final check-in, waits for its acknowledgement, ends the record, then turns LoRaWAN off', async () => {
        camera({ op32: '240', uplink: 'Uplink message acknowledged.' })
        const { progress, result } = await stop()

        expect(result).toEqual({ cameraAnswered: true })
        expect(order).toEqual([
            'ping', 'AI getop -1', 'AI setdid', 'AI setgps', 'record ended', 'AI setop 32 0', 'AI setop 11 0', 'dis',
        ])
        expect(progress.logs).toContain('Sending a final LoRaWAN check-in...')
        expect(progress.logs).toContain('LoRaWAN: final check-in received')
        expect(progress.logs).toContain('LoRaWAN turned off')
        expect(progress.logs).toContain('Device stopped')
    })

    it('still ends the deployment and turns LoRaWAN off when the check-in is not acknowledged, and says so', async () => {
        camera({ op32: '240', uplink: 'Uplink message NOT acknowledged.' })
        const { progress, result } = await stop()

        expect(result).toEqual({ cameraAnswered: true })
        expect(order).toEqual([
            'ping', 'AI getop -1', 'AI setdid', 'AI setgps', 'record ended', 'AI setop 32 0', 'AI setop 11 0', 'dis',
        ])
        expect(progress.logs).toContain('LoRaWAN: the final check-in did not get through, no gateway acknowledged it')
        expect(progress.logs).toContain('LoRaWAN turned off')
    })

    it('sends no check-in and leaves op 32 alone on a deployment without LoRaWAN', async () => {
        camera({ op32: '0', pingReply: LORAWAN_OFF })
        const { progress } = await stop()

        expect(order).toEqual(['ping', 'AI getop -1', 'AI setdid', 'AI setgps', 'record ended', 'AI setop 11 0', 'dis'])
        expect(progress.logs.filter((line: string) => /LoRaWAN/.test(line))).toEqual([])
    })
})
