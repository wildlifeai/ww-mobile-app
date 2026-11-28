import { render, screen } from '@testing-library/react-native'

import { FinishProgressDialog } from '../FinishProgressDialog'
import { FINISH_STEP_COMPLETE } from '../../../../hooks/useDeploymentProgress'

jest.mock('../../../../utils/logger', () => ({ log: jest.fn(), logWarn: jest.fn(), logError: jest.fn() }))

// The global paper mock has no Modal; the dialog only needs its words here
jest.mock('react-native-paper', () => {
    const React = require('react')
    const RN = require('react-native')
    const pass = ({ children }: any) => React.createElement(RN.View, null, children)
    return {
        Portal: pass,
        Modal: pass,
        Card: Object.assign(pass, { Content: pass }),
        Text: ({ children }: any) => React.createElement(RN.Text, null, children),
        Button: ({ children }: any) => React.createElement(RN.Text, null, children),
        ProgressBar: () => null,
        IconButton: () => null,
        useTheme: () => ({ colors: {} }),
    }
})

const LOGS = ['Record updated successfully', 'Finalizing stop...', 'Device disconnected']
// END_DEPLOYMENT_CAMERA_COPY.finalStep, the last step when the camera did not answer
const NOT_ANSWERING = 'Ended. The camera did not answer, so it keeps taking pictures'

const dialog = (isComplete: boolean, step: string) =>
    render(
        <FinishProgressDialog
            visible
            progress={isComplete ? 1 : 0.5}
            step={step}
            logs={LOGS}
            isComplete={isComplete}
            onDismiss={jest.fn()}
            loadingTitle="Stopping Monitoring"
            successTitle="Monitoring Stopped"
            hideOkButton
        />,
    )

/**
 * #575: Monitoring Stopped showed the step log under the tick. A clean finish
 * is the tick and the title; the log stays while it runs, and when it ends
 * with something to say, such as a camera that did not answer (#293).
 */
describe('FinishProgressDialog', () => {
    it('shows only the title on a clean finish', () => {
        dialog(true, FINISH_STEP_COMPLETE)

        expect(screen.getByText('Monitoring Stopped')).toBeTruthy()
        expect(screen.queryByText(FINISH_STEP_COMPLETE)).toBeNull()
        expect(screen.queryByText('> Device disconnected')).toBeNull()
    })

    it('keeps the step and the log on a finish with something to say', () => {
        dialog(true, NOT_ANSWERING)

        expect(screen.getByText('Monitoring Stopped')).toBeTruthy()
        expect(screen.getByText(NOT_ANSWERING)).toBeTruthy()
        expect(screen.getByText('> Device disconnected')).toBeTruthy()
    })

    it('shows the step and the log while it runs', () => {
        dialog(false, 'Finalizing...')

        expect(screen.getByText('Stopping Monitoring')).toBeTruthy()
        expect(screen.getByText('Finalizing...')).toBeTruthy()
        expect(screen.getByText('> Record updated successfully')).toBeTruthy()
    })
})
