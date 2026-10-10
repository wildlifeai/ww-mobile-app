import AsyncStorage from '@react-native-async-storage/async-storage'

import { runDeviceCheck, overallVerdict, describeSelfTest, CheckStepId, CheckStepState, DeviceCheckDeps, DeviceCheckSession } from '../deviceCheck'
import { bleEventBus } from '../../protocol/eventBus'
import { commandRegistry } from '../../protocol/commandRegistry'
import type { CommandContext } from '../../protocol/commandRegistry'
import { keepAwake } from '../../session/keepAwake'
import { flashHold } from '../../session/flashHold'
import { mdIntervalHold } from '../../session/mdIntervalHold'
import { SWEEP_UP, SWEEP_DOWN } from '../../../utils/deviceCheck/lensSweep'
import { FACTORY_DEFAULTS } from '../../../hooks/useDeviceSettings'

// An in-memory store, as the hold tests use: the holds write their owed
// restores to it, and `restoreMocks` would strip the global mock between steps.
jest.mock('@react-native-async-storage/async-storage', () => {
    const store = new Map<string, string>()
    return {
        __esModule: true,
        default: {
            setItem: async (key: string, value: string) => { store.set(key, value) },
            getItem: async (key: string) => store.get(key) ?? null,
            removeItem: async (key: string) => { store.delete(key) },
            clear: async () => { store.clear() },
        },
    }
})
jest.mock('../../../utils/logger', () => ({ log: jest.fn(), logWarn: jest.fn(), logError: jest.fn() }))
// Photo sizes as the fake camera wrote them; a download reports the size the
// way the camera's `N bytes in FILE` reply does.
const mockSizes = new Map<string, number>()
jest.mock('../downloadPhoto', () => ({
    downloadPhoto: jest.fn(async (_session: unknown, _deviceId: string, name: string) => ({ uri: `file:///cache/${name}`, bytes: mockSizes.get(name) ?? null })),
}))
// The self-test each boot reports, in order: the restart in the first step,
// then one per camera switch. Clean unless a test queues otherwise.
const mockBoots: { bits: number[] } = { bits: [] }
jest.mock('../../protocol/selfTestCache', () => ({
    selfTestCache: { waitForFresh: jest.fn(async () => ({ bits: mockBoots.bits.shift() ?? 0, ts: Date.now(), postWake: true })) },
}))

const DEVICE = 'AA:BB:CC:DD:EE:FF'

/** The bench sweep of 6 October 2026: sharpest at 640. */
const BENCH_SIZES: Record<number, number> = { 256: 29434, 384: 33776, 512: 41104, 640: 53964, 768: 40080, 896: 32872, 1023: 30903 }

interface FakeOptions {
    start?: 'RP3' | 'HM0360'
    /** Photo size at a lens position, on the colour camera */
    sizeAt?: (position: number) => number
    /** HM0360 mean brightness without and with the IR flash */
    means?: [number, number]
    motionBlocks?: number[]
    /** The burst attempt the camera first acknowledges; earlier ones hang until aborted */
    burstAckOn?: number
    /** The AI processor's clock ignores setutc */
    aiClockStuck?: boolean
    /** The AI processor's clock reads back this far off, as after a sleep (negative is behind) */
    aiClockOffMs?: number
    /** `AI setutc` sets the clock but its reply never arrives */
    aiSetutcSilent?: boolean
    /** After the first `AI dir`, the firmware lists MANIFEST, as it does once CONFIG.TXT is saved */
    dirMovesAway?: boolean
    /** Colour photos start and never finish, as on WILD-HSAN after the restart */
    colourHangs?: boolean
    /** Firmware without `AI dpd` */
    noDpd?: boolean
    /** A `setop` the firmware refuses */
    refuseOp?: number
    /** The first `AI light` is lost, reply and reading both, as when it crosses a sleep */
    lightLostOnce?: boolean
}

/**
 * A WW500 that answers the commands the check sends, by name, with the values
 * the registry would parse out of its replies, and sends the telemetry the
 * check listens for (register blocks, motion grids) as the real one does.
 */
const fakeDevice = (opts: FakeOptions = {}) => {
    const ops = Array.from({ length: 37 }, () => '0')
    ops[8] = '1000'
    ops[9] = '5'
    ops[10] = '1'
    ops[11] = '0'
    ops[12] = '100'
    ops[13] = '0'
    ops[18] = '0'
    ops[34] = '1'
    const original = ops.slice()

    let running = opts.start ?? 'RP3'
    let lens = 0
    let next = 0
    let bursts = 0
    let dirs = 0
    let lights = 0
    const files = new Map<string, number>()
    const sent: string[] = []
    const means = opts.means ?? [60, 140]
    const sizeAt = opts.sizeAt ?? ((p: number) => BENCH_SIZES[p] ?? 30000)

    const emit = (line: string) => bleEventBus.emitEvent({ type: 'TEXT_LINE', line, ts: Date.now(), deviceId: DEVICE })
    const emitAe = (mean: number) => [
        'HM0360 AE regs:', '  Integration time = 91 lines', '  Analog gain = 1', '  Digital gain = 64',
        `  AE Mean = ${mean}`, '  AEConverged?: Y',
    ].forEach(emit)

    const execute = jest.fn(async <T,>(ctor: () => CommandContext<T>, options?: { signal?: AbortSignal }): Promise<T> => {
        const ctx = ctor()
        const cmd = ctx.build()
        sent.push(cmd)
        const reply = (value: unknown) => value as T
        const words = cmd.split(' ')

        if (cmd === 'ver') return reply('0.30.50')
        if (cmd === 'AI ver') return reply(`WW500_${running}_TEST`)
        if (cmd === 'AI slots') {
            return reply({ activeSlot: running === 'RP3' ? 1 : 0, running: running === 'RP3' ? 'RP3 (day/colour)' : 'HM0360 (night/IR)', slotA: 'HM0360 (night/IR)', slotB: 'RP3 (day/colour)', autoSwitch: false })
        }
        if (cmd === 'AI getop -1') return reply(ops.slice())
        if (cmd === 'AI reset') return reply(true)
        if (cmd === 'AI dpd') {
            if (opts.noDpd) throw new Error('Unrecognised command')
            return reply(true)
        }
        if (cmd.startsWith('AI setop ')) {
            if (+words[2] === opts.refuseOp) throw new Error('TIMEOUT')
            ops[+words[2]] = words[3]
            return reply(true)
        }
        if (cmd === 'selftest') return reply('Error bits = 0x0000')
        if (cmd === 'battery') return reply(87)
        if (cmd === 'temp') return reply(24.5)
        if (cmd.startsWith('setutc')) return reply(true)
        if (cmd === 'getutc') return reply(`${new Date().toISOString().split('.')[0]}Z`)
        if (cmd.startsWith('AI setutc ')) {
            if (opts.aiSetutcSilent) throw new Error('TIMEOUT')
            return reply(true)
        }
        if (cmd === 'AI getutc') return reply(opts.aiClockStuck ? Date.UTC(2024, 0, 1) : Date.now() + (opts.aiClockOffMs ?? 0))
        if (cmd === 'AI info') return reply({ total: 31166976, free: 31000000 })
        if (/^flash[rgb] /.test(cmd)) return reply(true)
        // As the firmware does, `AI flash` saves its length as op12.
        if (cmd.startsWith('AI flash ')) { ops[12] = words[3]; return reply(true) }
        // The reading follows the acknowledgement on a real device. Sent at
        // once here: every test runs on fake timers (tests/setup/sanitySetup.ts).
        if (cmd === 'AI light') {
            if (opts.lightLostOnce && lights++ === 0) throw new Error('TIMEOUT')
            emitAe(80)
            return reply(true)
        }
        if (cmd.startsWith('AI vcm ')) { lens = +words[2]; return reply(lens) }
        if (cmd.startsWith('AI capture ')) {
            const count = +words[2]
            if (ctx.name === 'captureBurst') {
                if (++bursts < (opts.burstAckOn ?? 1)) {
                    return new Promise<T>((_, reject) => options?.signal?.addEventListener('abort', () => reject(new Error('aborted'))))
                }
                emit(`About to capture ${count} images`)
                ;(opts.motionBlocks ?? [0, 3, 12, 7]).forEach(n => emit(`HM0360 motion in ${n} blocks:`))
                return reply(count)
            }
            if (opts.colourHangs && running === 'RP3') throw new Error('TIMEOUT')
            let name = ''
            for (let i = 0; i < count; i++) {
                name = `F${String(next++).padStart(6, '0')}.JPG`
                files.set(name, running === 'RP3' ? sizeAt(lens) : 20000)
                mockSizes.set(name, files.get(name)!)
            }
            const flashLit = ops[34] === '2' && ops[13] === '2'
            emitAe(flashLit ? means[1] : means[0])
            return reply(name)
        }
        if (cmd === 'AI dir') {
            if (opts.dirMovesAway && dirs++ > 0) return reply(['----A 2026-10-06, 10:43:10        266 CONFIG.TXT', '0 dirs, 1 files.'])
            return reply([...files].map(([name, size]) => `----A 2024-01-01, 00:00:34      ${size} ${name}`).concat(`0 dirs, ${files.size} files.`))
        }
        throw new Error(`fake device does not know "${cmd}"`)
    })

    const session: DeviceCheckSession = {
        execute: execute as DeviceCheckSession['execute'],
        getOps: jest.fn(async () => ops.slice()),
        waitForSleep: jest.fn(async (_ms?: number) => true),
        waitForWake: jest.fn(async () => true),
    }
    const switchCamera = jest.fn(async (target: 'RP3' | 'HM0360') => { running = target; return true })

    return { session, switchCamera, ops, original, sent, running: () => running }
}

const run = async (device: ReturnType<typeof fakeDevice>, overrides: Partial<DeviceCheckDeps> = {}) => {
    const steps: Partial<Record<CheckStepId, CheckStepState>> = {}
    const photos: Record<string, string> = {}
    const ask = jest.fn(async () => true)
    const waitForTap = jest.fn(async () => true)
    const notify = jest.fn()
    await runDeviceCheck({
        session: device.session,
        deviceId: DEVICE,
        referencePeak: null,
        switchCamera: device.switchCamera,
        ask,
        waitForTap,
        notify,
        instruct: jest.fn(),
        onStep: (id, state) => { steps[id] = state },
        onPhoto: (camera, uri) => { photos[camera] = uri },
        onLens: jest.fn(),
        cancelled: () => false,
        pause: async () => undefined,
        ...overrides,
    })
    return { steps, photos, ask, waitForTap, notify }
}

/** The parameters the check changes on the way, which must end on their factory defaults. */
const TOUCHED = [8, 9, 11, 12, 13, 18, 34]
const DEFAULTS = TOUCHED.map(i => String(FACTORY_DEFAULTS[i]))

describe('runDeviceCheck', () => {
    beforeEach(async () => {
        keepAwake.clear()
        flashHold.clear()
        mdIntervalHold.clear()
        await AsyncStorage.clear()
        mockBoots.bits = []
        mockSizes.clear()
    })
    afterEach(() => bleEventBus.removeAllListeners('textLine'))

    it('passes a good unit and leaves it on factory defaults', async () => {
        const device = fakeDevice()
        const { steps, photos } = await run(device)

        expect(Object.fromEntries(Object.entries(steps).map(([id, s]) => [id, s!.status]))).toEqual({
            cameras: 'pass', identity: 'pass', health: 'pass', clock: 'pass', storage: 'pass', leds: 'pass', light: 'pass',
            motion: 'pass', colour: 'pass', white: 'pass', mono: 'pass', ir: 'pass', framing: 'pass',
        })
        expect(overallVerdict(steps)).toBe('pass')
        expect(Object.keys(photos).sort()).toEqual(['HM0360', 'IR', 'RP3', 'WHITE'])
        // Back on the camera it started with, and every setting on its default.
        expect(device.running()).toBe('RP3')
        expect(TOUCHED.map(i => device.ops[i])).toEqual(DEFAULTS)
    })

    it('sweeps the lens up and back, a photo at each position', async () => {
        const device = fakeDevice()
        await run(device)

        const positions = device.sent.filter(c => c.startsWith('AI vcm ')).map(c => +c.split(' ')[2])
        // Then the white flash photo, at the sharpest position.
        expect(positions).toEqual([512, ...SWEEP_UP, ...SWEEP_DOWN, 640])
        // Each position is followed by its photo, so the lens cannot move between them.
        device.sent.forEach((cmd, i) => {
            if (cmd.startsWith('AI vcm ') && i > 0) expect(device.sent[i + 1]).toMatch(/^AI capture /)
        })
    })

    it('shows the sharpest photo of the sweep rather than taking another', async () => {
        const device = fakeDevice()
        const { photos } = await run(device)

        // 3 warm-ups, then the up leg: 640 is the fourth position, file 6.
        expect(photos.RP3).toBe('file:///cache/F000006.JPG')
    })

    it('fails a stuck lens and still tests the rest', async () => {
        const device = fakeDevice({ sizeAt: () => 30000 })
        const { steps } = await run(device)

        expect(steps.colour?.status).toBe('fail')
        expect(steps.colour?.summary).toMatch(/hardly change/)
        expect(steps.mono?.status).toBe('pass')
        expect(steps.ir?.status).toBe('pass')
        expect(overallVerdict(steps)).toBe('fail')
    })

    it('fails an IR flash the operator does not see in the photo, and restores the flash settings', async () => {
        const device = fakeDevice()
        const ask = jest.fn(async (q: string) => !/IR photo/.test(q))
        const { steps } = await run(device, { ask })

        expect(steps.ir?.status).toBe('fail')
        // The flash was armed for the IR photo: LED 2 at 100% in mode 2.
        expect(device.sent).toEqual(expect.arrayContaining(['AI setop 34 2', 'AI setop 13 2', 'AI setop 9 100']))
        expect(TOUCHED.map(i => device.ops[i])).toEqual(DEFAULTS)
    })

    it('takes the white flash photo at the sharpest lens position and puts the flash back', async () => {
        const device = fakeDevice()
        const { steps, ask } = await run(device)

        expect(steps.white?.status).toBe('pass')
        const lit = device.sent.indexOf('AI setop 13 1')
        expect(lit).toBeGreaterThan(-1)
        expect(device.sent.slice(lit)).toEqual(expect.arrayContaining(['AI setop 9 100', 'AI vcm 640']))
        expect(device.sent.slice(0, lit)).toContain('AI setop 34 2')
        expect(ask).toHaveBeenCalledWith(expect.stringMatching(/white flash photo/), ['RP3', 'WHITE'])
        expect(TOUCHED.map(i => device.ops[i])).toEqual(DEFAULTS)
    })

    it('fails a white flash the operator does not see in the photo', async () => {
        const device = fakeDevice()
        const ask = jest.fn(async (q: string) => !/white flash photo/.test(q))
        const { steps } = await run(device, { ask })

        expect(steps.white?.status).toBe('fail')
        expect(steps.leds?.status).toBe('pass')
    })

    it('puts op12 back after the white LED test, which saves its length there', async () => {
        const device = fakeDevice()
        await run(device)

        const test = device.sent.findIndex(c => c.startsWith('AI flash '))
        expect(device.sent[test + 1]).toBe('AI setop 12 100')
        expect(device.ops[12]).toBe('100')
    })

    it('resets the settings to factory defaults first, keeping the model and the deployment', async () => {
        const device = fakeDevice()
        device.ops[10] = '0'
        device.ops[18] = '8'
        device.ops[12] = '500'
        device.ops[14] = '3'
        const { steps } = await run(device)

        const restart = device.sent.indexOf('AI reset')
        expect(device.sent.slice(0, restart)).toEqual(expect.arrayContaining(['AI setop 10 1', 'AI setop 18 0', 'AI setop 12 100']))
        expect(device.sent.some(c => /^AI (erasemodel|setdid|setgps)/.test(c))).toBe(false)
        expect(device.ops[14]).toBe('3')
        expect(steps.identity?.status).toBe('pass')
        expect(steps.colour?.status).toBe('pass')
        expect(TOUCHED.map(i => device.ops[i])).toEqual(DEFAULTS)
    })

    it('warns on the firmware step when a setting could not be reset', async () => {
        const device = fakeDevice({ refuseOp: 16 })
        const { steps } = await run(device)

        expect(steps.identity?.status).toBe('warn')
        expect(steps.identity?.summary).toMatch(/could not all be reset to factory defaults/)
        expect(steps.colour?.status).toBe('pass')
    })

    it('sends the motion burst again when the camera does not start it', async () => {
        const device = fakeDevice({ burstAckOn: 3 })
        const { steps } = await run(device)

        expect(device.sent.filter(c => c === 'AI capture 10 500')).toHaveLength(3)
        expect(steps.motion?.status).toBe('pass')
    })

    it('gives up on the burst after four tries', async () => {
        const device = fakeDevice({ burstAckOn: 99 })
        const { steps } = await run(device)

        expect(device.sent.filter(c => c === 'AI capture 10 500')).toHaveLength(4)
        expect(steps.motion?.summary).toMatch(/did not start the motion burst/)
        expect(device.ops[18]).toBe('0')
    })

    it("sets the AI processor's clock, which the restart rewinds", async () => {
        const device = fakeDevice()
        const { steps } = await run(device)
        expect(device.sent.some(c => /^AI setutc \d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(c))).toBe(true)
        expect(steps.clock?.status).toBe('pass')

        const stuck = fakeDevice({ aiClockStuck: true })
        const result = await run(stuck)
        expect(result.steps.clock?.status).toBe('fail')
    })

    it("warns, not fails, when the AI processor's clock lags after a sleep (Seeed #56, deferred to #251)", async () => {
        const behind = await run(fakeDevice({ aiClockOffMs: -5600 }))
        expect(behind.steps.clock?.status).toBe('warn')
        expect(behind.steps.clock?.summary).toMatch(/5\.6 s behind/)

        const ahead = await run(fakeDevice({ aiClockOffMs: 8000 }))
        expect(ahead.steps.clock?.status).toBe('warn')
        expect(ahead.steps.clock?.summary).toMatch(/8\.0 s ahead/)

        const notSet = await run(fakeDevice({ aiClockOffMs: -400_000 }))
        expect(notSet.steps.clock?.status).toBe('fail')

        const close = await run(fakeDevice({ aiClockOffMs: -3000 }))
        expect(close.steps.clock?.status).toBe('pass')
    })

    it("passes the clock when the AI processor's reply is lost but its clock reads back right", async () => {
        const device = fakeDevice({ aiSetutcSilent: true })
        const { steps } = await run(device)
        expect(steps.clock?.status).toBe('pass')
    })

    it('takes the later photos\' sizes from their download, not a folder listing that has moved', async () => {
        const device = fakeDevice({ dirMovesAway: true })
        const { steps } = await run(device)

        expect(steps.colour?.status).toBe('pass')
        expect(steps.mono?.status).toBe('pass')
        expect(steps.ir?.status).toBe('pass')
        expect(device.sent.filter(c => c === 'AI dir')).toHaveLength(1)
    })

    it('says so when the sweep cannot be listed, rather than calling the photos empty', async () => {
        const device = fakeDevice({ dirMovesAway: true })
        // Use up the one good listing before the sweep reads it.
        await device.session.execute(() => commandRegistry.dir())
        const { steps } = await run(device)

        expect(steps.colour?.status).toBe('fail')
        expect(steps.colour?.summary).toMatch(/listed another folder/)
        expect(steps.white?.status).toBe('skipped')
    })

    it('says a photo that never finished in words, and skips the white flash without its colour photo', async () => {
        const device = fakeDevice({ colourHangs: true })
        const { steps } = await run(device)

        expect(steps.colour?.status).toBe('fail')
        expect(steps.colour?.summary).toBe('The camera started the photo but did not finish it.')
        expect(steps.white?.status).toBe('skipped')
        expect(steps.mono?.status).toBe('pass')
    })

    it('runs the colour camera straight after the firmware step', async () => {
        const device = fakeDevice()
        const order: CheckStepId[] = []
        await run(device, { onStep: (id, state) => { if (state.status === 'running') order.push(id) } })
        expect(order.slice(0, 5)).toEqual(['cameras', 'identity', 'colour', 'white', 'health'])
    })

    it('fails motion detection when no frame saw anything', async () => {
        const device = fakeDevice({ motionBlocks: [0, 0, 0] })
        const { steps } = await run(device)

        expect(steps.motion?.status).toBe('fail')
        // op18 bit 3 is off again, or every later photo would be thrown away.
        expect(device.ops[18]).toBe('0')
        expect(steps.colour?.status).toBe('pass')
    })

    it('leaves the blue LED on after the colour test, as the connection light', async () => {
        const device = fakeDevice()
        await run(device)

        const blue = device.sent.indexOf('flashb 3 200')
        expect(device.sent[blue + 1]).toBe('flashb 1 65535')
    })

    it('sends AI light once more when the first is lost', async () => {
        const device = fakeDevice({ lightLostOnce: true })
        const { steps } = await run(device)

        expect(device.sent.filter(c => c === 'AI light')).toHaveLength(2)
        expect(steps.light?.status).toBe('pass')
    })

    it('asks for a tap while waving once the burst starts, then says hi back', async () => {
        const device = fakeDevice()
        const { waitForTap, notify, steps } = await run(device)

        expect(waitForTap).toHaveBeenCalledTimes(1)
        expect(waitForTap).toHaveBeenCalledWith(expect.stringMatching(/Wave your hand/), "I'm waving", 5000)
        expect(notify).toHaveBeenCalledWith('The Watcher says hi back! You can stop waving now.')
        expect(steps.motion?.status).toBe('pass')
    })

    it('still says to stop waving when the camera saw nothing', async () => {
        const device = fakeDevice({ motionBlocks: [0, 0, 0] })
        const { notify } = await run(device)

        expect(notify).toHaveBeenCalledWith('You can stop waving now.')
    })

    it('does not judge motion when nobody taps, and still restores the test bits', async () => {
        const device = fakeDevice({ motionBlocks: [0, 0, 0] })
        const notify = jest.fn()
        const { steps } = await run(device, { waitForTap: jest.fn(async () => false), notify })

        expect(notify).not.toHaveBeenCalled()
        expect(steps.motion?.status).toBe('skipped')
        expect(steps.motion?.summary).toMatch(/nobody tapped/)
        expect(overallVerdict(steps)).toBe('incomplete')
        expect(device.ops[18]).toBe('0')
    })

    it('names the LED the operator did not see', async () => {
        const device = fakeDevice()
        const ask = jest.fn(async (q: string) => !/white/.test(q))
        const { steps } = await run(device, { ask })

        expect(steps.leds?.status).toBe('fail')
        expect(steps.leds?.summary).toBe('Not seen: the white LED.')
    })

    it('restarts the camera first and reads its boot self-test', async () => {
        const device = fakeDevice()
        const { steps } = await run(device)

        const first = device.sent.findIndex(c => c === 'AI reset')
        expect(first).toBeGreaterThan(-1)
        // Then straight to sleep, so the restart does not wait for op8.
        expect(device.sent[first + 1]).toBe('AI dpd')
        expect(device.sent.slice(0, first).filter(c => !c.startsWith('AI setop') && c !== 'AI slots')).toEqual([])
        expect(steps.cameras?.summary).toBe('0x0000: both cameras answered.')
    })

    it('still restarts the camera on firmware without AI dpd, on its own timer', async () => {
        const device = fakeDevice({ noDpd: true })
        const { steps } = await run(device)

        expect(steps.cameras?.status).toBe('pass')
        expect(steps.cameras?.summary).toBe('0x0000: both cameras answered.')
    })

    it('flags a camera that does not answer first, and skips every photo step', async () => {
        const device = fakeDevice()
        mockBoots.bits = [0x0100]
        const { steps } = await run(device)

        expect(steps.cameras?.status).toBe('fail')
        expect(steps.cameras?.summary).toMatch(/^0x0100: the colour camera \(RP3\) did not answer\./)
        for (const id of ['light', 'motion', 'colour', 'white', 'mono', 'ir', 'framing'] as const) {
            expect(steps[id]?.status).toBe('skipped')
        }
        expect(device.sent.some(c => c.startsWith('AI vcm') || c.startsWith('AI capture'))).toBe(false)
        // The checks that need no camera still run.
        expect(steps.storage?.status).toBe('pass')
        expect(overallVerdict(steps)).toBe('fail')
    })

    it('names the HM0360 when the colour image cannot reach it', async () => {
        const device = fakeDevice()
        mockBoots.bits = [0x0200]
        const { steps } = await run(device)

        expect(steps.cameras?.summary).toMatch(/the HM0360 sensor did not answer/)
    })

    it('brings a long sleep timer down for the check and leaves it on the default', async () => {
        const device = fakeDevice()
        device.ops[8] = '60000'
        await run(device)

        expect(device.sent.filter(c => c.startsWith('AI setop 8 '))).toEqual(['AI setop 8 1000', 'AI setop 8 3000', 'AI setop 8 1000'])
        // `AI dpd` brings the restart forward, but the wait still allows for
        // the old timer, for firmware without it.
        expect(device.session.waitForSleep).toHaveBeenCalledWith(70000)
        expect(device.ops[8]).toBe('1000')
    })

    it('fails the camera step when the new image boots without its sensor', async () => {
        const device = fakeDevice()
        // Clean at the restart, then the black & white image boots without its camera.
        mockBoots.bits = [0x0000, 0x0100]
        const { steps } = await run(device)

        // Starting on the colour camera, the black & white one is the first switch.
        expect(steps.colour?.status).toBe('pass')
        expect(steps.mono?.status).toBe('fail')
        expect(steps.mono?.summary).toMatch(/^0x0100: the black & white camera \(HM0360\) did not answer/)
        expect(steps.ir?.status).toBe('skipped')
        expect(steps.framing?.status).toBe('skipped')
    })

    it('switches back to the starting camera after a switch that failed', async () => {
        const device = fakeDevice()
        device.switchCamera.mockImplementationOnce(async () => false)
        await run(device)

        expect(device.switchCamera.mock.calls.map(c => c[0])).toEqual(['HM0360', 'RP3'])
    })

    it('starts on the black & white camera without an extra switch back', async () => {
        const device = fakeDevice({ start: 'HM0360' })
        await run(device)

        expect(device.switchCamera.mock.calls.map(c => c[0])).toEqual(['RP3', 'HM0360'])
        expect(device.running()).toBe('HM0360')
    })

    it('stops between steps when asked, and still restores the device', async () => {
        const device = fakeDevice()
        let stop = false
        const steps: Partial<Record<CheckStepId, CheckStepState>> = {}
        await run(device, {
            cancelled: () => stop,
            onStep: (id, state) => {
                steps[id] = state
                if (id === 'storage' && state.status === 'pass') stop = true
            },
        })

        expect(steps.storage?.status).toBe('pass')
        expect(steps.leds?.status).toBe('skipped')
        expect(device.sent.some(c => /^flash[rgb] /.test(c))).toBe(false)
        expect(TOUCHED.map(i => device.ops[i])).toEqual(DEFAULTS)
    })
})

describe('describeSelfTest', () => {
    // Bit 14 (Seeed PR #240) is a warning, not a camera fault (ww-hardware issue 56).
    it('warns on bit 14 by its name, without failing the unit', () => {
        const state = describeSelfTest(0x4000, 'RP3')

        expect(state.status).toBe('warn')
        expect(state.summary).toMatch(/^0x4000: .*Camera processor could not reach the Bluetooth chip at start-up\.$/)
    })

    it('names a bit the app does not know, rather than an empty list', () => {
        const state = describeSelfTest(0x8000, 'RP3')

        expect(state.status).toBe('warn')
        expect(state.summary).not.toBe('0x8000: .')
        expect(state.summary).toBe('0x8000: unknown self-test code 0x8000.')
    })

    it('still fails a camera fault reported beside an unknown bit', () => {
        const state = describeSelfTest(0x8100, 'RP3')

        expect(state.status).toBe('fail')
        expect(state.summary).toMatch(/^0x8100: the colour camera \(RP3\) did not answer, unknown self-test code 0x8000\./)
    })
})
