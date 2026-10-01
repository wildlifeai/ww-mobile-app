import { checkCommandArg, opName, resolveOpIndex } from '../commandArgs'
import { COMMANDS, CommandNames, CommandParam } from '../../ble/types'
import { commandRegistry } from '../../ble/protocol/commandRegistry'

const tokens = (s: string) => s.trim().split(/\s+/).length

/**
 * #300: the Engineer Console sent `setop` and `getop` with no values, and `md`
 * as `AI md 0`, which the firmware saves to op17 and which turns motion
 * triggering off (`md` has since left the list). A command that takes values
 * declares them in `params`, and the console asks for each before sending.
 */
describe('console commands that take values', () => {
    // A valid value for every command that declares params, and the exact
    // string it must produce. Adding params to a command means adding a row.
    const SENDS: Partial<Record<CommandNames, { args: string[]; wire: string }>> = {
        [CommandNames.setop]: { args: ['11', '1000'], wire: 'AI setop 11 1000' },
        [CommandNames.getop]: { args: ['17'], wire: 'AI getop 17' },
        // The format the deployment sends, pinned in the registry's golden test (#315).
        [CommandNames.setgps]: {
            args: ["37°48'30.50\"_N_122°25'10.22\"_W_500.75_Above"],
            wire: "AI setgps 37°48'30.50\"_N_122°25'10.22\"_W_500.75_Above",
        },
    }

    const withParams = (Object.keys(COMMANDS) as CommandNames[]).filter(name => COMMANDS[name].params?.length)

    it('has a row for every command that declares params', () => {
        expect(withParams.sort()).toEqual((Object.keys(SENDS) as CommandNames[]).sort())
    })

    it.each(Object.entries(SENDS))('%s sends exactly the values it was given', (name, row) => {
        const cmd = COMMANDS[name as CommandNames]
        row!.args.forEach((arg, i) => expect(checkCommandArg(cmd.params![i], arg)).toEqual({ value: arg }))
        expect(cmd.writeCommand!(row!.args[0], row!.args[1])).toBe(row!.wire)
    })

    // The rule itself: without its values a command carries none of them, so
    // nothing the operator did not choose can reach the device.
    it.each(withParams)('%s fills in no value of its own', (name) => {
        const cmd = COMMANDS[name]
        const row = SENDS[name]!
        expect(tokens(cmd.writeCommand!())).toBe(tokens(row.wire) - cmd.params!.length)
    })

})

// #300, Charles: "a 'Commands' button just to take a single photo". One tap,
// no form, and only the firmware's capture of one picture.
describe('Take one photo', () => {
    const cmd = COMMANDS[CommandNames.capture_one]

    it('sends exactly one capture of one picture', () => {
        expect(cmd.writeCommand!()).toBe('AI capture 1 500')
    })

    it('sends the bytes the registry defines, the ones Capture Picture sends', () => {
        expect(cmd.writeCommand!()).toBe(commandRegistry.capture(1, 500).build())
    })

    it('asks for nothing, so Run sends it at once', () => {
        expect(cmd.params).toBeUndefined()
        expect(cmd.type).toBe('command')
    })
})

describe('resolveOpIndex', () => {
    it.each([
        ['11', 11],
        ['MD_INTERVAL', 11],
        ['md_interval', 11],
        ['OP_PARAMETER_MD_INTERVAL', 11],
        [' md_sensitivity ', 17],
        ['-1', -1],
    ])('reads "%s" as %s', (text, index) => {
        expect(resolveOpIndex(text)).toBe(index)
    })

    // Names copied from the firmware's OP_PARAMETERS_E, where it differs from the app's.
    it.each([
        ['OP_PARAMETER_LED_BRIGHTNESS_PERCENT', 9],
        ['FLASH_EVALUATE_INTERVAL', 24],
    ])('reads the firmware name "%s" as %s', (text, index) => {
        expect(resolveOpIndex(text)).toBe(index)
    })

    it.each(['', 'NOT_AN_OP', 'constructor', '__proto__', 'hasOwnProperty', '1.5'])('rejects "%s"', (text) => {
        expect(resolveOpIndex(text)).toBeNull()
    })

    it('names an index for the operator to check', () => {
        expect(opName(11)).toBe('MD_INTERVAL')
        expect(opName(999)).toBeUndefined()
    })
})

describe('checkCommandArg', () => {
    const op: CommandParam = { label: 'Index', kind: 'op' }
    const level: CommandParam = { label: 'Level', kind: 'int', min: 0, max: 3 }
    const word: CommandParam = { label: 'File', kind: 'text' }

    it('sends an op name as its index', () => {
        expect(checkCommandArg(op, 'MD_INTERVAL')).toEqual({ value: '11' })
    })

    it('leaves the upper bound of an op index to the firmware', () => {
        expect(checkCommandArg(op, '40')).toEqual({ value: '40' })
        expect(checkCommandArg(op, '-1')).toHaveProperty('error')
    })

    it.each(['', '  ', '4', '-1', '1.5', 'two'])('refuses level "%s"', (text) => {
        expect(checkCommandArg(level, text)).toHaveProperty('error')
    })

    it('refuses a value with a space, since the device splits on spaces', () => {
        expect(checkCommandArg(word, 'OUTPUT IMG')).toHaveProperty('error')
        expect(checkCommandArg(word, ' OUTPUT.IMG ')).toEqual({ value: 'OUTPUT.IMG' })
    })
})
