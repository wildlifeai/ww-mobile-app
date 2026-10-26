import { fireEvent, render } from '@testing-library/react-native'

import { StatusInitializationHeader } from '../InitializationHeader'
import { batteryLowWarning, NEWER_AI_FIRMWARE } from '../../../../utils/initWarnings'

const theme = { colors: { errorContainer: '#fdd', error: '#c00', onErrorContainer: '#300', primary: '#0a0' } }
const REPORT = 'You can still start monitoring, but please report these errors.'

const show = (deviceHealth: string[]) => render(
    <StatusInitializationHeader
        isInitializing={false}
        initProgress={1}
        initStep=""
        initErrors={{ deviceHealth }}
        theme={theme}
        warningHintText={REPORT}
    />,
)

/**
 * A low battery is the user's to fix. The banner said "Hardware: Battery is
 * low" over "please report these errors", and people reported their batteries.
 */
describe('StatusInitializationHeader battery line', () => {
    it('says to replace the batteries, and asks for no report, when the battery is all there is', () => {
        const { queryByText } = show([batteryLowWarning(12)])

        expect(queryByText('• Battery is low (12%). Replace the batteries before deploying.')).toBeTruthy()
        expect(queryByText(REPORT)).toBeNull()
        expect(queryByText(/Hardware: Battery/)).toBeNull()
    })

    it('still asks for a report of a real fault, with the battery line apart from it', () => {
        const { queryByText } = show([batteryLowWarning(12), 'Main Camera Error (Bit 8)'])

        expect(queryByText('• Hardware: Main Camera Error (Bit 8)')).toBeTruthy()
        expect(queryByText('• Battery is low (12%). Replace the batteries before deploying.')).toBeTruthy()
        expect(queryByText(REPORT)).toBeTruthy()
    })

    it('shows one battery line when the self-test bit and the reading both say so', () => {
        const { queryAllByText } = show([batteryLowWarning(), batteryLowWarning(12)])

        expect(queryAllByText(/Battery is low/)).toHaveLength(1)
        expect(queryAllByText(/Battery is low \(12%\)/)).toHaveLength(1)
    })
})

/**
 * A banner of minor lines only (utils/initWarnings.ts) can be dismissed; one
 * with a fault cannot, and keeps asking for a report.
 */
describe('StatusInitializationHeader Dismiss', () => {
    it('offers Dismiss for minor lines only, lists them without "Hardware:", and hides on the press', () => {
        const { queryByText, getByText } = show([NEWER_AI_FIRMWARE, batteryLowWarning(12)])

        expect(queryByText('• ' + NEWER_AI_FIRMWARE)).toBeTruthy()
        expect(queryByText(/Hardware:/)).toBeNull()
        fireEvent.press(getByText('Dismiss'))

        expect(queryByText(/Initialization Warnings/)).toBeNull()
    })

    it('offers no Dismiss when there is a fault', () => {
        const { queryByText } = show([batteryLowWarning(12), 'Main Camera Error (Bit 8)'])

        expect(queryByText('Dismiss')).toBeNull()
        expect(queryByText(REPORT)).toBeTruthy()
    })

    it('comes back with a line that was not there when it was dismissed', () => {
        const props = { isInitializing: false, initProgress: 1, initStep: '', theme, warningHintText: REPORT }
        const { getByText, queryByText, rerender } = render(
            <StatusInitializationHeader {...props} initErrors={{ deviceHealth: [batteryLowWarning(12)] }} />,
        )
        fireEvent.press(getByText('Dismiss'))
        expect(queryByText(/Initialization Warnings/)).toBeNull()

        rerender(<StatusInitializationHeader {...props} initErrors={{ deviceHealth: [batteryLowWarning(12), NEWER_AI_FIRMWARE] }} />)

        expect(queryByText(/Initialization Warnings/)).toBeTruthy()
    })
})
