import { render, screen } from '@testing-library/react-native'

import { CapturePictureSection } from '../CapturePictureSection'
import { useCapturePicture } from '../../hooks/useCapturePicture'
import {
    CaptureStepsState, idleState, begin, settingsApplied, deviceLine, transferProgress, imageSaved, failed,
} from '../../../../utils/captureSteps'

jest.mock('../../hooks/useCapturePicture', () => ({ useCapturePicture: jest.fn() }))
jest.mock('../../../../hooks/useDeviceSelfTest', () => ({
    useDeviceSelfTest: () => ({ issues: [], isChecking: false, refresh: jest.fn() }),
}))
jest.mock('../../../../hooks/useDeviceSettings', () => ({ FLASH_LED_LABELS: {} }))
// The settings, banners and modal are their own components; this test is about the step list
jest.mock('../../../../components/device/CameraModeSelector', () => ({ CameraModeSelector: () => null }))
jest.mock('../../../../components/device/FlashSelector', () => ({ FlashSelector: () => null }))
jest.mock('../../../../components/DeviceHealthBanner', () => ({ DeviceHealthBanner: () => null }))
jest.mock('../../../../components/ui/WWBleDisconnectedBanner', () => ({ WWBleDisconnectedBanner: () => null }))
jest.mock('../../../../components/ImagePreviewModal', () => ({ ImagePreviewModal: () => null }))
jest.mock('react-native-paper', () => {
    const React = require('react')
    const RN = require('react-native')
    const Box = ({ children }: any) => React.createElement(RN.View, null, children)
    return {
        Surface: Box,
        Divider: Box,
        Button: Box,
        Text: ({ children }: any) => React.createElement(RN.Text, null, children),
        ActivityIndicator: () => null,
        Icon: () => null,
        ProgressBar: () => null,
    }
})
// The theme module builds the navigation themes when it loads; the list needs a few colours
jest.mock('../../../../theme', () => ({
    useExtendedTheme: () => ({ colors: { error: 'red', primary: 'green', onSurfaceVariant: 'grey', surface: 'white' }, spacing: 16 }),
}))

const T0 = 1_000_000
const device = { id: 'dev-1', name: 'WILD-DJZQ', connected: true } as any

/** A run through the device's own lines up to the byte count. */
const throughBytesIn = (): CaptureStepsState => {
    let s = settingsApplied(begin(), false)
    s = deviceLine(s, 'About to capture 1 image with an interval of \'500\' milliseconds', T0)
    s = deviceLine(s, 'AE light check: AGain = 0, conv=Y -> BRIGHT (change)', T0 + 900)
    s = deviceLine(s, 'Captured 1 images. Last is 59200A50.JPG (File write 51ms avg.)', T0 + 1500)
    return deviceLine(s, '19354 bytes in 59200A50.JPG', T0 + 1600)
}

/** The screen with the run in `state`; nothing in flight unless `isCapturing`. */
const view = (state: CaptureStepsState, { isCapturing = false, captureStage = '' } = {}) => {
    ;(useCapturePicture as jest.Mock).mockReturnValue({
        cameraParams: { flashLed: 0, ledBrightness: 5 },
        updateCameraParam: jest.fn(),
        applyAndCapture: jest.fn(),
        isApplying: false,
        aeData: null,
        capturedImages: [],
        capturePreview: { isCapturing, captureStage },
        captureSteps: { state, now: T0 + 3600 },
    })
    render(<CapturePictureSection device={device} />)
}

/**
 * The step list is the record of the last capture: what the file was called,
 * what the light check said, how long the transfer took, or why it failed.
 * It used to vanish the moment the picture landed, taking all of that with it.
 */
describe('CapturePictureSection step list', () => {
    it('shows nothing before the first capture', () => {
        view(idleState())
        expect(screen.getByText('Capture Image')).toBeTruthy()
        expect(screen.queryByText('Taking the picture')).toBeNull()
    })

    it('stays up after the picture lands, with the file, the verdict and the transfer', () => {
        view(imageSaved(throughBytesIn(), T0 + 3600))
        expect(screen.getByText('59200A50.JPG')).toBeTruthy()
        expect(screen.getByText('Bright, no flash')).toBeTruthy()
        expect(screen.getByText('18.9 KB in 2.0 s')).toBeTruthy()
    })

    it('stays up after a failure, with the reason on the step that failed', () => {
        view(failed(settingsApplied(begin(), true), 'TIMEOUT'))
        expect(screen.getByText('TIMEOUT')).toBeTruthy()
    })

    it('shows why a transfer failed instead of a countdown that stopped', () => {
        const s = failed(transferProgress(throughBytesIn(), 0.4, T0 + 2200), 'Image transfer incomplete, only 40% received')
        view(s)
        expect(screen.getByText('Image transfer incomplete, only 40% received')).toBeTruthy()
        expect(screen.queryByText(/left$/)).toBeNull()
    })

    it('has no stage line under the steps while a capture runs', () => {
        view(settingsApplied(begin(), false), { isCapturing: true, captureStage: 'Waiting for device…' })
        expect(screen.getByText('Waiting for the camera to sleep, then waking it')).toBeTruthy()
        expect(screen.queryByText('Waiting for device…')).toBeNull()
    })
})
