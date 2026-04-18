

export interface CommandContext<T = any> {
  id: string;
  name: string;
  /** Generate the UART string to send to the device */
  build: (params?: any) => string;
  /** Check if an incoming line is relevant to this command */
  match: (line: string) => boolean;
  /** Accumulate matched lines */
  collect: (line: string) => void;
  /** Sole authority on whether collection is finished */
  isComplete: () => boolean;
  /** Format and return the final data */
  getResult: () => T;
  
  /** Optional handler for logging unmatched lines during active state (MUST NOT mutate completion) */
  onUnexpected?: (line: string) => void;
  /** Optional handler for translating a timeout into a specific failure state (e.g., assigning a default) */
  onTimeout?: () => void;
  
  /** Individual override, falls back to BLE_PROTOCOL_TIMINGS defaults */
  timeoutMs?: number;
}

/**
 * Helper to create a simple single-line matching command.
 */
export function createSingleLineCommand<T>(
  name: string,
  buildCommand: (params?: any) => string,
  regex: RegExp,
  parseResult: (match: RegExpMatchArray) => T,
  timeoutMs?: number
): () => CommandContext<T> {
  return (params?: any) => {
    let matchedString: string | null = null;

    return {
      id: `${name}_${Date.now()}`,
      name,
      timeoutMs,
      build: () => buildCommand(params),
      match: (line: string) => regex.test(line),
      collect: (line: string) => {
        if (regex.test(line)) {
          matchedString = line;
        }
      },
      isComplete: () => matchedString !== null,
      getResult: () => {
        if (!matchedString) throw new Error("Result accessed before complete");
        const match = matchedString.match(regex);
        if (!match) throw new Error("Parse failure on getResult");
        return parseResult(match);
      }
    };
  };
}

/**
 * Exported registry of constructed commands.
 */
export const commandRegistry = {
  battery: createSingleLineCommand<number>(
    'battery',
    () => 'battery',
    /battery(?: is)? (\d+)/i, // legacy regex was: /(?:(?:battery(?: is)?\s*)|(?:voltage\s*(?:\()?(?:mv)?(?:\))?\s*))(?:=\s*)?(\d+)/i
    (match) => parseInt(match[1], 10)
  ),
  aiinfo: createSingleLineCommand<{ total?: number; free?: number; error?: string }>(
    'aiinfo',
    () => 'AI info',
    /(?:SD\s*.*?(\d+)\s+MB\s*.*?(\d+)\s+MB)|(?:AI\s*NACK)/i, // Matches SD stats or Failure
    (match) => {
      if (match[0].toUpperCase().includes('NACK')) {
         return { error: 'AI NACK' };
      }
      return { total: parseInt(match[1], 10), free: parseInt(match[2], 10) };
    }
  ),
  wake: createSingleLineCommand<boolean>(
    'wake',
    () => 'wake',
    /^(Wake|Waking AI processor|AI processor is awake)/i,
    () => true
  ),
  selftest: createSingleLineCommand<string>(
    'selftest',
    () => 'selftest',
    /^Error bits = 0x[0-9a-fA-F]+/i,
    (match) => match[0]
  ),
  aifirmware: createSingleLineCommand<boolean>(
    'aifirmware',
    (filename?: string) => `AI firmware ${filename || 'output.img'}`,
    /Firmware update (OK|FAILED)(?: \(error (-?\d+)\))?/i,
    (match) => {
      if (match[1].toUpperCase() === 'FAILED') {
         const errorCode = match[2] ? match[2] : 'unknown';
         throw new Error(`Firmware update failed on device (error ${errorCode}). Existing firmware unchanged.`);
      }
      return true;
    },
    45000 // 45 seconds timeout for SD read and flash write
  ),
  // Additional commands will be migrated here
};
