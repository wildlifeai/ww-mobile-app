import { getCommandSections } from '../CommandReferenceModal'
import { COMMANDS, CommandNames } from '../../ble/types'

/**
 * The Engineer Console's command list is a hand-maintained allowlist: each group
 * names the commands it shows. A command can therefore be fully defined in
 * COMMANDS, work perfectly when typed, and still be invisible in the UI.
 *
 * That is exactly what happened to `slots` and `switchslot` — the day/night
 * camera switching pair — which were unreachable from the modal until Aug 2026.
 * This test makes the next omission fail CI instead of being discovered by a
 * user who cannot find the command they were told exists.
 */
describe('CommandReferenceModal coverage', () => {
    const listed = new Set(
        getCommandSections().flatMap(section =>
            section.groups.flatMap(group => group.commands.map(c => c.name)),
        ),
    )

    const atomicCommands = (Object.keys(COMMANDS) as CommandNames[])
        .filter(name => COMMANDS[name]?.type === 'command')

    it('lists every atomic command in some group', () => {
        const missing = atomicCommands.filter(name => !listed.has(name))
        expect(missing).toEqual([])
    })

    it('does not list a command that no longer exists', () => {
        const stale = [...listed].filter(name => !COMMANDS[name as CommandNames])
        expect(stale).toEqual([])
    })

    it('keeps day/night camera switching reachable', () => {
        // Called out by name: operators are pointed at these two from the docs
        // and from the Light Sensor screen's tuning notes.
        expect(listed.has(CommandNames.slots)).toBe(true)
        expect(listed.has(CommandNames.switchslot)).toBe(true)
    })
})
