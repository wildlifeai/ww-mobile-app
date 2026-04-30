

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
   *  While held, the commandQueue rejects all other enqueue attempts. */
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
      getResult: function() { return this.parser(); }
    };
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
    /(?:available|NACK)/i,
    (lines) => {
      const full = lines.join(' ');
      if (full.toUpperCase().includes('NACK')) return { error: 'AI NACK' };
      const totalMatch = full.match(/(\d+)\s*[Kk]\s*total/i);
      const freeMatch = full.match(/(\d+)\s*[Kk]\s*available/i);
      return {
        total: totalMatch ? parseInt(totalMatch[1], 10) : undefined,
        free: freeMatch ? parseInt(freeMatch[1], 10) : undefined,
      };
    },
    { timeoutMs: 12000, retryPolicy: { maxRetries: 0 }, failureRegex: /^(?:NACK|AI processor not responding)/i }
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
    (filename: string) => `AI firmware ${filename}`,
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
    (match) => match[1]
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
    /Camera Enabled/i,
    () => true,
    { timeoutMs: 10000, failureRegex: /already enabled/i }
  ),

  // -- Deployment & Operations --
  setdid: createSingleLineCommand<boolean>(
    'setdid',
    (uuid: string | null) => `AI setdid ${uuid || '00000000-0000-0000-0000-000000000000'}`,
    /^Deployment ID set to/i,
    () => true,
    { failureRegex: /invalid/i, retryPolicy: { maxRetries: 3 } }
  ),

  setgps: createSingleLineCommand<boolean>(
    'setgps',
    (gpsString: string) => `AI setgps ${gpsString}`,
    /^Device GPS set/i,
    () => true,
    { failureRegex: /format error/i }
  ),

  setop: createSingleLineCommand<boolean>(
    'setop',
    ({ index, value }: { index: number, value: number | string }) => `AI setop ${index} ${value}`,
    /^(?:Set\s+OpParam.*?|Op(?:Param)?(?:\s+|\[)\d+\]?\s*=)/i,
    () => true,
    { failureRegex: /Failed|Invalid/i, retryPolicy: { maxRetries: 2 } }
  ),

  getops: createSingleLineCommand<string[]>(
    'getops',
    () => `AI getop -1`,
    /^OpParams\s+(.+)$/i,
    (match) => match[1].trim().split(/\s+/)
  ),

  getop: createSingleLineCommand<string>(
    'getop',
    (index: number | string) => `AI getop ${index}`,
    /^Op(?:Param)?(?:\s+|\[)\d+\]?\s*=\s*(.*)$/i,
    (match) => match[1].trim()
  ),

  capture: createSingleLineCommand<string | boolean>(
    'capture',
    (count: number, interval: number) => `AI capture ${count} ${interval}`,
    /Captured.*?Last is ([\w.]+)/i,
    (match) => match[1] || true,
    { timeoutMs: 30000, retryPolicy: { maxRetries: 0 } }
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
  md: createSingleLineCommand<boolean>(
    'md',
    (level: number) => `md ${level}`,
    /^MD Set/i,
    () => true
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
    /Loaded/i,
    () => true,
    { timeoutMs: 30000, failureRegex: /Error loading/i }
  ),

  camera_type: createSingleLineCommand<string>(
    'camera_type',
    () => 'camera_type',
    /Camera type: (.*)/i,
    (match) => match[1].trim()
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
  )
};
