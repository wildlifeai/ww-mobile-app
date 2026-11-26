import { pingLorawan, lorawanRequiredWarning, LorawanPingResult, LORAWAN_PING_WORDS, LORAWAN_REQUIRED_WARNING } from '../lorawanPing'

jest.mock('../../../utils/logger', () => ({
    log: jest.fn(),
    logWarn: jest.fn(),
    logError: jest.fn(),
}))

/**
 * The Signal Test and Start Monitoring's check both read the camera through
 * `pingLorawan`. Until #348 the first waited for a `Pong` the nRF never sends
 * and the second passed on `Not joined yet.`
 */
describe('pingLorawan', () => {
    /** A session that feeds the nRF's reply through the real `ping` command. */
    const sessionReplying = (reply: string) => ({
        execute: jest.fn(async (factory: any) => {
            const command = factory()
            command.collect(reply)
            return command.parser()
        }),
    })

    it.each([
        ['OK', 'sent'],
        ['Busy', 'busy'],
        ['Not joined yet.', 'not_joined'],
        // BLE 0.30.56 and later say so themselves when op32 is 0 (#535)
        ["LoRaWAN is off. Use 'AI setop 32 <minutes>' or 'join'", 'off'],
    ])('reads %s as %s', async (reply, result) => {
        expect(await pingLorawan(sessionReplying(reply) as any)).toBe(result)
    })

    it('reports no answer when the nRF does not reply', async () => {
        const session = { execute: jest.fn(async () => { throw new Error('TIMEOUT') }) }
        expect(await pingLorawan(session as any)).toBe('no_answer')
    })
})

describe('what each result tells the operator', () => {
    const results: LorawanPingResult[] = ['sent', 'not_joined', 'busy', 'off', 'no_answer']

    it('gives every result its own status on the Signal Test card', () => {
        const statuses = results.map(result => LORAWAN_PING_WORDS[result].status)
        expect(new Set(statuses).size).toBe(results.length)
    })

    it('warns Start Monitoring only when the camera is not on the network', () => {
        expect(lorawanRequiredWarning('sent')).toBeNull()
        expect(lorawanRequiredWarning('busy')).toBeNull()
        const warnings = (['not_joined', 'off', 'no_answer'] as const).map(lorawanRequiredWarning)
        for (const warning of warnings) expect(warning?.startsWith(LORAWAN_REQUIRED_WARNING)).toBe(true)
        expect(new Set(warnings).size).toBe(3)
    })
})
