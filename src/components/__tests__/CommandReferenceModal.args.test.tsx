import { render, screen, fireEvent } from '@testing-library/react-native'

import { CommandReferenceModal, COMMANDS_HELP } from '../CommandReferenceModal'
import { CommandNames } from '../../ble/types'

// The shared setup stubs paper without the pieces this modal uses, and with a
// ripple that swallows presses. The real library does not load under that
// setup, so this is a stand-in with just enough behaviour to drive the modal.
jest.mock('react-native-paper', () => {
    const React = require('react')
    const { View, Text, Pressable, TextInput } = require('react-native')
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
        TextInput: ({ label, ...props }: any) => React.createElement(TextInput, { accessibilityLabel: label, ...props }),
        HelperText: ({ visible, children }: any) => (visible ? React.createElement(Text, null, children) : null),
        useTheme: () => ({ colors: {}, spacing: 8 }),
        // theme.ts builds its themes from these at import time.
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
    const onRunCommand = jest.fn()
    render(<CommandReferenceModal visible onDismiss={jest.fn()} onRunCommand={onRunCommand} />)
    return onRunCommand
}

const openGroup = (title: string) => fireEvent.press(screen.getByTestId(`group-${title}`))
const runFor = (name: CommandNames) => screen.getByTestId(`run-${name}`)

describe('CommandReferenceModal layout', () => {
    it('opens with every category closed and the processors as plain headings', () => {
        mount()

        expect(screen.getByText('BLE Processor')).toBeTruthy()
        expect(screen.getByText('AI Processor')).toBeTruthy()
        expect(screen.getByTestId('group-Camera Functions')).toBeTruthy()
        expect(screen.queryByTestId(`run-${CommandNames.capture_one}`)).toBeNull()
        expect(screen.queryByText(COMMANDS_HELP)).toBeNull()
    })

    it('keeps one category open at a time', () => {
        mount()

        openGroup('Camera Functions')
        expect(runFor(CommandNames.capture_one)).toBeTruthy()

        openGroup('Clock')
        expect(runFor(CommandNames.getutc)).toBeTruthy()
        expect(screen.queryByTestId(`run-${CommandNames.capture_one}`)).toBeNull()

        openGroup('Clock')
        expect(screen.queryByTestId(`run-${CommandNames.getutc}`)).toBeNull()
    })

    it('shows how the list works behind the ?', () => {
        mount()

        fireEvent.press(screen.getByTestId('commands-help'))
        expect(screen.getByText(COMMANDS_HELP)).toBeTruthy()
    })
})

// #300: tapping Run on a command that takes values asks for them, and only
// Send, with every value valid, reaches the device.
describe('CommandReferenceModal values', () => {
    it('takes an op by name for setop', () => {
        const onRunCommand = mount()
        openGroup('Operational Parameters')

        fireEvent.press(runFor(CommandNames.setop))
        expect(onRunCommand).not.toHaveBeenCalled()
        fireEvent.press(screen.getByText('Send'))
        expect(onRunCommand).not.toHaveBeenCalled()

        fireEvent.changeText(screen.getByLabelText('Index'), 'md_interval')
        expect(screen.getByText('op11 MD_INTERVAL')).toBeTruthy()
        fireEvent.changeText(screen.getByLabelText('Value'), '1000')

        fireEvent.press(screen.getByText('Send'))
        expect(onRunCommand).toHaveBeenCalledWith(CommandNames.setop, ['11', '1000'])
    })

    it('sends a command that takes no values at once', () => {
        const onRunCommand = mount()
        openGroup('Operational Parameters')

        fireEvent.press(runFor(CommandNames.getop_all))
        expect(onRunCommand).toHaveBeenCalledWith(CommandNames.getop_all)
    })

    it('takes one photo in one tap, with no form', () => {
        const onRunCommand = mount()
        openGroup('Camera Functions')

        fireEvent.press(runFor(CommandNames.capture_one))
        expect(onRunCommand).toHaveBeenCalledTimes(1)
        expect(onRunCommand).toHaveBeenCalledWith(CommandNames.capture_one)
        expect(screen.queryByText('Send')).toBeNull()
    })
})
