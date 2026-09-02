import { getFlowGroups } from '../FlowsReferenceModal'
import { COMMANDS, CommandNames } from '../../ble/types'

/**
 * The Flows list is a hand-maintained allowlist, exactly like the command list
 * next to it, and it went without this guard for longer. A flow can have a
 * COMMANDS entry, a navigation route, a screen and a routing handler and still
 * be impossible to run, because the only thing that decides what renders is the
 * array in FlowsReferenceModal.
 *
 * That is not hypothetical. In September 2026 an audit found three flows in
 * exactly that state: TRANSFER_CONFIG, TRANSFER_AI_MODEL and FIRMWARE_STATUS,
 * about 900 lines of screens and hooks between them, none of them reachable.
 * Worse, the documentation listed FIRMWARE_STATUS as available, so the only
 * signal anyone had pointed the wrong way.
 *
 * The sibling guard for `type: 'command'` entries lives in
 * CommandReferenceModal.coverage.test.ts.
 */
describe('FlowsReferenceModal coverage', () => {
    const listed = new Set(
        getFlowGroups().flatMap(group => group.commands.map(c => c.name)),
    )

    const flowCommands = (Object.keys(COMMANDS) as CommandNames[])
        .filter(name => COMMANDS[name]?.type === 'process' || COMMANDS[name]?.type === 'local')

    it('lists every flow in some group', () => {
        // Failing here means a flow exists that no one can run. Either add it to
        // a group in FlowsReferenceModal, or delete it along with its screen,
        // route and handler. Do not add it to the exemption list below without
        // a reason that survives being read out loud.
        const missing = flowCommands.filter(name => !listed.has(name))
        expect(missing).toEqual([])
    })

    it('does not list a flow that no longer exists', () => {
        const stale = [...listed].filter(name => !COMMANDS[name as CommandNames])
        expect(stale).toEqual([])
    })

    it('does not list an atomic command as a flow', () => {
        // `pick()` filters by type, so a typo naming a `type: 'command'` entry
        // would silently vanish from the modal rather than render in the wrong
        // place. This asserts the filter is doing that job rather than the list
        // happening to be correct.
        const wrongType = [...listed].filter(
            name => COMMANDS[name as CommandNames]?.type === 'command',
        )
        expect(wrongType).toEqual([])
    })

    it('renders each flow exactly once', () => {
        // A flow in two groups reads as two different tools.
        const all = getFlowGroups().flatMap(g => g.commands.map(c => c.name))
        const duplicated = all.filter((name, i) => all.indexOf(name) !== i)
        expect(duplicated).toEqual([])
    })

    it('keeps the camera flows together and in the order an operator reads them', () => {
        // Called out by name because these three are the everyday flows and the
        // group was assembled deliberately: they were one group each, which made
        // three single-item lists.
        const camera = getFlowGroups().find(g => g.title === 'Camera & Sensors')
        expect(camera?.commands.map(c => c.name)).toEqual([
            CommandNames.CAPTURE_PICTURE,
            CommandNames.MOTION_DETECTION_PREVIEW,
            CommandNames.LIGHT_SENSOR,
        ])
    })

    it('renders groups in the order they are declared, not COMMANDS order', () => {
        // The regression this replaces: getFlowGroups used to filter
        // Object.values(COMMANDS), so the order came from types.ts and editing
        // the arrays in the modal changed nothing on screen. Motion Detection
        // rendered above Capture Picture purely because of where it sits in that
        // file.
        expect(getFlowGroups().map(g => g.title)).toEqual([
            'Camera & Sensors',
            'Firmware Updates',
            'Device Configuration',
            'Tests',
        ])
    })

    it('leaves no empty group', () => {
        // Two groups emptied when their entries moved or were deleted. An empty
        // group renders as a heading with nothing under it.
        expect(getFlowGroups().filter(g => g.commands.length === 0)).toEqual([])
    })
})
