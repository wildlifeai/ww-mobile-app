import { render, screen, fireEvent } from '@testing-library/react-native'
import { Dialog } from 'react-native-paper'

import { BatteryAction, SdCardAction, SoftwareAction } from '../DeviceCheckActions'
import { batteryLowWarning } from '../../../../utils/initWarnings'

const firmware = (extra: Record<string, unknown> = {}) => ({
    isChecking: false,
    lastChecked: new Date(),
    errorMsg: null,
    checkStatus: jest.fn(),
    statuses: {},
    ...extra,
}) as any

// #529: Check Software says one thing about the camera's software, and offers
// one Update software; the processors and their versions are the Engineer Console's
describe('SoftwareAction', () => {
    beforeEach(() => jest.clearAllMocks())

    it('says nothing on the row until a check has found the latest builds', () => {
        render(<SoftwareAction firmwareStatus={firmware()} softwareState="not_checked" onShowHelp={jest.fn()} />)
        expect(screen.queryByText('Up to date')).toBeNull()
        expect(screen.getByText('Not checked')).toBeTruthy()
    })

    it('says up to date with no button and no processors, and checks again when opened', () => {
        const status = firmware()
        render(<SoftwareAction firmwareStatus={status} softwareState="up_to_date" onUpdateSoftware={jest.fn()} onShowHelp={jest.fn()} />)
        expect(screen.getAllByText('Up to date').length).toBeGreaterThan(0)
        expect(screen.queryByText('Update software')).toBeNull()
        expect(screen.queryByText(/Bluetooth|AI processor/)).toBeNull()
        fireEvent.press(screen.getByLabelText('Check Software'))
        expect(status.checkStatus).toHaveBeenCalledTimes(1)
    })

    it.each([
        ['available', 'Update available'],
        ['unfinished', 'Update not finished'],
    ] as const)('when %s, offers Update software and closes the popup before it opens', (state, words) => {
        const onUpdate = jest.fn()
        render(<SoftwareAction firmwareStatus={firmware()} softwareState={state} onUpdateSoftware={onUpdate} onShowHelp={jest.fn()} />)
        expect(screen.getAllByText(words).length).toBeGreaterThan(0)
        fireEvent.press(screen.getByLabelText('Check Software'))
        expect(screen.UNSAFE_getByType(Dialog).props.visible).toBe(true)
        fireEvent.press(screen.getByText('Update software'))
        expect(onUpdate).toHaveBeenCalledTimes(1)
        // Left open, it stayed drawn over the update screen
        expect(screen.UNSAFE_getByType(Dialog).props.visible).toBe(false)
    })

    it('says the camera did not answer when a check found nothing', () => {
        render(<SoftwareAction firmwareStatus={firmware({ errorMsg: 'timed out' })} softwareState="not_checked" onShowHelp={jest.fn()} />)
        expect(screen.getByText('The camera did not answer. Wake it, then check again.')).toBeTruthy()
    })
})

describe('BatteryAction', () => {
    it('shows the level on the row and the warning at or below 30%', () => {
        render(<BatteryAction batteryLevel={25} onCheck={jest.fn()} onShowHelp={jest.fn()} />)
        expect(screen.getAllByText('25%').length).toBeGreaterThan(0)
        expect(screen.getByText(batteryLowWarning())).toBeTruthy()
    })

    it('does not warn above 30%', () => {
        render(<BatteryAction batteryLevel={78} onCheck={jest.fn()} onShowHelp={jest.fn()} />)
        expect(screen.queryByText(batteryLowWarning())).toBeNull()
    })

    it('reads the battery again when opened, unless the camera cannot answer', () => {
        const onCheck = jest.fn()
        const { rerender } = render(<BatteryAction batteryLevel={78} onCheck={onCheck} onShowHelp={jest.fn()} />)
        fireEvent.press(screen.getByLabelText('Check Battery Level'))
        expect(onCheck).toHaveBeenCalledTimes(1)
        rerender(<BatteryAction batteryLevel={78} onCheck={onCheck} disabled onShowHelp={jest.fn()} />)
        fireEvent.press(screen.getByLabelText('Check Battery Level'))
        expect(onCheck).toHaveBeenCalledTimes(1)
    })
})

describe('SdCardAction', () => {
    const GB = 1024 * 1024 // the camera reports KB

    it('shows the free space on the row and the share in the popup', () => {
        render(<SdCardAction sdCardStatus={{ total: 32 * GB, free: 16 * GB }} onCheck={jest.fn()} onShowHelp={jest.fn()} />)
        expect(screen.getByText('16 GB free')).toBeTruthy()
        expect(screen.getByText('50% free of 32 GB')).toBeTruthy()
        expect(screen.queryByText(/Nearly full/)).toBeNull()
    })

    it('says the card is nearly full at or below 10% free', () => {
        render(<SdCardAction sdCardStatus={{ total: 32 * GB, free: 2 * GB }} onCheck={jest.fn()} onShowHelp={jest.fn()} />)
        expect(screen.getByText(/Nearly full/)).toBeTruthy()
    })
})
