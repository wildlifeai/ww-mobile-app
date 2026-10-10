import ReferenceDataService from '../ReferenceDataService'
import { resetFakeDatabase, seedRows } from '../../../tests/setup/helpers/fakeDatabase'

jest.mock('../../database', () => ({
	__esModule: true,
	default: require('../../../tests/setup/helpers/fakeDatabase').fakeDatabase,
}))
jest.mock('../../utils/logger', () => ({ log: jest.fn(), logWarn: jest.fn(), logError: jest.fn() }))

/**
 * #457: the latest AI build was picked by sorting version strings, which start
 * with the time of day, so a build from July made at 23:35 beat one from
 * October made at 04:33. An AI build is now picked by its date; a BLE build
 * still goes by release number.
 */

const himax = (id: string, cameraVariant: string | null, version: string, extra: Record<string, unknown> = {}) =>
	({ id, type: 'himax', isActive: true, cameraVariant, version, buildDate: null, ...extra })

const ble = (id: string, version: string, buildDate: string | null = null) =>
	({ id, type: 'ble', isActive: true, cameraVariant: null, version, buildDate })

const versions = (rows: Array<{ version: string }>) => rows.map((r) => r.version)

beforeEach(() => resetFakeDatabase())

describe('ReferenceDataService, the latest AI build', () => {
	it("picks a camera's newest build by date, not by time of day", async () => {
		seedRows('firmware', [
			himax('rp3-jul7', 'RP3', 'WW500_C02 23:35:00 Jul  7 2026', { buildDate: 'Jul  7 2026' }),
			himax('rp3-oct9', 'RP3', 'WW500_C02 10:56:08 Oct  9 2026', { buildDate: 'Oct  9 2026' }),
			himax('rp3-oct8', 'RP3', 'WW500_C02 10:02:35 Oct  8 2026'),
			himax('rp3-oct10', 'RP3', 'WW500_C02 04:33:16 Oct 10 2026', { buildDate: 'Oct 10 2026' }),
			himax('hm-jul6', 'HM0360', 'WW500_C02 23:59:59 Jul  6 2026'),
		])

		expect((await ReferenceDataService.getLatestHimaxByVariant('RP3'))?.id).toBe('rp3-oct10')
		expect((await ReferenceDataService.getLatestHimaxByVariant('HM0360'))?.id).toBe('hm-jul6')
	})

	it("picks the newer camera's build when the two cameras' builds are from different days", async () => {
		// One camera's upload failed or came late (#437)
		seedRows('firmware', [
			himax('rp3', 'RP3', 'WW500_C02 23:35:00 Jul  7 2026', { buildDate: 'Jul  7 2026' }),
			himax('hm', 'HM0360', 'WW500_C02 04:33:16 Oct 10 2026', { buildDate: 'Oct 10 2026' }),
		])

		expect((await ReferenceDataService.getLatestFirmware('himax'))?.id).toBe('hm')
	})

	it('lists the active AI builds newest first, which the update screen takes each camera\'s latest from', async () => {
		seedRows('firmware', [
			himax('rp3-jul7', 'RP3', 'WW500_C02 23:35:00 Jul  7 2026'),
			himax('hm-oct9', 'HM0360', 'WW500_C02 10:58:41 Oct  9 2026'),
			himax('legacy', null, '1.4.0.123'),
			himax('rp3-oct9', 'RP3', 'WW500_C02 10:56:08 Oct  9 2026'),
			himax('rp3-oct10-off', 'RP3', 'WW500_C02 04:33:16 Oct 10 2026', { isActive: false }),
			ble('ble', '0.30.57'),
		])

		const active = await ReferenceDataService.getActiveFirmwares('himax')

		expect(active.map((fw) => fw.id)).toEqual(['hm-oct9', 'rp3-oct9', 'rp3-jul7', 'legacy'])
		expect(active.find((fw) => fw.cameraVariant === 'RP3')?.id).toBe('rp3-oct9')
	})

	it('is null without an active AI build', async () => {
		seedRows('firmware', [ble('ble', '0.30.57')])

		expect(await ReferenceDataService.getLatestFirmware('himax')).toBeNull()
		expect(await ReferenceDataService.getLatestHimaxByVariant('RP3')).toBeNull()
	})
})

describe('ReferenceDataService, the latest BLE build', () => {
	it('still goes by release number, whatever the build dates say', async () => {
		seedRows('firmware', [
			ble('a', '0.30.9', 'Oct 10 2026'),
			ble('b', '0.30.57', 'Sep 16 2026'),
			ble('c', '0.4.1', 'Oct 11 2026'),
			himax('rp3', 'RP3', 'WW500_C02 04:33:16 Oct 10 2026'),
		])

		expect((await ReferenceDataService.getLatestFirmware('ble'))?.version).toBe('0.30.57')
		expect(versions(await ReferenceDataService.getActiveFirmwares('ble'))).toEqual(['0.30.57', '0.30.9', '0.4.1'])
	})
})
