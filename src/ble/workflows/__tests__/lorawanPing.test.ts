import { pingLorawan, lorawanRequiredWarning, LorawanPingResult, LORAWAN_PING_WORDS, LORAWAN_REQUIRED_WARNING } from '../lorawanPing'
import { OP_PARAMETER } from '../../../hooks/useDeviceSettings'

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
    /** An op table of the given length with op32 set, the way `getop -1` returns it. */
    const opTable = (length: number, op32: string) =>
        Array.from({ length }, (_, index) => (index === OP_PARAMETER.LORAWAN_PING_MINUTES ? op32 : '1'))

    /** A session that feeds the nRF's reply through the real `ping` command. */
    const sessionReplying = (reply: string, ops: () => Promise<string[]> = async () => opTable(37, '720')) => ({
        execute: jest.fn(async (factory: any) => {
            const command = factory()
            command.collect(reply)
            return command.parser()
        }),
        getOps: jest.fn(ops),
    })

    it('reads OK as sent, without reading the ops', async () => {
        const session = sessionReplying('OK')
        expect(await pingLorawan(session as any)).toBe('sent')
        expect(session.getOps).not.toHaveBeenCalled()
    })

    it('reads Busy as busy, without reading the ops', async () => {
        const session = sessionReplying('Busy')
        expect(await pingLorawan(session as any)).toBe('busy')
        expect(session.getOps).not.toHaveBeenCalled()
    })

    it('reads Not joined yet. as not joined while op32 leaves LoRaWAN on', async () => {
        const session = sessionReplying('Not joined yet.')
        expect(await pingLorawan(session as any)).toBe('not_joined')
        expect(session.getOps).toHaveBeenCalledTimes(1)
    })

    it('reads Not joined yet. as off when op32 is 0', async () => {
        const session = sessionReplying('Not joined yet.', async () => opTable(37, '0'))
        expect(await pingLorawan(session as any)).toBe('off')
    })

    it('ignores op32 on firmware without the flash mode, where it is the hi-res switch', async () => {
        const session = sessionReplying('Not joined yet.', async () => opTable(OP_PARAMETER.FLASH_MODE, '0'))
        expect(await pingLorawan(session as any)).toBe('not_joined')
    })

    it('stays not joined when the ops cannot be read', async () => {
        const session = sessionReplying('Not joined yet.', async () => { throw new Error('TIMEOUT') })
        expect(await pingLorawan(session as any)).toBe('not_joined')
    })

    it('reports no answer when the nRF does not reply', async () => {
        const session = {
            execute: jest.fn(async () => { throw new Error('TIMEOUT') }),
            getOps: jest.fn(),
        }
        expect(await pingLorawan(session as any)).toBe('no_answer')
        expect(session.getOps).not.toHaveBeenCalled()
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
