import { afterBleRestart } from '../useFirmwareUpdate'
import type { CommandContext } from '../../../../ble/protocol/commandRegistry'

jest.mock('@react-native-async-storage/async-storage', () => ({
    __esModule: true,
    default: { setItem: jest.fn(), getItem: jest.fn(async () => null), removeItem: jest.fn() },
}))
jest.mock('react-native-ble-manager', () => ({
    __esModule: true,
    default: { addListener: jest.fn(() => ({ remove: jest.fn() })), scan: jest.fn(async () => {}), stopScan: jest.fn(async () => {}) },
}))
jest.mock('../../../../utils/logger', () => ({ log: jest.fn(), logWarn: jest.fn(), logError: jest.fn() }))
jest.mock('../../../../ble/session/createBleSession', () => ({ createBleSession: jest.fn() }))
jest.mock('../../../../ble/protocol/fileTransfer', () => ({ runFileTransferPipeline: jest.fn() }))
jest.mock('../../../../services/DfuService', () => ({ DfuService: { startDFU: jest.fn() } }))
jest.mock('../../../../services/FirmwareService', () => ({ __esModule: true, default: {} }))
jest.mock('../../../../services/ReferenceDataService', () => ({ __esModule: true, default: {} }))
jest.mock('../../../../hooks/useBle', () => ({ useBle: () => ({ connectDevice: jest.fn(), disconnectDevice: jest.fn() }) }))
jest.mock('../../../../redux', () => ({ useAppDispatch: () => jest.fn() }))
jest.mock('expo-keep-awake', () => ({ activateKeepAwakeAsync: jest.fn(async () => {}), deactivateKeepAwake: jest.fn() }))

const VERSION = 'WW500-C02 V 00.30.63 03:57:26 Nov 27 2026'

/** A session that records each command it is asked for and answers from `replies` */
const fakeSession = (replies: Record<string, unknown>) => {
    const sent: string[] = []
    const execute = jest.fn(async (fn: () => CommandContext<unknown>) => {
        const name = fn().name
        sent.push(name)
        const reply = replies[name]
        if (reply instanceof Error) throw reply
        return reply
    })
    return { session: { execute } as any, sent }
}

describe('afterBleRestart (#578)', () => {
    it('sets the clock before reading the new version', async () => {
        const { session, sent } = fakeSession({ setutc: true, version: VERSION })
        const lines: string[] = []

        const ver = await afterBleRestart(session, line => lines.push(line))

        expect(sent).toEqual(['setutc', 'version'])
        expect(ver).toBe(VERSION)
        expect(lines).toEqual(['Camera clock set.', 'Querying new firmware version...', `New version: ${VERSION}`])
    })

    it('still reads the version when the clock cannot be set', async () => {
        const { session, sent } = fakeSession({ setutc: new Error('TIMEOUT'), version: VERSION })
        const lines: string[] = []

        const ver = await afterBleRestart(session, line => lines.push(line))

        expect(sent).toEqual(['setutc', 'version'])
        expect(ver).toBe(VERSION)
        expect(lines[0]).toBe('Could not set the camera clock. The next connection sets it.')
    })

    it('returns null when the version cannot be read', async () => {
        const { session } = fakeSession({ setutc: true, version: new Error('TIMEOUT') })
        const lines: string[] = []

        expect(await afterBleRestart(session, line => lines.push(line))).toBeNull()
        expect(lines[lines.length - 1]).toBe('Version query failed, check manually.')
    })
})
