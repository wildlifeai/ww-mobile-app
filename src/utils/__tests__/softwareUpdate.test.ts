import { aiIsBehind, bleIsBehind, softwarePlan, softwareState } from '../softwareUpdate'

// The cloud-dev catalogue on 21 November 2026 (Seeed PR 289, ww-hardware PR 77)
const RP3 = { version: 'WW500_C02 02:53:39 Nov 21 2026', buildDate: 'Nov 21 2026' }
const HM0360 = { version: 'WW500_C02 02:53:46 Nov 21 2026', buildDate: 'Nov 21 2026' }

const ble = (currentVersion: string | null, extra = {}) => ({
    currentVersion, latestVersion: '0.30.61', isOutdated: currentVersion !== '0.30.61', ...extra,
})
const himax = (currentVersion: string | null, extra = {}) => ({
    currentVersion,
    latestVersion: HM0360.version,
    isOutdated: currentVersion !== HM0360.version && currentVersion !== RP3.version,
    variants: { RP3, HM0360 },
    ...extra,
})
const HALF_DONE = { unfinished: { endVariant: 'HM0360', done: 1, total: 2 }, isOutdated: true }

describe('what counts as behind', () => {
    it('Bluetooth: older than the catalogue only', () => {
        expect(bleIsBehind(ble('0.30.58'))).toBe(true)
        expect(bleIsBehind(ble('0.30.61'))).toBe(false)
        // An engineer's build, newer than the catalogue
        expect(bleIsBehind(ble('0.30.62'))).toBe(false)
        expect(bleIsBehind(ble('Unknown'))).toBe(false)
    })

    it('AI: older than the catalogue by build time, or half done', () => {
        expect(aiIsBehind(himax('WW500_C02 01:06:33 Oct 31 2026'))).toBe(true)
        expect(aiIsBehind(himax(HM0360.version))).toBe(false)
        expect(aiIsBehind(himax('WW500_C02 09:00:00 Dec  2 2026'))).toBe(false)
        expect(aiIsBehind(himax('Unknown', HALF_DONE))).toBe(true)
    })

    it('AI: a version with no build time is judged by isOutdated', () => {
        expect(aiIsBehind(himax('v1.0.0'))).toBe(true)
    })
})

describe('softwarePlan', () => {
    it('both behind: AI image 1, Bluetooth, then the rest of the AI update', () => {
        expect(softwarePlan({ ble: ble('0.30.58'), himax: himax('WW500_C02 01:06:33 Oct 31 2026') }))
            .toEqual(['ai_first_image', 'ble', 'ai'])
    })

    it('only one behind: only its step', () => {
        expect(softwarePlan({ ble: ble('0.30.58'), himax: himax(HM0360.version) })).toEqual(['ble'])
        expect(softwarePlan({ ble: ble('0.30.61'), himax: himax('WW500_C02 01:06:33 Oct 31 2026') })).toEqual(['ai'])
    })

    it('half done: Bluetooth first when behind, then the AI update finishes', () => {
        expect(softwarePlan({ ble: ble('0.30.58'), himax: himax('Unknown', HALF_DONE) })).toEqual(['ble', 'ai'])
        expect(softwarePlan({ ble: ble('0.30.61'), himax: himax(RP3.version, HALF_DONE) })).toEqual(['ai'])
    })

    it('nothing behind, or only newer: nothing to do', () => {
        expect(softwarePlan({ ble: ble('0.30.61'), himax: himax(HM0360.version) })).toEqual([])
        expect(softwarePlan({ ble: ble('0.30.62'), himax: himax('WW500_C02 09:00:00 Dec  2 2026') })).toEqual([])
    })
})

describe('softwareState', () => {
    const behind = { ble: ble('0.30.58'), himax: himax('WW500_C02 01:06:33 Oct 31 2026') }

    it('says nothing before a check has found the latest builds', () => {
        expect(softwareState({ ble: ble(null, { latestVersion: null }), himax: himax(null, { latestVersion: null }) }, true))
            .toBe('not_checked')
    })

    it('offers the update when the files are on the phone', () => {
        expect(softwareState(behind, true)).toBe('available')
        expect(softwareState({ ble: ble('0.30.58'), himax: himax('Unknown', HALF_DONE) }, true)).toBe('unfinished')
    })

    it('reads up to date when the files are not on the phone', () => {
        expect(softwareState(behind, false)).toBe('up_to_date')
    })

    // #437: only one camera's build in the catalogue
    it('reads up to date while a camera build is missing', () => {
        expect(softwareState({
            ble: ble('0.30.61'),
            himax: himax('WW500_C02 01:06:33 Oct 31 2026', { isOutdated: false, missingVariant: 'RP3' }),
        }, true)).toBe('up_to_date')
    })
})
