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

    it('keeps the #300 review of the list', () => {
        // `erase` answers "Not yet implemented" and `get appkey` can never read
        // the key back, so both left the list; the AI entries carry the ai_ prefix.
        // The redesign of 1 October 2026 dropped what the console no longer
        // needs to offer; all of it can still be typed in the command box.
        const names = listed as Set<string>
        for (const gone of ['erase', 'appkey', 'setdid', 'getdid', 'ai_firmware', 'ai_camera', 'getgps', 'state',
            'md', 'ai_flash', 'erasemodel', 'loadmodel', 'SET_NUM_PICTURES', 'SET_PICTURE_INTERVAL',
            'SET_TIMELAPSE_INTERVAL', 'SET_MOTION_DETECT_INTERVAL', 'DISABLE_MOTION_DETECT', 'DISABLE_TIMELAPSE']) {
            expect(names.has(gone)).toBe(false)
        }
        expect(listed.has(CommandNames.ai_info)).toBe(true)
        expect(listed.has(CommandNames.capture_one)).toBe(true)
    })

    it('lists each category in the order it names its commands', () => {
        const camera = getCommandSections()[1].groups.find(group => group.title === 'Camera Functions')!
        expect(camera.commands.map(c => c.name)).toEqual([
            CommandNames.capture_one, CommandNames.light, CommandNames.slots, CommandNames.switchslot,
        ])
    })

    it('shows five BLE and four AI categories, each a toggle of its own', () => {
        const titles = getCommandSections().map(section => [section.title, section.groups.map(group => group.title)])
        expect(titles).toEqual([
            ['BLE Processor', ['System & Identity', 'Clock', 'Device Control', 'LoRaWAN', 'LED Diagnostics']],
            ['AI Processor', ['AI System', 'SD Card & Files', 'Operational Parameters', 'Camera Functions']],
        ])
    })
})
