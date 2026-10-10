import { aiBuildTime, newestAiBuildFirst, newestReleaseFirst } from '../versionUtils'

/**
 * #457: AI builds were sorted by their version string, which starts with the
 * time of day, so the "latest" build was the one built latest in its day. The
 * four builds of the issue, in the order that sort gave them: their times of
 * day run the other way from their dates.
 */
const BY_TIME_OF_DAY = [
	'WW500_C02 23:35:00 Jul  7 2026',
	'WW500_C02 10:56:08 Oct  9 2026',
	'WW500_C02 10:02:35 Oct  8 2026',
	'WW500_C02 04:33:16 Oct 10 2026',
]

const versions = (builds: Array<{ version?: string | null }>) => builds.map((b) => b.version)

describe('aiBuildTime', () => {
	it('reads the date and time out of the version, a space-padded day included', () => {
		expect(aiBuildTime({ version: 'WW500_C02 10:56:08 Oct  9 2026' })).toBe(Date.UTC(2026, 9, 9, 10, 56, 8))
		expect(aiBuildTime({ version: 'WW500_C02 10:56:08 Oct 9 2026' })).toBe(Date.UTC(2026, 9, 9, 10, 56, 8))
		expect(aiBuildTime({ version: 'WW500_C02 04:33:16 Oct 10 2026' })).toBe(Date.UTC(2026, 9, 10, 4, 33, 16))
	})

	it('takes the day from build_date and the time of day from the version', () => {
		expect(aiBuildTime({ version: 'WW500_C02 10:56:08 Oct  9 2026', buildDate: 'Oct  9 2026' }))
			.toBe(Date.UTC(2026, 9, 9, 10, 56, 8))
		// The upload's fallback when the image carries no build stamp: a release
		// number, and the runner's date with the day zero-padded
		expect(aiBuildTime({ version: '1.4.0.123', buildDate: 'Oct 09 2026' })).toBe(Date.UTC(2026, 9, 9))
	})

	it('reads the version when build_date is missing or unusable', () => {
		const fromVersion = Date.UTC(2026, 9, 9, 10, 56, 8)
		expect(aiBuildTime({ version: 'WW500_C02 10:56:08 Oct  9 2026', buildDate: null })).toBe(fromVersion)
		expect(aiBuildTime({ version: 'WW500_C02 10:56:08 Oct  9 2026', buildDate: '' })).toBe(fromVersion)
		expect(aiBuildTime({ version: 'WW500_C02 10:56:08 Oct  9 2026', buildDate: '2026-10-09' })).toBe(fromVersion)
		expect(aiBuildTime({ version: 'WW500_C02 10:56:08 Oct  9 2026', buildDate: 'Okt  9 2026' })).toBe(fromVersion)
	})

	it('is null when neither says when', () => {
		expect(aiBuildTime({ version: '1.4.0.123' })).toBeNull()
		expect(aiBuildTime({ version: 'WW500_C02 10:56:08 Okt  9 2026' })).toBeNull()
		expect(aiBuildTime({ version: 'WW500_C02 10:56:08 Oct 32 2026' })).toBeNull()
		expect(aiBuildTime({ version: null, buildDate: null })).toBeNull()
	})
})

describe('newestAiBuildFirst', () => {
	it('orders builds by date, not by time of day', () => {
		// What the text sort did with them, whatever order they came in
		expect([...BY_TIME_OF_DAY].reverse().sort(newestReleaseFirst)).toEqual(BY_TIME_OF_DAY)

		const builds = [...BY_TIME_OF_DAY].reverse().map((version) => ({ version }))
		expect(versions(builds.sort(newestAiBuildFirst))).toEqual([
			'WW500_C02 04:33:16 Oct 10 2026',
			'WW500_C02 10:56:08 Oct  9 2026',
			'WW500_C02 10:02:35 Oct  8 2026',
			'WW500_C02 23:35:00 Jul  7 2026',
		])
	})

	it('orders two builds of one day by their time', () => {
		const builds = [
			{ version: 'WW500_C02 00:07:16 Oct  1 2026', buildDate: 'Oct  1 2026' },
			{ version: 'WW500_C02 03:34:43 Oct  1 2026', buildDate: 'Oct  1 2026' },
		]
		expect(versions(builds.sort(newestAiBuildFirst))[0]).toBe('WW500_C02 03:34:43 Oct  1 2026')
	})

	it('dates a build with no stamp in its version by build_date', () => {
		const builds = [
			{ version: 'WW500_C02 23:35:00 Oct 10 2026', buildDate: 'Oct 10 2026' },
			{ version: '1.4.0.123', buildDate: 'Oct 11 2026' },
		]
		expect(versions(builds.sort(newestAiBuildFirst))).toEqual(['1.4.0.123', 'WW500_C02 23:35:00 Oct 10 2026'])
	})

	it('puts a build with no readable date after every dated one', () => {
		for (const undated of ['9.9.9', 'WW500_C02 10:56:08 Okt  9 2026', null]) {
			const builds = [{ version: undated }, { version: 'WW500_C02 23:35:00 Jul  7 2026' }]
			expect(versions(builds.sort(newestAiBuildFirst))).toEqual(['WW500_C02 23:35:00 Jul  7 2026', undated])
		}
	})

	it('settles a tie by release number, then by id, whatever order the rows came in', () => {
		const same = 'WW500_C02 10:56:08 Oct  9 2026'
		const rows = [
			{ id: 'b', version: same, buildDate: 'Oct  9 2026' },
			{ id: 'a', version: same },
			{ id: 'c', version: '1.2.0' },
			{ id: 'd', version: '1.10.0' },
		]
		const expected = ['a', 'b', 'd', 'c']
		expect([...rows].sort(newestAiBuildFirst).map((r) => r.id)).toEqual(expected)
		expect([...rows].reverse().sort(newestAiBuildFirst).map((r) => r.id)).toEqual(expected)
	})
})

describe('newestReleaseFirst', () => {
	it('orders release numbers numerically, as BLE builds are', () => {
		expect(['0.30.9', '0.4.1', '0.30.57', '1.0.0'].sort(newestReleaseFirst)).toEqual(['1.0.0', '0.30.57', '0.30.9', '0.4.1'])
	})

	it('treats a missing version as 0.0.0', () => {
		expect(newestReleaseFirst(null, '0.0.1')).toBeGreaterThan(0)
		expect(newestReleaseFirst(undefined, '0.0.0')).toBe(0)
	})
})
