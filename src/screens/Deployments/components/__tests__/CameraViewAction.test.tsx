import { Alert } from 'react-native'
import { render, screen, fireEvent } from '@testing-library/react-native'

import { CameraViewAction } from '../CameraViewAction'
import { useCapturePreview } from '../../../../hooks/useCapturePreview'

jest.mock('../../../../hooks/useCapturePreview', () => ({ useCapturePreview: jest.fn() }))
jest.mock('../../../../utils/logger', () => ({ log: jest.fn(), logWarn: jest.fn(), logError: jest.fn() }))

const view = (preview: Partial<ReturnType<typeof useCapturePreview>> = {}, connected = true) => {
    const startCapture = jest.fn()
    ;(useCapturePreview as jest.Mock).mockReturnValue({
        startCapture,
        isCapturing: false,
        capturedImageUri: null,
        captureProgress: 0,
        ...preview,
    })
    render(
        <CameraViewAction
            device={{ id: 'dev-1', name: 'WILD-DJZQ', connected } as any}
            onImageCaptured={jest.fn()}
            onShowHelp={jest.fn()}
        />,
    )
    return startCapture
}

/** Start Monitoring's Camera View: the Watcher's own picture, in Capture Picture's words. */
describe('CameraViewAction', () => {
    beforeEach(() => jest.clearAllMocks())

    it('takes the picture as soon as the row is tapped', () => {
        const startCapture = view()
        fireEvent.press(screen.getByLabelText('Camera View'))
        expect(startCapture).toHaveBeenCalledTimes(1)
    })

    it('does not ask a disconnected camera for a picture, and says why', () => {
        const startCapture = view({}, false)
        fireEvent.press(screen.getByLabelText('Camera View'))
        expect(startCapture).not.toHaveBeenCalled()
        expect(screen.getByText('Not connected to the camera.')).toBeTruthy()
    })

    // The popup renders in Paper's portal, outside the navigation container, so
    // nothing in it may call useNavigation (it crashed the app on 26 October 2026)
    it('renders its popup without navigation', () => {
        const nav = require('@react-navigation/native')
        const spy = jest.spyOn(nav, 'useNavigation')
        view({}, false)
        expect(spy).not.toHaveBeenCalled()
        spy.mockRestore()
    })

    it("says what is happening in one line, in the step list's words", () => {
        view({ isCapturing: true })
        expect(screen.getByText('Taking the picture…')).toBeTruthy()
        view({ isCapturing: true, captureProgress: 0.45 })
        expect(screen.getByText('Transferring the picture…')).toBeTruthy()
        expect(screen.queryByText(/%/)).toBeNull()
    })

    it('raises the same alert as Capture Picture when the capture fails', () => {
        const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {})
        view()
        const { onError } = (useCapturePreview as jest.Mock).mock.calls[0][0]
        onError(new Error('TIMEOUT'))
        expect(alert).toHaveBeenCalledWith('Capture failed', 'TIMEOUT')
    })
})
