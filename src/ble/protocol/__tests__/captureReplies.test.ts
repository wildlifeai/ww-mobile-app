import { rxRouter } from '../rxRouter';
import { bleTransport } from '../bleTransportController';
import { runCommandPipeline, SLEEP_REFUSAL_WAIT_MS } from '../runCommandPipeline';
import { commandRegistry } from '../commandRegistry';
import { bleEventBus } from '../eventBus';
import * as transport from '../../transport';

/**
 * The two replies the AI firmware of Seeed PR #275 adds (#476), through the
 * real router, transport and pipeline, with only the BLE write simulated:
 * a capture the camera abandoned ends the command at once with its reason,
 * and a command refused between a cold boot and the first sleep is sent once
 * more after the next Sleep.
 */

jest.mock('../../transport', () => ({
  writeToDevice: jest.fn(),
}));

const DEVICE_ID = 'sim_device';
const peripheral = { id: DEVICE_ID, name: 'Sim', rssi: -50, connected: true } as any;
const mockWrite = transport.writeToDevice as jest.Mock;

const REFUSAL = 'Error: no captures until after the first sleep.';
// Seeed #296's fix, branch 261125_countersLost: refused while on the way to sleep (#535)
const GOING_TO_SLEEP = 'Error: going to sleep, try again.';
const FAILED = 'Capture failed after 1 of 3 images: EDM WDT2 timeout';

const reply = (line: string) => rxRouter.handleIncomingBytes(DEVICE_ID, Buffer.from(`${line}\n`));
const later = (ms: number, line: string) => setTimeout(() => reply(line), ms);

/** Answer the Nth write with `answers[N]`: the lines to send back, and when. */
const answerWrites = (answers: Array<Array<[number, string]>>) => {
  let call = 0;
  mockWrite.mockImplementation(async () => {
    for (const [ms, line] of answers[call++] ?? []) later(ms, line);
    return true;
  });
};

const run = <T>(command: () => any, signal?: AbortSignal) =>
  bleTransport.enqueue<T>((taskSignal) => runCommandPipeline(peripheral, command, { signal: taskSignal }), { signal });

beforeEach(() => {
  jest.useRealTimers();
  jest.clearAllMocks();
  bleTransport.clearAll();
  rxRouter.clearBuffer(DEVICE_ID);
  bleEventBus.removeAllListeners();
});

afterEach(() => {
  bleTransport.clearAll();
  rxRouter.clearBuffer(DEVICE_ID);
});

describe('a capture the camera abandoned (#476)', () => {
  it('ends `capture` at once with the camera\'s own words', async () => {
    answerWrites([[[20, FAILED]]]);

    await expect(run(() => commandRegistry.capture(3, 500))).rejects.toThrow(new Error(FAILED));
    expect(mockWrite).toHaveBeenCalledTimes(1);
  });

  it('ends `captureBurst` the same way', async () => {
    answerWrites([[[20, FAILED]]]);

    await expect(run(() => commandRegistry.captureBurst(3, 500))).rejects.toThrow(new Error(FAILED));
    expect(mockWrite).toHaveBeenCalledTimes(1);
  });
});

describe('a command refused before the first sleep (#476)', () => {
  it('sends a capture again after the next Sleep, and resolves on its photo', async () => {
    answerWrites([
      [[20, REFUSAL], [80, 'Sleep']],
      [[20, 'Captured 1 images. Last is IMAGE001.JPG']],
    ]);

    await expect(run(() => commandRegistry.capture(1, 500))).resolves.toBe('IMAGE001.JPG');
    expect(mockWrite).toHaveBeenCalledTimes(2);
    expect(mockWrite.mock.calls.map((call) => call[1])).toEqual(['AI capture 1 500', 'AI capture 1 500']);
  });

  it('sends a capture refused while going to sleep again after that Sleep (#535)', async () => {
    answerWrites([
      [[20, GOING_TO_SLEEP], [80, 'Sleep']],
      [[20, 'Captured 1 images. Last is IMAGE002.JPG']],
    ]);

    await expect(run(() => commandRegistry.capture(1, 500))).resolves.toBe('IMAGE002.JPG');
    expect(mockWrite).toHaveBeenCalledTimes(2);
  });

  // Seeed #207: the commands that change saved settings are refused the same
  // way while the camera saves them for sleep, and nothing is set
  it.each([
    ['setop', () => commandRegistry.setop({ index: 32, value: 0 }), 'Set OpParam 32 = 0'],
    ['setdid', () => commandRegistry.setdid(null), 'Deployment ID set to 00000000-0000-0000-0000-000000000000'],
    ['setgps', () => commandRegistry.setgps('0 0 N 0 0 E 0 Above'), 'Device GPS set'],
    ['md', () => commandRegistry.md(2), 'MD sensitivity set to 2'],
  ])('sends `%s` refused while going to sleep again after that Sleep (Seeed #207)', async (_name, command, done) => {
    answerWrites([
      [[20, GOING_TO_SLEEP], [80, 'Sleep']],
      [[20, done]],
    ]);
    const started = Date.now();

    await expect(run(command)).resolves.toBe(true);
    expect(mockWrite).toHaveBeenCalledTimes(2);
    expect(mockWrite.mock.calls[1][1]).toBe(mockWrite.mock.calls[0][1]);
    // Sent again on the Sleep, not after sitting out the 8 s timeout
    expect(Date.now() - started).toBeLessThan(4000);
  });

  it('sends `AI light` again the same way, and never treats the refusal as a missing command', async () => {
    answerWrites([
      [[20, REFUSAL], [80, 'Sleep']],
      [[20, 'Checking light level...']],
    ]);

    await expect(run(() => commandRegistry.light())).resolves.toBe(true);
    expect(mockWrite).toHaveBeenCalledTimes(2);
  });

  it('sends it once more only', async () => {
    answerWrites([
      [[20, REFUSAL], [80, 'Sleep']],
      [[20, REFUSAL], [80, 'Sleep']],
    ]);

    await expect(run(() => commandRegistry.capture(1, 500))).rejects.toThrow(REFUSAL);
    expect(mockWrite).toHaveBeenCalledTimes(2);
  });

  it('gives up with the refusal when no Sleep comes', async () => {
    jest.useFakeTimers();
    answerWrites([[[20, REFUSAL]]]);

    const result = run(() => commandRegistry.capture(1, 500)).catch((e: Error) => e);
    await jest.advanceTimersByTimeAsync(SLEEP_REFUSAL_WAIT_MS + 1000);
    expect(((await result) as Error).message).toBe(REFUSAL);
    expect(mockWrite).toHaveBeenCalledTimes(1);
  });

  it('sends nothing more once the command is cancelled while it waits', async () => {
    answerWrites([[[20, REFUSAL]]]);
    const abort = new AbortController();

    const result = run(() => commandRegistry.capture(1, 500), abort.signal).catch((e: Error) => e);
    await new Promise((r) => setTimeout(r, 100));
    abort.abort();
    expect(await result).toBeInstanceOf(Error);
    reply('Sleep');
    await new Promise((r) => setTimeout(r, 700));
    expect(mockWrite).toHaveBeenCalledTimes(1);
  });
});
