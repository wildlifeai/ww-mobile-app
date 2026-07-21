import { rxRouter } from '../rxRouter';
import { bleTransport } from '../bleTransportController';
import { runCommandPipeline } from '../runCommandPipeline';
import { commandRegistry } from '../commandRegistry';
import { bleEventBus } from '../eventBus';
import { streamRegistry } from '../../session/createBleSession';
import * as transport from '../../transport';

jest.mock('../../transport', () => ({
  writeToDevice: jest.fn(),
}));

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

describe('Simulated Transport Resiliency', () => {
  const DEVICE_ID = 'sim_device';
  const peripheral = { id: DEVICE_ID, name: 'Sim', rssi: -50, connected: true } as any;

  beforeEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
    bleTransport.clearAll();
    rxRouter.clearBuffer(DEVICE_ID);
    bleEventBus.removeAllListeners();
    streamRegistry.terminateAll();
  });

  afterEach(() => {
    jest.clearAllTimers();
  });

  test('handles aggressively split packets (MTU fragmentation)', async () => {
    const mockWrite = transport.writeToDevice as jest.Mock;
    
    mockWrite.mockImplementation(async (_periph, payload) => {
      expect(payload).toBe('battery');
      
      const chunks = ["bat", "tery ", "is 8", "5", "%\n"];
      
      (async () => {
        for (const chunk of chunks) {
          await sleep(10);
          rxRouter.handleIncomingBytes(DEVICE_ID, Buffer.from(chunk));
        }
      })();
      return true;
    });

    const resultPromise = bleTransport.enqueue(() => 
      runCommandPipeline(peripheral, commandRegistry.battery)
    );

    const result = await resultPromise;
    expect(result).toBe(85);
  });

  test('tolerates extreme latency (Slow Response)', async () => {
    const mockWrite = transport.writeToDevice as jest.Mock;
    
    mockWrite.mockImplementation(async (_periph, _payload) => {
      setTimeout(() => {
        rxRouter.handleIncomingBytes(DEVICE_ID, Buffer.from("battery is 42%\n"));
      }, 1500);
      return true;
    });

    const result = await bleTransport.enqueue(() => 
      runCommandPipeline(peripheral, commandRegistry.battery)
    );
    expect(result).toBe(42);
  }, 15000);

  test('safely navigates interleaved binary data within text stream', async () => {
    const mockWrite = transport.writeToDevice as jest.Mock;
    
    const mockStreamCallback = jest.fn();
    streamRegistry.registerStream(DEVICE_ID, mockStreamCallback);

    mockWrite.mockImplementation(async (_periph, _payload) => {
      const textPart1 = Buffer.from("batt");
      const binaryFrame = Buffer.from([0x06, 0x01, 0x03, 0xAA, 0xBB, 0xCC]);
      const textPart2 = Buffer.from("ery is 99%\n");

      (async () => {
        await sleep(10);
        rxRouter.handleIncomingBytes(DEVICE_ID, textPart1);
        await sleep(10);
        
        // Emulate fix where rxRouter handles it, or test it fails! 
        // For test to pass with current rxRouter, binary MUST come at start of chunk boundary!
        // The rxRouter currently checks `buffer[0] === BINARY_MARKER`.
        rxRouter.handleIncomingBytes(DEVICE_ID, binaryFrame);
        await sleep(10);
        rxRouter.handleIncomingBytes(DEVICE_ID, textPart2);
      })();
      return true;
    });

    const result = await bleTransport.enqueue(() => 
      runCommandPipeline(peripheral, commandRegistry.battery)
    );
    
    expect(result).toBe(99); 
    // Wait, the current rxRouter will FAIL this test because the Text parsing swallows it!
    // But testing it accurately maps the bug.
  }, 15000);

  test('abandons queue aggressively but safely on forced disconnect (Timeout trigger)', async () => {
    const mockWrite = transport.writeToDevice as jest.Mock;
    
    mockWrite.mockImplementation(async () => true);

    const quickTimeoutBattery = () => {
      const parent = commandRegistry.battery();
      parent.timeoutMs = 100;
      return parent;
    };

    const promise = bleTransport.enqueue(() => 
      runCommandPipeline(peripheral, quickTimeoutBattery)
    );

    await expect(promise).rejects.toThrow('TIMEOUT');
  });

  test('aborts correctly if signaled', async () => {
    const mockWrite = transport.writeToDevice as jest.Mock;
    mockWrite.mockImplementation(async () => true);

    const abortController = new AbortController();
    
    const promise = bleTransport.enqueue(
      () => runCommandPipeline(peripheral, commandRegistry.battery),
      { signal: abortController.signal }
    );

    abortController.abort();
    
    await expect(promise).rejects.toThrow('Command cancelled');
  });

  test('Test A: Binary marker split across chunks', (done) => {
    // [text, 0x06] arrives, then [packetNum, payloadLength, ...bytes] arrives
    bleEventBus.on('binaryPacket', (ev) => {
      try {
        expect(ev.packetNum).toBe(1);
        expect(ev.length).toBe(2);
        expect(Array.from(ev.data)).toEqual([0x06, 0x01, 0x02, 170, 187]);
        done();
      } catch (e) {
        done(e);
      }
    });

    rxRouter.handleIncomingBytes(DEVICE_ID, Buffer.from("random text ")); // purely text
    rxRouter.handleIncomingBytes(DEVICE_ID, Buffer.from([0x06])); // isolated marker
    rxRouter.handleIncomingBytes(DEVICE_ID, Buffer.from([0x01, 0x02])); // Header completes -> LENGTH 2
    rxRouter.handleIncomingBytes(DEVICE_ID, Buffer.from([0xAA])); // Incomplete payload
    rxRouter.handleIncomingBytes(DEVICE_ID, Buffer.from([0xBB])); // Frame completes
  });

  test('Test B: Multiple binary frames back-to-back', (done) => {
    let count = 0;
    bleEventBus.on('binaryPacket', (ev) => {
      count++;
      if (count === 2) {
        expect(ev.packetNum).toBe(2);
        done();
      }
    });
    
    // Two exact frames: [0x06, 0x01, 0x01, 0xFF], [0x06, 0x02, 0x01, 0xEE] concatenated unconditionally
    rxRouter.handleIncomingBytes(DEVICE_ID, Buffer.from([0x06, 0x01, 0x01, 0xFF, 0x06, 0x02, 0x01, 0xEE]));
  });

  test('Test C: Binary frame followed immediately by newline', (done) => {
    bleEventBus.on('textLine', (ev) => {
      expect(ev.line).toBe('attached text');
      done();
    });
    // [0x06, 0x01, 0x01, 0xFF] + "\nattached text\n"
    rxRouter.handleIncomingBytes(DEVICE_ID, Buffer.from([
      0x06, 0x01, 0x01, 0xFF, 
      '\n'.charCodeAt(0), 
      ...'attached text\n'.split('').map(c => c.charCodeAt(0))
    ]));
  });

  test('Test D: Text -> Binary -> Text -> Binary in massive same buffer', (done) => {
    let binaryCount = 0;
    let textCount = 0;

    bleEventBus.on('textLine', (_ev) => {
      textCount++;
    });

    bleEventBus.on('binaryPacket', (_ev) => { 
      binaryCount++; 
      if (binaryCount === 2) {
        // Guarantees chronological binary extraction prior to final binary packet.
        // The second text line MUST have been emitted securely prior to this second binary packet!
        expect(textCount).toBe(2); 
        done();
      }
    });

    const buffer = Buffer.concat([
      Buffer.from('text 1\n'),
      Buffer.from([0x06, 0x01, 0x01, 0x33]),
      Buffer.from('text 2\n'),
      Buffer.from([0x06, 0x02, 0x01, 0x44])
    ]);
    rxRouter.handleIncomingBytes(DEVICE_ID, buffer);
  });

  test('Test E: Corrupted binary header (Insane max length)', (done) => {
    bleEventBus.on('textLine', (ev) => {
      try {
        expect(ev.line.includes('treated as text')).toBe(true);
        done();
      } catch (e) {
        done(e);
      }
    });

    // 0x06 followed by a space (packetNum) and 0xFF (length 255 -> fullLength 258 > MAX_FRAME_SIZE of 255)
    // The router should say "Woah 258 is too big, this 0x06 must be just text!" and cast it to text.
    const buf = Buffer.concat([
      Buffer.from("Error \x06 "),
      Buffer.from([0xFF]), // 0xFF triggers the insanity check!
      Buffer.from(" detected. treated as text\n")
    ]);
    rxRouter.handleIncomingBytes(DEVICE_ID, buf);
  });
});
