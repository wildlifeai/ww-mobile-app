import { commandRegistry } from '../commandRegistry'

/** What `fault` makes of one reply line, as the pipeline would hand it over. */
const parse = (line: string) => {
    const cmd = commandRegistry.fault()
    cmd.collect(line)
    return cmd.getResult()
}

/**
 * The reply to `fault` from the BLE firmware of ww-hardware PR #73, in the
 * format its Fault_Handling.md fixes: reason, code, file:line, pc, lr, count.
 * The lines are Charles's bench examples.
 */
describe('fault record', () => {
    it('reads an error check with its file and line', () => {
        expect(parse('fault error 0x00000004 ble_commands.c:991 0x00027151 0x00000000 1')).toEqual({
            reason: 'error',
            code: '0x00000004',
            location: 'ble_commands.c:991',
            pc: '0x00027151',
            lr: '0x00000000',
            count: 1,
            line: 'fault error 0x00000004 ble_commands.c:991 0x00027151 0x00000000 1',
        })
    })

    it('reads a hard fault, which has no file', () => {
        const record = parse('fault hardfault 0x00010000 -:0 0x000299b8 0x00027151 2')
        expect(record?.reason).toBe('hardfault')
        expect(record?.location).toBe('-:0')
        expect(record?.count).toBe(2)
    })

    it('keeps a reason it does not know, for the log', () => {
        expect(parse('fault brownout 0x00000000 -:0 0x00000000 0x00000000 1')?.reason).toBe('brownout')
    })

    it('answers null when the record is gone', () => {
        expect(parse('fault none')).toBeNull()
    })

    it('fails on firmware that does not know the command', () => {
        const cmd = commandRegistry.fault()
        cmd.collect('Unrecognised command')
        expect(() => cmd.getResult()).toThrow(/fault failed/)
    })
})
