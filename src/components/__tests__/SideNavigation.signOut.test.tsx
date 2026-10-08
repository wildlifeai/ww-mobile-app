import { render, screen, fireEvent, waitFor } from '@testing-library/react-native'

import { SideNavigation } from '../SideNavigation'
import { logout as logoutAction } from '../../redux/slices/authSlice'

/**
 * #360. The side menu's Sign out cleared the app's state only, so the Supabase
 * session stayed in storage and the next launch signed the same account back
 * in. It now goes through the same sign-out as the rest of the app.
 */

const mockDispatch = jest.fn()
const mockAuthLogout = jest.fn()
const mockState = {
    authentication: { user: { id: 'user-1', email: 'tama@ww.org' }, token: 'access-token' },
}

jest.mock('../../services/auth', () => ({
    logout: () => mockAuthLogout(),
    login: jest.fn(),
    register: jest.fn(),
    getCurrentSession: jest.fn(),
    isAuthenticated: jest.fn(),
    resetPassword: jest.fn(),
    updatePassword: jest.fn(),
}))
jest.mock('../../redux', () => ({
    useAppDispatch: () => mockDispatch,
    useAppSelector: (selector: (state: typeof mockState) => unknown) => selector(mockState),
}))
jest.mock('../../hooks/useAppNavigation', () => ({ useAppNavigation: () => ({ navigate: jest.fn() }) }))
jest.mock('../../theme', () => ({ useExtendedTheme: () => ({ spacing: 8, appPadding: 8, colors: {} }) }))
jest.mock('../../hooks/useUserOrganisations', () => ({ useUserOrganisations: () => ({ canSwitchOrganisations: false }) }))
jest.mock('../../hooks/useEngineerConnect', () => ({
    useEngineerConnect: () => ({
        dialogState: 'idle', discoveredDevices: [], connectingDevice: null,
        beginScan: jest.fn(), selectDevice: jest.fn(), reset: jest.fn(),
    }),
}))
jest.mock('../../services/InvitationService', () => ({
    __esModule: true,
    default: {
        getPendingInvitationCount: async () => 0,
        subscribeToInvitations: jest.fn(),
        unsubscribeFromInvitations: jest.fn(),
    },
}))
jest.mock('../../utils/logger', () => ({ log: jest.fn(), logWarn: jest.fn(), logError: jest.fn() }))
jest.mock('../OrgSwitcher', () => ({ OrgSwitcher: () => null }))
jest.mock('../EngineerConnectDialog', () => ({ EngineerConnectDialog: () => null }))

// The shared setup's paper stub has a ripple that swallows presses.
jest.mock('react-native-paper', () => {
    const React = require('react')
    const { Text, Pressable } = require('react-native')
    return {
        Button: ({ onPress, testID, children }: any) => React.createElement(Pressable, { onPress, testID }, children),
        Divider: () => null,
        Badge: () => null,
        Text,
    }
})

// The first render loads React Native's lazily required modules, about 16 s
// on a cold run here, so it happens once under its own limit and the tests
// keep the default.
beforeAll(() => {
    render(<SideNavigation drawerControls={jest.fn()} />).unmount()
}, 60000)

beforeEach(() => {
    jest.useRealTimers()   // the shared setup turns fake timers on for every test
    mockAuthLogout.mockResolvedValue(undefined)
})

describe('SideNavigation Sign out', () => {
    it('ends the Supabase session, then clears the app state and closes the drawer', async () => {
        const drawerControls = jest.fn()
        render(<SideNavigation drawerControls={drawerControls} />)

        fireEvent.press(screen.getByTestId('sign-out-button'))

        await waitFor(() => expect(mockDispatch).toHaveBeenCalledWith(logoutAction()))
        expect(mockAuthLogout).toHaveBeenCalledTimes(1)
        expect(drawerControls).toHaveBeenCalledWith(false)
    })

    it('still clears the app state when the sign-out fails', async () => {
        mockAuthLogout.mockRejectedValue(new Error('storage unavailable'))
        render(<SideNavigation drawerControls={jest.fn()} />)

        fireEvent.press(screen.getByTestId('sign-out-button'))

        await waitFor(() => expect(mockDispatch).toHaveBeenCalledWith(logoutAction()))
    })
})
