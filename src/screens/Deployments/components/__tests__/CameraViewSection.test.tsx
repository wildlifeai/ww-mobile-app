import { Alert } from 'react-native'
import { render, screen } from '@testing-library/react-native'

import { CameraViewSection } from '../CameraViewSection'
import { useCapturePreview } from '../../../../hooks/useCapturePreview'

jest.mock('../../../../hooks/useCapturePreview', () => ({ useCapturePreview: jest.fn() }))
jest.mock('../../../../components/ui/WWBleDisconnectedBanner', () => ({ WWBleDisconnectedBanner: () => null }))
jest.mock('../../../../utils/logger', () => ({ log: jest.fn(), logWarn: jest.fn(), logError: jest.fn() }))
jest.mock('react-native-paper', () => {
    const React = require('react')
    const RN = require('react-native')
    const Box = ({ children }: any) => React.createElement(RN.View, null, children)
    return {
        Card: Object.assign(Box, { Title: () => null, Content: Box }),
        Button: Box,
        Text: ({ children }: any) => React.createElement(RN.Text, null, children),
        ProgressBar: () => null,
        useTheme: () => ({ colors: { primary: 'green' } }),
    }
})
// WWButton's error line imports the theme module, which builds the navigation themes when it loads
jest.mock('../../../../theme', () => ({ useExtendedTheme: () => ({ colors: {}, spacing: 16 }) }))

const device = { id: 'dev-1', name: 'WILD-DJZQ', connected: true } as any

const view = (preview: Partial<ReturnType<typeof useCapturePreview>> = {}) => {
    ;(useCapturePreview as jest.Mock).mockReturnValue({
        startCapture: jest.fn(),
        isCapturing: false,
        capturedImageUri: null,
        captureProgress: 0,
        ...preview,
    })
    render(<CameraViewSection device={device} onImageCaptured={jest.fn()} onShowHelp={jest.fn()} />)
}

/** Start Monitoring's test photo, in the same words as Capture Picture. */
describe('CameraViewSection', () => {
    it('labels the button in plain words', () => {
        view()
        expect(screen.getByText('Take Test Photo')).toBeTruthy()
        view({ capturedImageUri: 'file:///cache/59200A50.JPG' })
        expect(screen.getByText('Take Another Photo')).toBeTruthy()
    })

    it('says what is happening in one line, in the step list\'s words', () => {
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
