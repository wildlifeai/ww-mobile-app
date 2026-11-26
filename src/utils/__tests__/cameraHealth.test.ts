import { cameraState, healthReasonText, healthReasonTexts, needsAttention, silenceText, toHealthState, type CameraFacts } from '../cameraHealth'

const HOUR = 3_600_000
const NOW = Date.parse('2026-11-27T12:00:00Z')
const ago = (hours: number) => new Date(NOW - hours * HOUR).toISOString()

const facts = (over: Partial<CameraFacts> = {}): CameraFacts => ({
    lastSeen: ago(1), deploymentStart: ago(48), deploymentEnd: null, pingMinutes: 240, health: 'ok', ...over,
})

/**
 * #518. A deployed camera reads the same in the app as on the website's Realtime page, by the
 * rules of ww-website#427 (`frontend/src/lib/cameraState.ts`).
 */
describe('cameraState', () => {
    it('is the health state for a camera heard within its silence window', () => {
        expect(cameraState(facts(), NOW)).toBe('ok')
        expect(cameraState(facts({ health: 'warning' }), NOW)).toBe('warning')
        expect(cameraState(facts({ health: 'fault' }), NOW)).toBe('fault')
    })

    it('is Silent after three ping periods with no message, 12 h at the deployed 240 minutes', () => {
        expect(cameraState(facts({ lastSeen: ago(11.9) }), NOW)).toBe('ok')
        expect(cameraState(facts({ lastSeen: ago(12.1) }), NOW)).toBe('silent')
    })

    it('puts Silent over a reported fault', () => {
        expect(cameraState(facts({ lastSeen: ago(13), health: 'fault' }), NOW)).toBe('silent')
    })

    it('counts silence from the start when the camera has never checked in', () => {
        expect(cameraState(facts({ lastSeen: null, deploymentStart: ago(2) }), NOW)).toBe('awaiting')
        expect(cameraState(facts({ lastSeen: null, deploymentStart: ago(13) }), NOW)).toBe('silent')
    })

    it('is LoRaWAN off, never Silent, when the deployment pings every 0 minutes', () => {
        expect(cameraState(facts({ pingMinutes: 0, lastSeen: ago(500) }), NOW)).toBe('off')
    })

    it('keeps the old rule for a deployment with no period recorded: Stale after 24 h, Silent after 72 h', () => {
        const noPeriod = { pingMinutes: null }
        expect(cameraState(facts({ ...noPeriod, lastSeen: ago(23) }), NOW)).toBe('ok')
        expect(cameraState(facts({ ...noPeriod, lastSeen: ago(25) }), NOW)).toBe('stale')
        expect(cameraState(facts({ ...noPeriod, lastSeen: ago(25), health: 'warning' }), NOW)).toBe('warning')
        expect(cameraState(facts({ ...noPeriod, lastSeen: ago(73) }), NOW)).toBe('silent')
        // Never Silent before its first message
        expect(cameraState(facts({ ...noPeriod, lastSeen: null, deploymentStart: ago(500) }), NOW)).toBe('awaiting')
    })

    it('is Checking in for a camera that sends no health report', () => {
        expect(cameraState(facts({ health: null }), NOW)).toBe('checking_in')
    })

    it('is Finished once the deployment has ended', () => {
        expect(cameraState(facts({ deploymentEnd: ago(1), health: 'fault' }), NOW)).toBe('finished')
    })

    it('rings Silent, Fault and Warning only', () => {
        expect(['silent', 'fault', 'warning', 'stale', 'ok', 'checking_in', 'awaiting', 'off', 'finished']
            .filter(s => needsAttention(s as never))).toEqual(['silent', 'fault', 'warning'])
    })

    it('takes only the three health states from the view', () => {
        expect(toHealthState('fault')).toBe('fault')
        expect(toHealthState('broken')).toBeNull()
        expect(toHealthState(null)).toBeNull()
    })

    it('says how long a camera went unheard before it was Silent', () => {
        expect(silenceText(240)).toBe('No message for over 12 h')
        expect(silenceText(null)).toBe('No message for over 3 days')
        expect(silenceText(10)).toBe('No message for over 30 min')
    })
})

/**
 * The words are ww-backend's `camera_health_reason_text()`, row for row as its test
 * `63_camera_health_reason_text.test.sql` pins them, so the card, the website and the alerts
 * name a fault alike. Change them together.
 */
describe('healthReasonText', () => {
    it.each([
        ['self_test_bit_0', 'Battery low'],
        ['self_test_bit_1', 'AI processor not responding'],
        ['self_test_bit_2', 'LoRaWAN error'],
        ['self_test_bit_3', 'Restarted by its watchdog'],
        ['self_test_bit_4', 'Restarted after a brownout'],
        ['self_test_bit_5', 'Restarted after a firmware fault'],
        ['self_test_bit_6', 'Self-test bit 6'],
        ['self_test_bit_7', 'Self-test bit 7'],
        ['self_test_bit_8', 'Main camera failed'],
        ['self_test_bit_9', 'HM0360 camera failed'],
        ['self_test_bit_10', 'LED flash failed'],
        ['self_test_bit_11', 'SD card missing'],
        ['self_test_bit_12', 'Settings file damaged, photo counters restarted'],
        ['self_test_bit_13', 'AI model failed'],
        ['self_test_bit_14', 'AI processor missed the BLE processor at start-up'],
        ['self_test_bit_15', 'Self-test bit 15'],
        ['sd_low', 'SD card nearly full'],
        ['ai_failures_rose', 'AI processor did not respond'],
        ['unexpected_restart_2', 'Restarted after a firmware error check'],
        ['unexpected_restart_3', 'Restarted after an SDK assert'],
        ['unexpected_restart_4', 'Restarted after a radio stack assert'],
        ['unexpected_restart_5', 'Restarted after a hard fault'],
        ['unexpected_restart_6', 'Restarted by its watchdog'],
    ])('%s reads "%s"', (code, words) => {
        expect(healthReasonText(code)).toBe(words)
    })

    it('names an unlisted restart by its number, and passes an unknown code through', () => {
        expect(healthReasonText('unexpected_restart_7')).toBe('Restarted unexpectedly (reason 7)')
        expect(healthReasonText('something_new')).toBe('something_new')
    })

    it('keeps the order and says a text two reasons share once', () => {
        expect(healthReasonTexts(['self_test_bit_9', 'self_test_bit_3', 'unexpected_restart_6']))
            .toEqual(['HM0360 camera failed', 'Restarted by its watchdog'])
        expect(healthReasonTexts(null)).toEqual([])
    })
})
