import { render, screen, fireEvent, waitFor } from '@testing-library/react-native'

import { MotionTestAction } from '../MotionTestAction'
import { useMotionDetectionStream } from '../../../Devices/hooks/useMotionDetectionStream'
import ReferenceDataService from '../../../../services/ReferenceDataService'
import { configureDevice } from '../../../../ble/workflows/deploymentPipeline'

jest.mock('../../../Devices/hooks/useMotionDetectionStream')
jest.mock('../../../Devices/components/MotionGrid', () => ({ MotionGrid: () => null }))
jest.mock('../../../../services/ReferenceDataService', () => ({
    __esModule: true,
    default: { getActivitySensitivity: jest.fn() },
}))
jest.mock('../../../../utils/logger', () => ({ log: jest.fn(), logWarn: jest.fn(), logError: jest.fn() }))

const device = { id: 'dev-1', name: 'WILD-TEST', connected: true } as any

/**
 * Deliberately not 1, 2, 3: ids are per tier, and the test used to send the
 * id itself as the level, which only worked while the seed's ids happened to
 * match the levels (#272).
 */
const SENSITIVITIES = [
    { id: 41, value: 'high', description: '' },
    { id: 42, value: 'low', description: '' },
    { id: 43, value: 'medium', description: '' },
]

const stream = (overrides: Record<string, unknown> = {}) => {
    const startTest = jest.fn(async () => {})
    ;(useMotionDetectionStream as jest.Mock).mockReturnValue({
        mdGrid: '', isTesting: false, testFinished: false, startTest, mdBlocksCount: 0,
        motionDetected: false, frameCount: 0, statusMessage: '', sensitivityNote: null, frameHistory: [],
        ...overrides,
    })
    return startTest
}

const renderAction = (activity_detection_sensitivity_id: number | null, capture_method_id = 1) =>
    render(
        <MotionTestAction
            device={device}
            project={{ activity_detection_sensitivity_id, capture_method_id }}
            onShowHelp={jest.fn()}
        />,
    )

const startWith = async (activity_detection_sensitivity_id: number | null) => {
    const startTest = stream()
    ;(ReferenceDataService.getActivitySensitivity as jest.Mock).mockResolvedValue(SENSITIVITIES)
    renderAction(activity_detection_sensitivity_id)
    // Opening the popup starts the test
    fireEvent.press(screen.getByLabelText('Test Motion Detection'))
    await waitFor(() => expect(startTest).toHaveBeenCalled())
    return startTest.mock.calls[0] as unknown[]
}

describe('MotionTestAction sensitivity', () => {
    beforeEach(() => jest.clearAllMocks())

    it("sends the reference row's level, not its id", async () => {
        const [level] = await startWith(42)
        expect(level).toBe(1)
    })

    it('tests at medium when the project has no sensitivity', async () => {
        const [level] = await startWith(null)
        expect(level).toBe(2)
        expect(ReferenceDataService.getActivitySensitivity).not.toHaveBeenCalled()
    })

    it('tests at medium when the id is not in the reference data', async () => {
        const [level] = await startWith(3)
        expect(level).toBe(2)
    })

    // The test holds op11 at its interval, so it tests the detector at the
    // rate the deployment will run it (#274).
    it('tests at the motion interval the deployment writes', async () => {
        const [, intervalMs] = await startWith(42)

        const startConfigure = jest.fn(async () => {})
        await configureDevice(device, startConfigure, {
            deploymentId: 'd', captureMethodId: 1, timelapseInterval: 300, recordGpsInImages: false,
        }, { addLog: jest.fn(), setStep: jest.fn(), setProgress: jest.fn() })

        expect((startConfigure.mock.calls[0] as unknown[])[1]).toMatchObject({ motionInterval: intervalMs })
    })
})

describe('MotionTestAction row', () => {
    beforeEach(() => jest.clearAllMocks())

    it('is not there for a time-lapse project', () => {
        stream()
        renderAction(42, 2)
        expect(screen.queryByLabelText('Test Motion Detection')).toBeNull()
    })

    it('says whether a finished test saw motion', () => {
        stream({ testFinished: true, frameHistory: [{ blockCount: 0 }, { blockCount: 3 }] })
        renderAction(42)
        expect(screen.getAllByText('Motion seen').length).toBeGreaterThan(0)
    })

    // With a wake threshold, only a frame that would have woken the camera counts (#500)
    it('counts only frames that would have woken the camera', () => {
        stream({ testFinished: true, frameHistory: [{ blockCount: 3, wouldWake: false }] })
        renderAction(42)
        expect(screen.getAllByText('No motion').length).toBeGreaterThan(0)
        expect(screen.queryByText('Motion seen')).toBeNull()
    })

    it('does not restart a finished test when reopened', () => {
        const startTest = stream({ testFinished: true, frameHistory: [] })
        renderAction(42)
        fireEvent.press(screen.getByLabelText('Test Motion Detection'))
        expect(startTest).not.toHaveBeenCalled()
    })
})
