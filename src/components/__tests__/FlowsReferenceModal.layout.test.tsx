import { render, screen, fireEvent } from '@testing-library/react-native'

import { FlowsReferenceModal, FLOWS_HELP } from '../FlowsReferenceModal'
import { CommandNames } from '../../ble/types'

// The same stand-in for paper as CommandReferenceModal.args.test.tsx: the shared
// setup's stub has a ripple that swallows presses.
jest.mock('react-native-paper', () => {
    const React = require('react')
    const { View, Text, Pressable } = require('react-native')
    const Passthrough = ({ children }: any) => React.createElement(View, null, children)
    return {
        Portal: Passthrough,
        Modal: ({ visible, children }: any) => (visible ? React.createElement(View, null, children) : null),
        Divider: () => null,
        Icon: () => null,
        IconButton: ({ onPress, testID }: any) => (testID ? React.createElement(Pressable, { onPress, testID }) : null),
        Text,
        TouchableRipple: ({ onPress, testID, children }: any) => React.createElement(Pressable, { onPress, testID }, children),
        Button: ({ onPress, disabled, testID, children }: any) =>
            React.createElement(Pressable, { onPress, disabled, testID }, children),
        useTheme: () => ({ colors: {}, spacing: 8 }),
        adaptNavigationTheme: () => ({ LightTheme: {}, DarkTheme: {} }),
        MD3LightTheme: { colors: {} },
        MD3DarkTheme: { colors: {} },
    }
})

jest.mock('../ui/HelpDialog', () => {
    const React = require('react')
    const { Text } = require('react-native')
    return {
        HelpDialog: ({ visible, content }: any) => (visible ? React.createElement(Text, null, content) : null),
    }
})

const mount = () => {
    const onRunFlow = jest.fn()
    render(<FlowsReferenceModal visible onDismiss={jest.fn()} onRunFlow={onRunFlow} />)
    return onRunFlow
}

const openGroup = (title: string) => fireEvent.press(screen.getByTestId(`group-${title}`))
const runFor = (name: CommandNames) => screen.getByTestId(`run-${name}`)

// Laid out like the Commands list: toggles, all closed, one open at a time,
// and the explanation behind the ? rather than above the list.
describe('FlowsReferenceModal layout', () => {
    it('opens with every group closed and no explanation above the list', () => {
        mount()

        expect(screen.getByTestId('group-Camera & Sensors')).toBeTruthy()
        expect(screen.getByTestId('group-Tests')).toBeTruthy()
        expect(screen.queryByTestId(`run-${CommandNames.CAPTURE_PICTURE}`)).toBeNull()
        expect(screen.queryByText(FLOWS_HELP)).toBeNull()
    })

    it('keeps one group open at a time', () => {
        mount()

        openGroup('Camera & Sensors')
        expect(runFor(CommandNames.CAPTURE_PICTURE)).toBeTruthy()

        openGroup('Tests')
        expect(runFor(CommandNames.FILE_TRANSFER_TEST)).toBeTruthy()
        expect(screen.queryByTestId(`run-${CommandNames.CAPTURE_PICTURE}`)).toBeNull()

        openGroup('Tests')
        expect(screen.queryByTestId(`run-${CommandNames.FILE_TRANSFER_TEST}`)).toBeNull()
    })

    it('shows how the list works behind the ?', () => {
        mount()

        fireEvent.press(screen.getByTestId('flows-help'))
        expect(screen.getByText(FLOWS_HELP)).toBeTruthy()
    })

    it('runs the flow whose Run was tapped', () => {
        const onRunFlow = mount()

        openGroup('Firmware Updates')
        fireEvent.press(runFor(CommandNames.FIRMWARE_STATUS))
        expect(onRunFlow).toHaveBeenCalledWith(CommandNames.FIRMWARE_STATUS)
    })
})
