import { batteryLowWarning, isMinorWarning, NEWER_AI_FIRMWARE, NEWER_BLE_FIRMWARE, sdCardAlmostFullWarning, sortInitWarnings } from '../initWarnings'
import { selfTestWarnings, SelfTestBit, NIGHT_SENSOR_WARNING } from '../deviceSelfTest'

/**
 * The banner asks for a report of a fault and never of a minor line, and a
 * banner of minor lines only can be dismissed. People reported their
 * batteries while every line asked for a report.
 */
describe('initWarnings', () => {
    it('words a low battery as something to do, with the level when there is one', () => {
        expect(batteryLowWarning()).toBe('Battery is low. Replace the batteries before deploying.')
        expect(batteryLowWarning(12)).toBe('Battery is low (12%). Replace the batteries before deploying.')
        expect(selfTestWarnings(1 << SelfTestBit.LOW_BATTERY)).toEqual([batteryLowWarning()])
    })

    it.each([
        batteryLowWarning(12),
        `${NEWER_BLE_FIRMWARE}: 0.30.58`,
        NEWER_AI_FIRMWARE,
        sdCardAlmostFullWarning(93.25),
    ])('counts %s as minor', (line) => {
        expect(isMinorWarning(line)).toBe(true)
    })

    it.each([
        NIGHT_SENSOR_WARNING,
        'The device restarted after a firmware fault (Bit 5)',
        'No SD Card detected or total space is 0',
        'Unknown hardware issue (Code: 0x8000)',
    ])('counts %s as a fault', (line) => {
        expect(isMinorWarning(line)).toBe(false)
    })

    it('keeps one battery line, the reading over the self-test bit, and sorts the rest', () => {
        expect(sortInitWarnings([batteryLowWarning(), NEWER_AI_FIRMWARE, 'LoRaWAN Error (Bit 2)', batteryLowWarning(7)])).toEqual({
            battery: batteryLowWarning(7),
            minor: [NEWER_AI_FIRMWARE],
            faults: ['LoRaWAN Error (Bit 2)'],
        })
        expect(sortInitWarnings(['LoRaWAN Error (Bit 2)'])).toEqual({ battery: null, minor: [], faults: ['LoRaWAN Error (Bit 2)'] })
    })
})
