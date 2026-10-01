import { friendlyVersion, transferLine, updateResult, updateStep, updateSummary } from '../firmwareWords'

// #344: the operator sees builds and releases in words, never raw build strings
describe('friendlyVersion', () => {
	it('names an AI firmware build by its date', () => {
		expect(friendlyVersion('WW500_C02 20:26:50 Sep 30 2026')).toBe('30 Sep build')
		expect(friendlyVersion('WW500_C02 23:35:10 Jul  7 2026')).toBe('7 Jul build')
	})

	it('gives a BLE version as a plain release number', () => {
		expect(friendlyVersion('00.30.52')).toBe('0.30.52')
		expect(friendlyVersion('WW500-C02 V 00.30.50 Sep 16 2026')).toBe('0.30.50')
	})

	it('passes anything else through, and nothing for nothing', () => {
		expect(friendlyVersion('Unknown')).toBe('Unknown')
		expect(friendlyVersion(null)).toBe('')
	})
})

describe('updateSummary', () => {
	it('says from which version to which', () => {
		expect(updateSummary('WW500_C02 04:18:11 Sep 23 2026', 'WW500_C02 20:26:50 Sep 30 2026'))
			.toBe('Update from the 23 Sep build to the 30 Sep build.')
	})

	it('gives the times when both builds are from the same day', () => {
		expect(updateSummary('WW500_C02 00:07:16 Oct  1 2026', 'WW500_C02 03:34:43 Oct  1 2026'))
			.toBe('Update from the 1 Oct 00:07 build to the 1 Oct 03:34 build.')
	})

	it('says up to date when it is', () => {
		expect(updateSummary('00.30.52', '0.30.52', true)).toBe('Up to date: 0.30.52.')
	})

	it('leaves out a current version it could not read', () => {
		expect(updateSummary('Unknown', '0.30.52')).toBe('Update to 0.30.52.')
		expect(updateSummary(null, null)).toBe('Update to the latest firmware.')
	})
})

describe('updateStep', () => {
	const pair = { total: 2, done: 0 }

	it('counts the images of a two-image AI update', () => {
		expect(updateStep('himax', 'transferring', pair)).toBe('Sending image 1 of 2 to the camera')
		expect(updateStep('himax', 'flashing', { total: 2, done: 1 })).toBe('Installing image 2 of 2, which takes a few minutes')
		expect(updateStep('himax', 'rebooting', pair)).toBe('Restarting the camera')
		// The check between images is the camera booting the first one (bench, 1 October 2026)
		expect(updateStep('himax', 'preflight', { total: 2, done: 1 })).toBe('Restarting the camera')
		expect(updateStep('himax', 'preflight', pair)).toBe('Checking the camera')
	})

	it('words the BLE update without images', () => {
		expect(updateStep('ble', 'downloading', null)).toBe('Downloading')
		expect(updateStep('ble', 'scanning', null)).toBe('Preparing the camera')
		expect(updateStep('ble', 'flashing', null)).toBe('Installing')
	})
})

describe('updateResult', () => {
	it('gives the new version, or says the camera finishes it on restart', () => {
		expect(updateResult('WW500_C02 20:26:50 Sep 30 2026')).toBe('Updated to the 30 Sep build.')
		expect(updateResult(null)).toBe('Update sent. The camera finishes it the next time it restarts.')
	})
})

describe('transferLine', () => {
	it('says how much is across, how fast and how long is left', () => {
		expect(transferLine(217088, 487424, 27000, 38000)).toBe('212 of 476 KB, 7.9 KB/s, about 38 s left')
		expect(transferLine(100000, 487424, 60000, 240000)).toBe('98 of 476 KB, 1.6 KB/s, about 4 min left')
	})

	it('leaves out what it does not know yet', () => {
		expect(transferLine(0, 487424, 0, 0)).toBe('0 of 476 KB')
	})
})
