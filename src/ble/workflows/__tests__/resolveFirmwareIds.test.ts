import { resolveFirmwareIds } from '../deploymentPipeline'
import FirmwareService from '../../../services/FirmwareService'

jest.mock('../../../utils/logger', () => ({ log: jest.fn(), logWarn: jest.fn(), logError: jest.fn() }))
jest.mock('../../../services/FirmwareService', () => ({
    __esModule: true,
    default: { getFirmwareIdByVersion: jest.fn() },
}))

/**
 * #534: the deployment records both builds the camera runs, since the LoRaWAN
 * message no longer carries them. `ver` answers padded where the catalogue is
 * not, so the Bluetooth build was never found, and the AI build was never
 * looked up.
 */
describe('resolveFirmwareIds', () => {
    // The cloud-dev catalogue on 21 November 2026
    const catalogue: Record<string, string> = {
        'ble 0.30.61': 'fw-ble-0.30.61',
        'himax WW500_C02 02:53:46 Nov 21 2026': 'fw-hm0360-1121',
    }
    const camera = (replies: Record<string, string>) => {
        const sent: string[] = []
        return {
            sent,
            session: {
                execute: jest.fn(async (make: any) => {
                    const line: string = make().build()
                    sent.push(line)
                    if (!(line in replies)) throw new Error('TIMEOUT')
                    return replies[line]
                }),
            } as any,
        }
    }

    beforeEach(() => {
        ;(FirmwareService.getFirmwareIdByVersion as jest.Mock).mockImplementation(
            async (type: string, version: string) => catalogue[`${type} ${version}`] ?? null)
    })

    it('finds both builds from the padded ver and the AI build stamp', async () => {
        const { session } = camera({ ver: '00.30.61', 'AI ver': 'WW500_C02 02:53:46 Nov 21 2026' })

        expect(await resolveFirmwareIds(session)).toEqual({
            bleFirmwareId: 'fw-ble-0.30.61',
            himaxFirmwareId: 'fw-hm0360-1121',
        })
        expect(FirmwareService.getFirmwareIdByVersion).toHaveBeenCalledWith('ble', '0.30.61')
    })

    it('uses the replies the connection already read, and asks the camera nothing', async () => {
        const { session, sent } = camera({})

        const ids = await resolveFirmwareIds(session, {
            bleVersion: '00.30.61',
            aiVersion: 'WW500_C02 02:53:46 Nov 21 2026',
        })

        expect(ids).toEqual({ bleFirmwareId: 'fw-ble-0.30.61', himaxFirmwareId: 'fw-hm0360-1121' })
        expect(sent).toEqual([])
    })

    it('leaves out a build the catalogue does not have, or one the camera did not report', async () => {
        const { session } = camera({ ver: '00.30.48' })

        expect(await resolveFirmwareIds(session)).toEqual({})
    })
})
