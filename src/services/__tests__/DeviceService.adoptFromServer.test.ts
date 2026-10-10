/**
 * A camera the phone has not met is asked of the server before the scanner
 * registers it (#451). The server's row comes onto the phone under the
 * server's id, with nothing queued, since a second id for one camera is
 * refused on every sync (devices.bluetooth_id is unique).
 */
import NetInfo from '@react-native-community/netinfo'

import { DeviceService } from '../DeviceService'
import { resetFakeDatabase, seedRows, rowsIn } from '../../../tests/setup/helpers/fakeDatabase'

jest.mock('../../database', () => ({
	__esModule: true,
	default: require('../../../tests/setup/helpers/fakeDatabase').fakeDatabase,
}))

// What the server answers for a read of devices by bluetooth_id
let mockAnswer: () => Promise<{ data: any, error: any }>
const mockAsked: string[] = []
jest.mock('../supabase', () => ({
	getSupabaseClient: () => ({
		from: (table: string) => ({
			select: () => ({
				eq: (column: string, value: string) => {
					mockAsked.push(`${table}.${column}=${value}`)
					return mockAnswer()
				},
			}),
		}),
	}),
}))

const serverRow = { id: 'device-server', bluetooth_id: 'D4:5E', name: 'WILD-LENT', organisation_id: 'org-other',
	device_eui: null, deleted_at: null, modified_by: null, created_at: '2026-09-01T00:00:00Z', updated_at: '2026-09-02T00:00:00Z' }

/** Let the awaited promises run, timers stay fake */
const flush = async () => {
	for (let i = 0; i < 20; i++) await Promise.resolve()
}

beforeEach(() => {
	resetFakeDatabase()
	mockAsked.length = 0
	mockAnswer = async () => ({ data: [serverRow], error: null })
	;(NetInfo.fetch as jest.Mock).mockResolvedValue({ isConnected: true })
})

describe('DeviceService.adoptFromServer (#451)', () => {
	it("writes the server's row to the phone under its id, and queues nothing", async () => {
		const result = await DeviceService.adoptFromServer('D4:5E')

		expect(mockAsked).toEqual(['devices.bluetooth_id=D4:5E'])
		expect(result).toEqual({ kind: 'found', device: expect.objectContaining({ id: 'device-server', bluetoothId: 'D4:5E' }) })
		expect(rowsIn('devices')).toEqual([expect.objectContaining({
			id: 'device-server', name: 'WILD-LENT', bluetoothId: 'D4:5E', organisationId: 'org-other' })])
		expect(rowsIn('sync_outbox')).toEqual([])
	})

	it('updates the copy the phone already holds under that id', async () => {
		seedRows('devices', [{ id: 'device-server', bluetoothId: 'D4:5E', name: 'Old name', organisationId: 'org-other' }])

		await DeviceService.adoptFromServer('D4:5E')

		expect(rowsIn('devices')).toEqual([expect.objectContaining({ id: 'device-server', name: 'WILD-LENT' })])
	})

	it('answers none when the server shows this account no such camera', async () => {
		mockAnswer = async () => ({ data: [], error: null })

		await expect(DeviceService.adoptFromServer('D4:5E')).resolves.toEqual({ kind: 'none' })
		expect(rowsIn('devices')).toEqual([])
	})

	it('does not ask offline', async () => {
		;(NetInfo.fetch as jest.Mock).mockResolvedValue({ isConnected: false })

		await expect(DeviceService.adoptFromServer('D4:5E')).resolves.toEqual({ kind: 'unchecked' })
		expect(mockAsked).toEqual([])
	})

	it('answers unchecked when the read fails', async () => {
		mockAnswer = async () => ({ data: null, error: { message: 'TypeError: Network request failed' } })

		await expect(DeviceService.adoptFromServer('D4:5E')).resolves.toEqual({ kind: 'unchecked' })
		expect(rowsIn('devices')).toEqual([])
	})

	it('stops waiting after 5 s', async () => {
		mockAnswer = () => new Promise(() => {})
		let result: unknown
		DeviceService.adoptFromServer('D4:5E').then((r) => { result = r })
		await flush()

		jest.advanceTimersByTime(4_999)
		await flush()
		expect(result).toBeUndefined()

		jest.advanceTimersByTime(1)
		await flush()
		expect(result).toEqual({ kind: 'unchecked' })
		expect(rowsIn('devices')).toEqual([])
	})
})
