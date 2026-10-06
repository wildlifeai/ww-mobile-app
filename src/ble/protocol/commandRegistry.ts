

export interface CommandContext<T = any> {
  id: string;
  name: string;
  /** Generate the UART string to send to the device */
  build: (params?: any) => string;
  
  /** Matchers for line-by-line processing */
  successMatcher: (line: string) => boolean;
  failureMatcher: (line: string) => boolean;
  
  /** Check if an incoming line is relevant to this command (matches either success or failure) */
  match: (line: string) => boolean;
  
  /** Accumulate matched lines */
  collect: (line: string) => void;
  /** Sole authority on whether collection is finished */
  isComplete: () => boolean;
  
  /** Format and return the final data */
  parser: () => T;
  getResult: () => T; // Alias to parser for backwards compatibility during migration
  
  /** Optional handler for logging unmatched lines during active state (MUST NOT mutate completion) */
  onUnexpected?: (line: string) => void;
  /** Optional handler for translating a timeout into a specific failure state (e.g., assigning a default) */
  onTimeout?: () => void;
  
  /** Timeout in milliseconds before the command is considered dead */
  timeoutMs?: number;
  
  /** Retry boundaries (violent retry of raw submission if timeout or failure occurs) */
  retryPolicy?: {
      maxRetries: number;
      delayMs?: number;
  };
  
  /** Defines if this command expects a response, is fire-and-forget, or is a continuous stream */
  responseMode?: 'single_line' | 'multi_line' | 'fire_and_forget' | 'stream';
  
  /** Whether the command is safe to execute multiple times (helps queue decide if it can be violently retried safely) */
  idempotent?: boolean;
  
  /** Whether the command can be safely sent while a binary stream is active without corrupting it */
  safeDuringStreaming?: boolean;

  /** If true, runCommandPipeline will automatically pause heartbeats for the
   *  duration of this command and resume them on completion/failure. */
  isLongRunning?: boolean;

  /** If true, the command acquires an exclusive transport lock.
   *  While held, the transport controller rejects all other enqueue attempts. */
  requiresExclusiveLock?: boolean;
}

export interface CommandDefinitionOptions {
   timeoutMs?: number;
   retryPolicy?: {
       maxRetries: number;
       delayMs?: number;
   };
   failureRegex?: RegExp;
   responseMode?: 'single_line' | 'multi_line' | 'fire_and_forget' | 'stream';
   idempotent?: boolean;
   safeDuringStreaming?: boolean;
   isLongRunning?: boolean;
   requiresExclusiveLock?: boolean;
}

/**
 * Helper to create a simple single-line matching command.
 */
export function createSingleLineCommand<T>(
  name: string,
  buildCommand: (...args: any[]) => string,
  regex: RegExp,
  _parseResult: (match: RegExpMatchArray, line?: string) => T,
  options?: CommandDefinitionOptions
): (...args: any[]) => CommandContext<T> {
  return (...args: any[]) => {
    let matchedString: string | null = null;
    let failedString: string | null = null;

    return {
      id: `${name}_${Date.now()}`,
      name,
      timeoutMs: options?.timeoutMs,
      retryPolicy: options?.retryPolicy,
      responseMode: options?.responseMode || 'single_line',
      idempotent: options?.idempotent,
      safeDuringStreaming: options?.safeDuringStreaming,
      isLongRunning: options?.isLongRunning,
      requiresExclusiveLock: options?.requiresExclusiveLock,
      build: () => buildCommand(...args),
      successMatcher: (line: string) => regex.test(line),
      failureMatcher: (line: string) => options?.failureRegex?.test(line) ?? false,
      match: (line: string) => regex.test(line) || (options?.failureRegex?.test(line) ?? false),
      collect: (line: string) => {
        if (options?.failureRegex?.test(line)) {
            failedString = line;
        } else if (regex.test(line)) {
            matchedString = line;
        }
      },
      isComplete: () => matchedString !== null || failedString !== null,
      parser: () => {
        if (failedString) throw new Error(`${name} failed: ${failedString}`);
        if (!matchedString) throw new Error(`${name}: Result accessed before complete`);
        const match = matchedString.match(regex);
        if (!match) throw new Error(`${name}: Parse failure on getResult`);
        return _parseResult(match, matchedString);
      },
      getResult: function() { return this.parser(); }
    };
  };
}

/**
 * Helper to create a multi-line matching command.
 */
export function createMultiLineCommand<T>(
  name: string,
  buildCommand: (...args: any[]) => string,
  lineMatcher: RegExp,
  endMatcher: RegExp,
  parseResult: (lines: string[]) => T,
  options?: CommandDefinitionOptions
): (...args: any[]) => CommandContext<T> {
  return (...args: any[]) => {
    const lines: string[] = [];
    let isDone = false;
    let failedString: string | null = null;

    return {
      id: `${name}_${Date.now()}`,
      name,
      timeoutMs: options?.timeoutMs,
      retryPolicy: options?.retryPolicy,
      responseMode: options?.responseMode || 'multi_line',
      idempotent: options?.idempotent,
      safeDuringStreaming: options?.safeDuringStreaming,
      isLongRunning: options?.isLongRunning,
      requiresExclusiveLock: options?.requiresExclusiveLock,
      build: () => buildCommand(...args),
      successMatcher: (line: string) => lineMatcher.test(line) || endMatcher.test(line),
      failureMatcher: (line: string) => options?.failureRegex?.test(line) ?? false,
      match: (line: string) => lineMatcher.test(line) || endMatcher.test(line) || (options?.failureRegex?.test(line) ?? false),
      collect: (line: string) => {
        if (options?.failureRegex?.test(line)) {
            failedString = line;
            isDone = true;
        } else if (endMatcher.test(line)) {
          lines.push(line);
          isDone = true;
        } else if (lineMatcher.test(line)) {
          lines.push(line);
        }
      },
      isComplete: () => isDone,
      parser: () => {
        if (failedString) throw new Error(`${name} failed: ${failedString}`);
        if (!isDone) throw new Error(`${name}: Result accessed before complete`);
        return parseResult(lines);
      },
      getResult: function() { return this.parser(); },
      onTimeout: () => {
        if (lines.length > 0) {
          isDone = true;
        }
      }
    };
  };
}

/** A BLE (nRF) firmware version as numbers, from `parseBleFirmwareVersion`. */
export interface BleFirmwareVersion {
  major: number;
  minor: number;
  patch: number;
}

const BLE_FIRMWARE_VERSION_PATTERN = /(?:^|\bV\s*)(\d{1,3})\.(\d{1,3})\.(\d{1,3})(?=$|[\s-])/i;

/**
 * Read the BLE (nRF) firmware version out of a `ver` reply.
 *
 * Takes the whole reply, `WW500-C02 V 00.30.51 08:16:11 Sep 18 2026`, or the
 * token the `version` command returns from it, `00.30.51`. The nRF pads each
 * part to two digits and the cloud's `ble` rows do not (`0.30.48`), so both
 * forms read the same. Anything else is null, never a guess.
 *
 * `AI ver` answers for the Himax, a different processor with its own version
 * scheme: never pass its reply here.
 */
export function parseBleFirmwareVersion(reply: string | null | undefined): BleFirmwareVersion | null {
  if (typeof reply !== 'string') return null;
  const match = reply.trim().match(BLE_FIRMWARE_VERSION_PATTERN);
  if (!match) return null;
  return {
    major: parseInt(match[1], 10),
    minor: parseInt(match[2], 10),
    patch: parseInt(match[3], 10),
  };
}

/**
 * HX6538 firmware update error codes returned by xip_update_firmware_from_sd().
 * Maps numeric codes to human-readable descriptions for field debugging.
 */
const FIRMWARE_ERROR_CODES: Record<number, string> = {
  [-1]: 'firmware file not found on SD card (/MANIFEST/output.img)',
  [-2]: 'SD card read error',
  [-3]: 'flash erase failed',
  [-4]: 'flash write failed',
  [-5]: 'flash verify mismatch — data written does not match source',
  [-6]: 'slot selector write failed',
};

/**
 * True when `md` failed because the camera refused it, `Unrecognised` from a
 * build without the command or the firmware's own `Error:`, as opposed to a
 * reply that never came. Kept here so no caller matches device text itself.
 */
export function isMdRefusal(error: unknown): boolean {
  return error instanceof Error && /^md failed: (?:Unrecogni[sz]ed|Error:)/i.test(error.message);
}

/**
 * Exported registry of constructed commands.
 */
export const commandRegistry = {
  battery: createSingleLineCommand<number>(
    'battery',
    () => 'battery',
    /battery.*?(\d+)%/i,
    (match) => parseInt(match[1], 10)
  ),
  aiinfo: createMultiLineCommand<{ total?: number; free?: number; error?: string }>(
    'aiinfo',
    () => 'AI info',
    /(?:Label|Serial|drive space)/i,
    /(?:available|NACK|Unrecogni[sz]ed|Sleep)/i,
    (lines) => {
      const full = lines.join(' ');
      const upper = full.toUpperCase();
      if (upper.includes('UNRECOGNISED') || upper.includes('UNRECOGNIZED')) return { error: 'AI UNRECOGNISED' };
      if (upper.includes('SLEEP')) return { error: 'AI SLEEP' };
      if (upper.includes('NACK')) return { error: 'AI NACK' };
      const totalMatch = full.match(/(\d+)\s*[Kk]\s*total/i);
      const freeMatch = full.match(/(\d+)\s*[Kk]\s*available/i);
      return {
        total: totalMatch ? parseInt(totalMatch[1], 10) : undefined,
        free: freeMatch ? parseInt(freeMatch[1], 10) : undefined,
      };
    },
    { timeoutMs: 12000, retryPolicy: { maxRetries: 0 }, failureRegex: /^(?:AI processor not responding)/i }
  ),
  wake: createSingleLineCommand<boolean>(
    'wake',
    () => 'wake',
    /^(Wake|Waking AI processor|AI processor is awake)/i,
    () => true,
    { timeoutMs: 3000, retryPolicy: { maxRetries: 3 } }
  ),
  selftest: createSingleLineCommand<string>(
    'selftest',
    () => 'selftest',
    /^Error bits = 0x[0-9a-fA-F]+/i,
    (match) => match[0]
  ),
  aifirmware: createSingleLineCommand<boolean>(
    'aifirmware',
    (filename: string, crc?: string) => crc ? `AI firmware ${filename} ${crc}` : `AI firmware ${filename}`,
    /Firmware update (OK|FAILED)(?: \(error (-?\d+)\))?/i,
    (match) => {
      if (match[1].toUpperCase() === 'FAILED') {
         const errorCode = match[2] ? parseInt(match[2], 10) : NaN;
         const errorMsg = FIRMWARE_ERROR_CODES[errorCode] ?? `unknown error (${match[2] ?? '?'})`;
         throw new Error(`Firmware update failed: ${errorMsg}`);
      }
      return true;
    },
    {
      timeoutMs: 120000,
      retryPolicy: { maxRetries: 0 },
      idempotent: false,
      isLongRunning: true,
      requiresExclusiveLock: true,
    }
  ),
  aireset: createSingleLineCommand<boolean>(
    'aireset',
    () => 'AI reset',
    /Forcing reset/i,
    () => true,
    { timeoutMs: 8000, retryPolicy: { maxRetries: 0 } }
  ),
  version: createSingleLineCommand<string>(
    'version',
    () => 'ver',
    /V\s+(\d+\.\d+\.\d+(?:-[\w.-]+)?)/i,
    (match) => match[1]
  ),
  aiver: createSingleLineCommand<string>(
    'aiver',
    () => 'AI ver',
    /((?:WW500_[A-Z0-9_]+.+)|(?:V\s*\d+\.\d+\.\d+(?:-[\w.-]+)?))/i,
    (match) => match[1],
    // 8s: AI processor may need DPD wake cycle (3-5s)
    { timeoutMs: 8000 }
  ),
  dfu: createSingleLineCommand<boolean>(
    'dfu',
    () => 'dfu',
    /(Device will enter DFU mode after disconnecting.)\s*/,
    () => true
  ),
  reset: createSingleLineCommand<boolean>(
    'reset',
    () => 'reset',
    /(Device will reset after disconnecting.)\s*/,
    () => true
  ),
  /** The BLE chip's own die temperature, in degrees C. */
  temp: createSingleLineCommand<number>(
    'temp',
    () => 'temp',
    /Temperature: (-?\d+)\.(\d+)C/,
    (match) => parseFloat(`${match[1]}.${match[2]}`)
  ),
  /** The BLE processor's clock, as the ISO time it reports. */
  getutc: createSingleLineCommand<string>(
    'getutc',
    () => 'getutc',
    /UTC is: (\S+)/i,
    (match) => match[1]
  ),
  /** Flash one of the BLE board's own LEDs: `r`, `g` or `b`, `count` times for `ms` each. */
  boardLed: createSingleLineCommand<boolean>(
    'boardLed',
    (colour: 'r' | 'g' | 'b', count: number, ms: number) => `flash${colour} ${count} ${ms}`,
    /Flashing\s+\d+ms\s+\d+\s+times/i,
    () => true,
    { retryPolicy: { maxRetries: 0 } }
  ),
  ping: createSingleLineCommand<boolean>(
    'ping',
    () => 'ping',
    /(Joined|Not Joined)/i,
    (match) => match[1].toLowerCase() === 'joined'
  ),
  network: createSingleLineCommand<{ rssi: number; snr: number; joined: boolean }>(
    'network',
    () => 'network',
    /RSSI: (-?\d+)dB, SNR: (-?\d+)dB|No network comms yet/i,
    (match) => {
      if (match[0].toLowerCase().includes('no network')) {
        return { rssi: 0, snr: 0, joined: false };
      }
      return { rssi: parseInt(match[1], 10), snr: parseInt(match[2], 10), joined: true };
    }
  ),
  setutc: createSingleLineCommand<boolean>(
    'setutc',
    (isoDateStr?: string) => {
      const stamp = (isoDateStr || new Date().toISOString()).split('.')[0] + 'Z';
      return `setutc ${stamp}`;
    },
    /(RTC\s+set\s+to|System\s+time\s+set\s+successfully|UTC\s+is:)/i,
    () => true
  ),
  disconnect: createSingleLineCommand<boolean>(
    'disconnect',
    () => 'dis',
    /Disconnect/i,
    () => true,
    { timeoutMs: 2000, retryPolicy: { maxRetries: 0 } }
  ),
  enableCamera: createSingleLineCommand<boolean>(
    'enableCamera',
    () => 'AI enable',
    // Firmware replies "Enabled Camera System" (CLI-commands.c prvEnable);
    // older builds said "Camera Enabled" - accept both.
    /Enabled Camera System|Camera Enabled/i,
    () => true,
    { timeoutMs: 10000, failureRegex: /already enabled/i }
  ),

  // -- Deployment & Operations --
  setdid: createSingleLineCommand<boolean>(
    'setdid',
    (uuid: string | null) => `AI setdid ${uuid || '00000000-0000-0000-0000-000000000000'}`,
    /^Deployment ID set to/i,
    () => true,
    { timeoutMs: 8000, failureRegex: /invalid/i, retryPolicy: { maxRetries: 3 } }
  ),

  setgps: createSingleLineCommand<boolean>(
    'setgps',
    (gpsString: string) => `AI setgps ${gpsString}`,
    /^Device GPS set/i,
    () => true,
    { timeoutMs: 8000, failureRegex: /format error/i }
  ),

  setop: createSingleLineCommand<boolean>(
    'setop',
    ({ index, value }: { index: number, value: number | string }) => `AI setop ${index} ${value}`,
    /^(?:Set\s+OpParam.*?|Op(?:Param)?(?:\s+|\[)\d+\]?\s*=)/i,
    () => true,
    // 8s timeout: DPD wake cycle (boot → selftest → process → respond)
    // takes 3-5s. Default 3s caused premature retries/duplicates.
    { timeoutMs: 8000, failureRegex: /Failed|Invalid/i, retryPolicy: { maxRetries: 2 } }
  ),

  getops: createSingleLineCommand<string[]>(
    'getops',
    () => `AI getop -1`,
    /^OpParams\s+(.+)$/i,
    (match) => match[1].trim().split(/\s+/),
    // 8s: AI processor may need DPD wake cycle (3-5s)
    { timeoutMs: 8000 }
  ),

  getop: createSingleLineCommand<string>(
    'getop',
    (index: number | string) => `AI getop ${index}`,
    /^Op(?:Param)?(?:\s+|\[)\d+\]?\s*=\s*(.*)$/i,
    (match) => match[1].trim(),
    // 8s: AI processor may need DPD wake cycle (3-5s)
    //
    // failureRegex: the app and the firmware do not always agree on how many
    // op indices exist (the app once carried op32 before any build shipped
    // it), so asking for one the running build does not have is an expected
    // outcome, not a fault. Without this the rejection matches
    // neither success nor failure and the command sits for the full 8s,
    // then retries for another 8. Measured on the bench, 2 September:
    // 16s of dead time and two DPD wakes on entering Capture Preview,
    // which blocked the capture behind it for long enough that the flow
    // looked like it had simply done nothing.
    { timeoutMs: 8000, failureRegex: /^Error:\s*index\s*\(-?\d+\)\s*must be between/i }
  ),

  capture: createSingleLineCommand<string | boolean>(
    'capture',
    (count: number, interval: number) => `AI capture ${count} ${interval}`,
    /Captured.*?Last is ([\w.]+)/i,
    (match) => match[1] || true,
    { timeoutMs: 30000, retryPolicy: { maxRetries: 0 } }
  ),

  /**
   * Request a light reading without capturing an image.
   *
   * Two-phase, and deliberately so: this resolves on the immediate
   * acknowledgement only. The reading itself arrives afterwards as unsolicited
   * telemetry (the "HM0360 AE regs" block and the "AE light check" decision
   * line), so a caller wanting the answer must listen for it — see
   * lightCheck.ts. An earlier firmware version that blocked until the reading
   * was ready deadlocked over BLE, so do not ask for a synchronous variant.
   *
   * The "Unrecognised" failure is the capability probe: firmware older than the
   * light-sensor work has no `light` command, and callers fall back to taking a
   * real capture instead.
   */
  light: createSingleLineCommand<boolean>(
    'light',
    () => 'AI light',
    /^Checking light level/i,
    () => true,
    // 8s to match the other AI commands: the processor may need a DPD wake first.
    //
    // Never retried, for two reasons. A retry fires a second real capture on the
    // device, and the caller is listening for the reading on the event bus rather
    // than on this reply, so a lost acknowledgement costs nothing as long as the
    // telemetry still arrives. Worse, a retry doubles the command's worst case to
    // 16s, which is longer than the caller's own 15s budget for the whole
    // measurement: observed on hardware, where the retry landed 8s late and the
    // wait expired before the second attempt could answer.
    { timeoutMs: 8000, retryPolicy: { maxRetries: 0 }, failureRegex: /^Unrecognised|^Failed to queue light check/i },
  ),

  /**
   * Light the white LED directly, at `brightness` percent for `ms` (1 to 1000),
   * whatever op13 and op34 say: the hardware and command path on their own.
   *
   * The firmware answers with an empty line once the LED is off again, so
   * there is nothing to match until the processor sleeps a second later; the
   * Dev Deployment Test's LED test treats a timeout as sent, not failed. Never retried:
   * a retry would light it twice. It also writes op12 FLASH_DURATION, which
   * nothing else reads.
   */
  aiflash: createSingleLineCommand<boolean>(
    'aiflash',
    (brightness: number, ms: number) => `AI flash ${brightness} ${ms}`,
    /^Sleep/i,
    () => true,
    { timeoutMs: 8000, retryPolicy: { maxRetries: 0 }, failureRegex: /^Unrecogni[sz]ed|^Must supply/i }
  ),

  /**
   * Move the RP3's focus lens: 0 (infinity) to 1023 (closest). Only the RP3
   * image has it; the HM0360 image answers `Unrecognised`. The position holds
   * while the AI processor stays awake and is lost when it sleeps, because the
   * camera powers off, so a caller photographing at a position must keep the
   * device awake between the two commands (bench, 6 October 2026).
   */
  vcm: createSingleLineCommand<number>(
    'vcm',
    (position: number) => `AI vcm ${position}`,
    /^VCM position set to (\d+)/i,
    (match) => parseInt(match[1], 10),
    { timeoutMs: 8000, failureRegex: /^VCM (?:write failed|not detected)|^Position must be|^Unrecogni[sz]ed/i }
  ),

  /**
   * The AI processor's own clock. It answers with the bare time, which
   * `exif_utc_time_to_utc_string` writes; both the ISO and the EXIF shapes are
   * accepted, and the parser returns it as epoch milliseconds.
   */
  aiGetutc: createSingleLineCommand<number>(
    'aiGetutc',
    () => 'AI getutc',
    /^(\d{4})[-:](\d{2})[-:](\d{2})[T ](\d{2}):(\d{2}):(\d{2})Z?$/,
    (match) => Date.UTC(+match[1], +match[2] - 1, +match[3], +match[4], +match[5], +match[6]),
    { timeoutMs: 8000, failureRegex: /^Error -?\d+|^Unrecogni[sz]ed/i }
  ),

  /**
   * Set the AI processor's own clock, which photos are stamped with. Its
   * reply echoes the string it was given, but setting the RTC holds the
   * processor's interrupts off for about a second and the reply can be lost
   * while the clock did change (bench, 6 October 2026): read it back with
   * `aiGetutc` rather than trusting a timeout. Never retried, since a retry
   * only sets it again.
   */
  aiSetutc: createSingleLineCommand<boolean>(
    'aiSetutc',
    (isoDateStr?: string) => `AI setutc ${(isoDateStr || new Date().toISOString()).split('.')[0]}Z`,
    /^RTC set to/i,
    () => true,
    { timeoutMs: 8000, retryPolicy: { maxRetries: 0 }, failureRegex: /^Error -?\d+/i }
  ),

  /**
   * `capture` for a burst whose files may not be kept: with test-mode bit 3
   * set the firmware writes no file, so its summary carries no `Last is` and
   * `capture` would wait out its timeout. Resolves on `Captured N images`.
   */
  captureBurst: createSingleLineCommand<number>(
    'captureBurst',
    (count: number, interval: number) => `AI capture ${count} ${interval}`,
    /^Captured\s+(\d+)\s+images/i,
    (match) => parseInt(match[1], 10),
    { timeoutMs: 45000, retryPolicy: { maxRetries: 0 } }
  ),

  txfile: createSingleLineCommand<boolean>(
    'txfile',
    (filename: string = '.') => `AI txfile ${filename}`,
    /(\d+\s+bytes\s+in|Failed to open)/i, 
    (match) => {
      if (match[0].toLowerCase().includes('failed')) {
        throw new Error('No files found on device to download');
      }
      return true;
    },
    { timeoutMs: 10000, retryPolicy: { maxRetries: 0 } }
  ),

  // -- LoRaWAN Network Commands --
  pingToNetwork: createSingleLineCommand<boolean>(
    'pingToNetwork',
    () => 'ping',
    /^Pong|Sent ping/i,
    () => true,
    { failureRegex: /^Error|Failed/i }
  ),
  
  deveui: createSingleLineCommand<string>(
    'deveui',
    () => 'get deveui',
    /DevEui\s+(.+)/i,
    (match) => match[1].trim()
  ),
  
  appeui: createSingleLineCommand<string>(
    'appeui',
    () => 'get appeui',
    /AppEui\s+(.+)/i,
    (match) => match[1].trim()
  ),
  
  appkey: createSingleLineCommand<string>(
    'appkey',
    () => 'get appkey',
    /AppKey\s+(.+)/i,
    (match) => match[1].trim()
  ),

  // -- AI Advanced Commands --
  // The md command sets the HM0360 motion detection sensitivity.
  // Response: "MD sensitivity set to N". We keep maxRetries: 0 because
  // the sensitivity is persisted to CONFIG.TXT regardless of whether
  // the response arrives over BLE.
  //
  // 2 s, not 5: the Himax answers within 0.2 s, and on the HM0360 build the
  // nRF takes that answer for its `MD <time>` motion wake and drops it
  // (ww-hardware #52), so a longer wait only paid for a reply that never
  // comes (#272, 23 September 2026). The RP3 build has no `md` and answers
  // `Unrecognised` (Seeed #211); that and the firmware's own `Error:` lines
  // are refusals, told apart from a lost reply by `isMdRefusal`.
  md: createSingleLineCommand<boolean>(
    'md',
    (level: number) => `AI md ${level}`,
    /^MD sensitivity set to/i,
    () => true,
    { timeoutMs: 2000, retryPolicy: { maxRetries: 0 }, failureRegex: /^Sleep|^Unrecogni[sz]ed|^Error:/i }
  ),

  erasemodel: createSingleLineCommand<boolean>(
    'erasemodel',
    () => 'AI erasemodel',
    /Erased/i,
    () => true,
    { timeoutMs: 15000 }
  ),

  loadmodel: createSingleLineCommand<boolean>(
    'loadmodel',
    (id: number, ver: number) => `AI loadmodel ${id} ${ver}`,
    /(Loaded|Updated OK)/i,
    () => true,
    { timeoutMs: 30000, failureRegex: /Error loading|Update failed/i }
  ),

  camera_type: createSingleLineCommand<string>(
    'camera_type',
    () => 'camera_type',
    /Camera type: (.*)/i,
    (match) => match[1].trim()
  ),

  // -- Day/night dual-image camera switching --
  // The device holds two firmware images in A/B flash slots: an HM0360 (night/IR)
  // variant and an RP3/IMX708 (day/colour) variant. See slots/switchslot on the
  // Himax CLI and camera_switch.c in the firmware.

  /** Report the active firmware slot and the camera variant recorded in each slot. */
  slots: createSingleLineCommand<{ activeSlot: number; running: string; slotA: string; slotB: string; autoSwitch: boolean }>(
    'slots',
    () => 'AI slots',
    // The '. Auto-switch: on/off' suffix only exists on op26-capable firmware;
    // older (but still slots-capable) images omit it, so keep that group
    // optional or the whole command fails to parse on them.
    /Active slot (\d) running '([^']*)'\. Slot A: '([^']*)', Slot B: '([^']*)'(?:\. Auto-switch: (on|off))?/i,
    (match) => ({
      activeSlot: parseInt(match[1], 10),
      running: match[2],
      slotA: match[3],
      slotB: match[4],
      autoSwitch: match[5] ? match[5].toLowerCase() === 'on' : false,
    }),
    // 8s: AI processor may need DPD wake cycle (3-5s)
    { timeoutMs: 8000, failureRegex: /Slots error/i }
  ),

  /**
   * Manually boot the firmware image in the other slot (day/night camera change).
   * The device resets when it next sleeps, so expect a disconnect/Sleep+Wake
   * cycle shortly after the response.
   */
  switchslot: createSingleLineCommand<{ newSlot: number; variant: string }>(
    'switchslot',
    () => 'AI switchslot',
    /Switched to slot (\d) \('([^']*)'\)\. Reset scheduled\./i,
    (match) => ({ newSlot: parseInt(match[1], 10), variant: match[2] }),
    {
      timeoutMs: 10000,
      retryPolicy: { maxRetries: 0 },
      idempotent: false,
      failureRegex: /Slot switch failed/i,
    }
  ),
  
  flashh: createSingleLineCommand<boolean>(
    'flashh',
    () => 'flashh',
    /Flash header ok/i,
    () => true,
    { failureRegex: /Flash error/i }
  ),
  dir: createMultiLineCommand<string[]>(
    'dir',
    () => 'AI dir',
    /.+/, // Matches any non-empty line to ensure all directory entries are collected
    /End of directory|\d+\s+dirs?,\s+\d+\s+files?\.?/i,
    (lines) => lines,
    { timeoutMs: 10000 }
  ),
  /**
   * CRC16-CCITT and size of a file in the device's config directory.
   *
   * The same algorithm the file transfer uses, so a file already on the card
   * can be checked against `firmware.crc_checksum` without sending it again.
   * Device replies `CRC 0x1234 (487424 bytes)`.
   */
  crc: createSingleLineCommand<{ crc: string; sizeBytes: number }>(
    'crc',
    (filename: string) => `AI crc ${filename}`,
    /CRC\s+0x([0-9a-fA-F]{1,4})\s+\((\d+)\s+bytes\)/i,
    (match) => ({
      crc: `0x${match[1].toUpperCase().padStart(4, '0')}`,
      sizeBytes: parseInt(match[2], 10),
    }),
    { timeoutMs: 30000, failureRegex: /Error:/i }
  ),
  inithm0360: createSingleLineCommand<boolean>(
    'inithm0360',
    () => 'AI inithm0360',
    /^OK$/i,
    () => true,
    { timeoutMs: 10000, retryPolicy: { maxRetries: 0 }, failureRegex: /^Error/i }
  ),
  format: createSingleLineCommand<boolean>(
    'format',
    () => 'AI format',
    /(WARNING|Formatted OK|Format failed)/i,
    (match) => {
      if (match[0].toUpperCase().includes('FAILED')) {
         throw new Error('Format failed');
      }
      return true;
    },
    { timeoutMs: 25000, retryPolicy: { maxRetries: 0 } }
  ),
};
