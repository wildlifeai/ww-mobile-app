import { render, screen, fireEvent } from '@testing-library/react-native'

import { BatteryAction, FirmwareAction, SdCardAction, firmwareWords } from '../DeviceCheckActions'
import { batteryLowWarning } from '../../../../utils/initWarnings'


const BLE = { type: 'ble', currentVersion: '0.30.58', latestVersion: '0.30.58', latestFirmware: null, isOutdated: false }
const HIMAX = {
    type: 'himax', currentVersion: 'WW500_C02 01:06:33 Oct 26 2026', latestVersion: 'WW500_C02 01:06:33 Oct 26 2026',
    latestFirmware: null, isOutdated: false,
}

const firmware = (himax: Record<string, unknown> = {}, ble: Record<string, unknown> = {}) => ({
    isChecking: false,
    lastChecked: new Date(),
    errorMsg: null,
    checkStatus: jest.fn(),
    statuses: { ble: { ...BLE, ...ble }, himax: { ...HIMAX, ...himax } },
}) as any

describe('firmwareWords', () => {
    // #374: an AI update that stopped part way read as up to date
    it('says an AI update that stopped part way is not finished', () => {
        expect(firmwareWords({ ...HIMAX, isOutdated: true, unfinished: { endVariant: 'HM0360', done: 1, total: 2 } } as any))
            .toBe('Update not finished')
    })

    it('says an ordinary update is available', () => {
        expect(firmwareWords({ ...HIMAX, isOutdated: true } as any)).toBe('Update available')
    })

    // #437: only the other camera's build is published
    it('says an update with only one camera built is not ready', () => {
        expect(firmwareWords({ ...HIMAX, missingVariant: true } as any)).toBe('Update not ready')
    })
})

describe('FirmwareAction', () => {
    beforeEach(() => jest.clearAllMocks())

    it('judges nothing until a check has found the latest builds', () => {
        render(<FirmwareAction firmwareStatus={firmware({ latestVersion: null }, { latestVersion: null })} onShowHelp={jest.fn()} />)
        expect(screen.queryByText('Up to date')).toBeNull()
        expect(screen.getAllByText('Not checked')).toHaveLength(2)
    })

    it('keeps the versions under Details', () => {
        render(<FirmwareAction firmwareStatus={firmware()} onShowHelp={jest.fn()} />)
        expect(screen.queryByText(/0\.30\.58/)).toBeNull()
        fireEvent.press(screen.getByText('Details'))
        expect(screen.getByText('Current 0.30.58, latest 0.30.58')).toBeTruthy()
    })

    it('offers Update for the processor that is behind, and checks again when opened', () => {
        const status = firmware({ isOutdated: true })
        const onUpdate = jest.fn()
        render(<FirmwareAction firmwareStatus={status} onUpdateFirmware={onUpdate} onShowHelp={jest.fn()} />)
        expect(screen.getAllByText('Update available').length).toBeGreaterThan(0)
        fireEvent.press(screen.getByText('Update'))
        expect(onUpdate).toHaveBeenCalledWith('himax')
        fireEvent.press(screen.getByLabelText('Check Firmware'))
        expect(status.checkStatus).toHaveBeenCalledTimes(1)
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
