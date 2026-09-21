import { commandRegistry } from '../commandRegistry'

/**
 * Golden wire-format tests: one row per command in the registry.
 *
 * Each row pins two things and nothing else. The exact string the app sends
 * for representative arguments, and one reply line the device is known to
 * send that the command must accept. Both are cross-repo contracts with the
 * nRF relay and the Himax firmware, and both have been broken by edits that
 * looked local.
 *
 * The case that motivated this file: `setgps` was built in two formats by two
 * call sites, and the one the deployment used was silently discarded by the
 * firmware for as long as the code existed (#315). Nothing asserted the bytes
 * on the wire. Now something does: change a builder and the row fails, and
 * the change has to say why the device still accepts it.
 *
 * Reply lines are taken from bench captures where one exists, so a row that
 * fails after a firmware change is telling you the firmware moved, which is
 * exactly when the app has to move with it.
 *
 * Adding a command means adding a row. The last test enforces that.
 */

type Row = {
    /** Arguments passed to the registry factory. */
    args?: unknown[]
    /** Exact string that must go to the device. */
    wire: string | RegExp
    /** One reply line the device sends that this command must accept as success. */
    accepts: string | string[]
    /** One reply line that must be treated as failure, when the command has a failure matcher. */
    rejects?: string
}

const GOLDEN: Record<keyof typeof commandRegistry, Row> = {
    // -- nRF-answered --
    battery: { wire: 'battery', accepts: 'battery 82%' },
    version: { wire: 'ver', accepts: 'WW500-C02 V 00.30.50 02:56:03 Sep 15 2026' },
    dfu: { wire: 'dfu', accepts: 'Device will enter DFU mode after disconnecting.' },
    reset: { wire: 'reset', accepts: 'Device will reset after disconnecting.' },
    ping: { wire: 'ping', accepts: ['Joined', 'Not Joined'] },
    pingToNetwork: { wire: 'ping', accepts: 'Pong', rejects: 'Error: no network' },
    network: { wire: 'network', accepts: ['RSSI: -80dB, SNR: 5dB', 'No network comms yet'] },
    setutc: {
        args: ['2026-09-20T05:17:54.123Z'],
        wire: 'setutc 2026-09-20T05:17:54Z',
        accepts: ['UTC is: 2026-09-20T04:43:38Z', 'RTC set to 2026-09-20T05:17:54Z'],
    },
    disconnect: { wire: 'dis', accepts: 'Disconnect' },
    flashh: { wire: 'flashh', accepts: 'Flash header ok', rejects: 'Flash error' },
    deveui: { wire: 'get deveui', accepts: 'DevEui 70B3D57ED0060B7C' },
    appeui: { wire: 'get appeui', accepts: 'AppEui 0000000000000000' },
    appkey: { wire: 'get appkey', accepts: 'AppKey 00000000000000000000000000000000' },
    selftest: { wire: 'selftest', accepts: 'Error bits = 0x0000' },
    wake: { wire: 'wake', accepts: ['Wake', 'Waking AI processor', 'AI processor is awake'] },
    camera_type: { wire: 'camera_type', accepts: 'Camera type: RP3' },

    // -- relayed to the Himax with the `AI ` prefix --
    aiinfo: { wire: 'AI info', accepts: '30000K total, 29000K available' },
    aiver: { wire: 'AI ver', accepts: 'WW500_C02 05:31:26 Sep 15 2026' },
    aireset: { wire: 'AI reset', accepts: 'Forcing reset' },
    aifirmware: {
        args: ['OUTPUT.IMG', '0x1A2B'],
        wire: 'AI firmware OUTPUT.IMG 0x1A2B',
        accepts: 'Firmware update OK',
    },
    enableCamera: { wire: 'AI enable', accepts: ['Enabled Camera System', 'Camera Enabled'], rejects: 'already enabled' },
    setdid: {
        args: ['e5b9721d-1959-48e4-8385-6c2c8d837cb9'],
        wire: 'AI setdid e5b9721d-1959-48e4-8385-6c2c8d837cb9',
        accepts: 'Deployment ID set to e5b9721d-1959-48e4-8385-6c2c8d837cb9',
        rejects: 'invalid deployment id',
    },
    // The firmware parses six whitespace-separated fields after underscores are
    // turned into spaces. Decimal CSV is one token and is silently discarded (#315).
    setgps: {
        args: ["0°0'0.00\"_N_0°0'0.00\"_E_0.00_Above"],
        wire: "AI setgps 0°0'0.00\"_N_0°0'0.00\"_E_0.00_Above",
        accepts: 'Device GPS set',
        rejects: 'GPS format error',
    },
    setop: {
        args: [{ index: 26, value: 0 }],
        wire: 'AI setop 26 0',
        accepts: 'Set OpParam 26 = 0',
        rejects: 'Failed to set parameter',
    },
    getops: {
        wire: 'AI getop -1',
        accepts: 'OpParams 2 1 0 0 3 1 500 0 1000 5 1 1000 100 0 1 1 18 1 0 1 0 2 50 65 0 0 0 286 326 1 110 1 0 0 0 0 0 ',
    },
    getop: {
        args: [19],
        wire: 'AI getop 19',
        accepts: 'OpParam 19 = 1',
        rejects: 'Error: index (40) must be between 0 and 36',
    },
    capture: {
        args: [1, 500],
        wire: 'AI capture 1 500',
        accepts: 'Captured 1 images. Last is AAF67400.JPG (File write 20ms avg.)',
    },
    light: { wire: 'AI light', accepts: 'Checking light level...', rejects: 'Unrecognised command' },
    txfile: { args: ['AAF67400.JPG'], wire: 'AI txfile AAF67400.JPG', accepts: '251568 bytes in 34 packets' },
    md: { args: [2], wire: 'AI md 2', accepts: 'MD sensitivity set to 2', rejects: 'Sleep' },
    erasemodel: { wire: 'AI erasemodel', accepts: 'Model Erased' },
    loadmodel: {
        args: [1, 1],
        wire: 'AI loadmodel 1 1',
        accepts: ['Updated OK', 'Loaded model 1 v1'],
        rejects: 'Error loading model',
    },
    slots: {
        wire: 'AI slots',
        accepts: "Active slot 1 running 'RP3 (day/colour)'. Slot A: 'HM0360 (night/IR)', Slot B: 'RP3 (day/colour)'. Auto-switch: off",
        rejects: 'Slots error: unlabelled',
    },
    switchslot: {
        wire: 'AI switchslot',
        accepts: "Switched to slot 0 ('HM0360 (night/IR)'). Reset scheduled.",
        rejects: 'Slot switch failed',
    },
    dir: { wire: 'AI dir', accepts: '2 dirs, 5 files.' },
    crc: { args: ['1V1.TFL'], wire: 'AI crc 1V1.TFL', accepts: 'CRC 0x35D1 (251568 bytes)', rejects: 'Error: file not found' },
    inithm0360: { wire: 'AI inithm0360', accepts: 'OK', rejects: 'Error: init failed' },
    format: { wire: 'AI format', accepts: 'Formatted OK' },
}

describe('commandRegistry golden wire format', () => {
    for (const [name, row] of Object.entries(GOLDEN) as Array<[keyof typeof commandRegistry, Row]>) {
        describe(name, () => {
            const make = () => (commandRegistry[name] as (...a: any[]) => any)(...(row.args ?? []))

            it('sends exactly the agreed bytes', () => {
                const sent = make().build()
                if (row.wire instanceof RegExp) expect(sent).toMatch(row.wire)
                else expect(sent).toBe(row.wire)
            })

            it('accepts the reply the device actually sends', () => {
                for (const line of ([] as string[]).concat(row.accepts)) {
                    const cmd = make()
                    expect(cmd.successMatcher(line)).toBe(true)
                    cmd.collect(line)
                    expect(cmd.isComplete()).toBe(true)
                }
            })

            if (row.rejects) {
                it('treats the known failure line as a failure, not a timeout', () => {
                    const cmd = make()
                    expect(cmd.failureMatcher(row.rejects!)).toBe(true)
                    cmd.collect(row.rejects!)
                    expect(cmd.isComplete()).toBe(true)
                    expect(() => cmd.parser()).toThrow()
                })
            }
        })
    }

    it('has a golden row for every command in the registry', () => {
        // A new command with no row is the only way to reintroduce #315.
        const registered = Object.keys(commandRegistry).sort()
        const covered = Object.keys(GOLDEN).sort()
        expect(covered).toEqual(registered)
    })
})
