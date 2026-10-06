import { ExtendedPeripheral } from "../redux/slices/devicesSlice"
import { commandRegistry } from "./protocol/commandRegistry"

export type ParseCommands = {
	value?: string
	command?: Command | null
	error?: string
}

export enum CommandNames {
	// Firmware commands (lowercase - match actual BLE commands)
	id = "id",
	ver = "ver",
	battery = "battery",
	heartbeat = "heartbeat",
	deveui = "deveui",
	appeui = "appeui",
	ping = "ping",
	reset = "reset",
	dis = "dis",
	dfu = "dfu",
	status = "status",
	device = "device",
	ai_info = "ai_info",
	selftest = "selftest",
	flashr = "flashr",
	flashg = "flashg",
	flashb = "flashb",
	temp = "temp",
	network = "network",
	join = "join",
	setgps = "setgps",
	getutc = "getutc",
	setop = "setop",
	getop = "getop",
	getop_all = "getop_all",
	ai_ver = "ai_ver",
	wake = "wake",
	slots = "slots",
	switchslot = "switchslot",
	light = "light",
	inithm0360 = "inithm0360",
	dir = "dir",
	format = "format",
	capture_one = "capture_one",
	ai_getgps = "ai_getgps",

	// BLE-processor commands (lowercase)
	setutc = "setutc",
	UPDATE_BLE_FIRMWARE = "UPDATE_BLE_FIRMWARE",
	UPDATE_HIMAX_FIRMWARE = "UPDATE_HIMAX_FIRMWARE",
	MOTION_DETECTION_PREVIEW = "MOTION_DETECTION_PREVIEW",
	CAPTURE_PICTURE = "CAPTURE_PICTURE",
	LIGHT_SENSOR = "LIGHT_SENSOR",
	FILE_TRANSFER_TEST = "FILE_TRANSFER_TEST",
	MODEL_VALIDATION = "MODEL_VALIDATION",
	FIRMWARE_STATUS = "FIRMWARE_STATUS",
	RESET_TO_DEFAULTS = "RESET_TO_DEFAULTS",
	DEV_DEPLOYMENT_TEST = "DEV_DEPLOYMENT_TEST",
	DEVICE_CHECK = "DEVICE_CHECK",

	// Local commands (UPPERCASE - app-only actions)
}

/**
 * If a command does not have a readCommand defined,
 * it basically means that useCommand will ignore any
 * get calls since we can't really read anything.
 *
 * If in addition to readCommand no readRegex is defined,
 * then it's basically an action only command like for
 * example ble disc, since we get no feedback whatsoever.
 */
export type Command = {
	name: CommandNames
	readCommand?: string
	writeCommand?: (value?: string, value2?: string) => string
	/**
	 * The values `writeCommand` needs, in order. The Engineer Console asks for
	 * each one before it sends, and sends nothing until they are all valid, so
	 * a command that writes to the device never goes out with a value nobody
	 * chose. `md` used to fall back to level 0 that way, which the firmware
	 * saves to op17 and which turns motion triggering off (#300).
	 */
	params?: CommandParam[]
	readRegex?: RegExp
	description?: string
	type?: 'command' | 'process' | 'local'
	timeout?: number
	expectedPattern?: RegExp | string | false
}

/** One value a console command needs before it can be sent. See `Command.params`. */
export type CommandParam = {
	label: string
	/** Placeholder shown in the empty field */
	hint?: string
	/**
	 * `op`: an op index, typed as a number or as its `OP_PARAMETER` name.
	 * `int`: a whole number within `min` and `max`.
	 * `text`: one word, since the device splits its command line on spaces.
	 */
	kind: 'op' | 'int' | 'text'
	min?: number
	max?: number
}

/** setop stores a uint16 on the Himax, so this is every value it can hold. */
const OP_VALUE_PARAM: CommandParam = { label: 'Value', kind: 'int', min: 0, max: 65535 }

export const getCommandByName = (name: CommandNames | string): Command | null => {
	if (!name) return null

	// Normalized lookup: Handle "AI info" or "AI setop" by looking for the last part
	// and handle common prefixes
	const parts = name.toString().toLowerCase().split(' ')
	const candidates = [
		name.toString(),
		parts[parts.length - 1], // "info" from "AI info"
		parts.join(''), // "aiinfo" 
		parts.slice(1).join(''), // "info" from "AI info"
	]

	for (const candidate of candidates) {
		// Exact match in Enum values
		const enumValue = Object.values(CommandNames).find(v => v.toLowerCase() === candidate.toLowerCase())
		if (enumValue && COMMANDS[enumValue as CommandNames]) {
			return COMMANDS[enumValue as CommandNames]
		}
		// Exact match in Enum keys
		if (candidate.toUpperCase() in CommandNames) {
			return COMMANDS[CommandNames[candidate.toUpperCase() as keyof typeof CommandNames]]
		}
	}

	// Secondary lookup: Try stripping trailing numeric arguments (e.g. "AI capture 1 1" -> "AI capture")
	const stripped = name.toString().replace(/\b\d+\b/g, '').replace(/\s+/g, ' ').trim()
	if (stripped && stripped !== name.toString()) {
		return getCommandByName(stripped)
	}

	return null
}

export const constructCommandString = (
	name: CommandNames | string,
	options: CommandConstructOptions,
) => {
	const command = getCommandByName(name)

	if (!command) {
		return undefined
	}

	if (options.control === CommandControlTypes.WRITE && command.writeCommand) {
		return command.writeCommand(options.value)
	}

	if (options.control === CommandControlTypes.READ && command.readCommand) {
		return command.readCommand
	}

	return undefined
}

export enum CommandControlTypes {
	READ = "read",
	WRITE = "write",
}

export type CommandConstructOptions = {
	control: CommandControlTypes
	value?: string
}

export type WriteFunction = (
	peripheral: ExtendedPeripheral,
	data: string | undefined,
) => Promise<void>

/**
 * Options for BLE command execution with response tracking
 */
export interface BleCommandOptions {
	/** Timeout in milliseconds (default: 3000) */
	timeout?: number
	/** Maximum number of retries (default: 1) */
	maxRetries?: number
	/** Expected response pattern to prioritize over regex matching (optional). Set to false to disable default regex. */
	expectedPattern?: RegExp | false
}

/**
 * Represents a command waiting for a response
 */
export interface PendingCommand {
	/** Unique request ID */
	id: string
	/** Command name from CommandNames enum */
	commandName: CommandNames | string
	/** Actual command string sent to device */
	commandString: string
	/** Timestamp when command was sent */
	sentAt: number
	/** Timeout in milliseconds */
	timeoutMs: number
	/** Resolve promise with response */
	resolve: (response: string) => void
	/** Reject promise with error */
	reject: (error: Error) => void
	/** Number of times this command has been retried */
	retryCount: number
	/** Maximum retries allowed */
	maxRetries: number
	/** Expected response pattern (optional) */
	expectedPattern?: RegExp | false
	/** Timeout handle to clear when command completes */
	timeoutHandle?: any 
    /** Function to write to device (needed for retries) */
    writeToDevice: WriteFunction
    /** Peripheral to write to */
    peripheral: ExtendedPeripheral
    /** Whether the command echo has been received */
    echoReceived?: boolean
}

export const COMMANDS: {
	[key in CommandNames]: Command
} = {
	[CommandNames.id]: {
		name: CommandNames.id,
		readCommand: "id",
		description: "Send BLE name",
		type: 'command',
	},
	[CommandNames.ver]: {
		name: CommandNames.ver,
		readCommand: "ver",
		// Matches "WW500-A00 V 00.20.07 22:30:18 Jan 28 2026"
		readRegex: /[a-zA-Z0-9-]+\s+V\s+(\d+\.\d+\.\d+(?:-[\w.-]+)?)/i,
		description: "Device, firmware version, build date",
		type: 'command',
	},
	[CommandNames.battery]: {
		name: CommandNames.battery,
		readCommand: "battery",
		// Matches "Battery = 3305mV 100%" or "Battery = 100%"
		readRegex: /\bBattery\s=\s(?:\d+mV\s)?(100|\d{1,3})%/,
		description: "Report battery voltage",
		type: 'command',
	},
	[CommandNames.status]: {
		name: CommandNames.status,
		readCommand: "status",
		// Matches full status response including sensor, LoRaWAN, and sequence
		readRegex: /(?:Trap: \w+\.\s)?Sensor: (enabled|disabled)\./,
		writeCommand: (value?: string) => value || "status",
		description: "Get device status (sensor, LoRaWAN, sequence)",
		type: 'command',
	},
	[CommandNames.heartbeat]: {
		name: CommandNames.heartbeat,
		readCommand: "get heartbeat",
		readRegex: /\bheartbeat\s+is\s+(\d+d|\d+h|\d+m|\d+s)\b/,
		writeCommand: (value?: string) => value ? `heartbeat ${value}` : "get heartbeat",
		description: "Report the LoRaWAN heartbeat interval (get heartbeat)",
		type: 'command',
	},
	[CommandNames.deveui]: {
		name: CommandNames.deveui,
		readCommand: "get deveui",
		readRegex: /\DevEui:\s([a-zA-Z0-9:]+)\b/,
		writeCommand: (value?: string) => value ? `deveui ${value}` : "get deveui",
		description: "Report the LoRaWAN DevEUI (get deveui)",
		type: 'command',
	},
	[CommandNames.appeui]: {
		name: CommandNames.appeui,
		readCommand: "get appeui",
		readRegex: /\bAppEui:\s([a-zA-Z0-9:]+)\b/,
		writeCommand: (value?: string) => value ? `appeui ${value}` : "get appeui",
		description: "Report the LoRaWAN AppEUI, also called JoinEUI (get appeui)",
		type: 'command',
	},
	[CommandNames.ping]: {
		name: CommandNames.ping,
		writeCommand: () => "ping",
		readRegex: /(Joined|Not Joined)/i,
		description: "Send LoRaWAN packet",
		type: 'command',
	},
	[CommandNames.reset]: {
		name: CommandNames.reset,
		writeCommand: () => "reset",
		readRegex: /(Device will reset after disconnecting.)\s*/,
		description: "Board will reset after disconnect",
		type: 'command',
	},
	[CommandNames.dis]: {
		name: CommandNames.dis,
		writeCommand: () => "dis",
		readRegex: /^Disconnecting$/i,
		description: "BLE disconnect",
		type: 'command',
	},
	[CommandNames.dfu]: {
		name: CommandNames.dfu,
		writeCommand: () => "dfu",
		readRegex: /(Device will enter DFU mode after disconnecting.)\s*/,
		description: "Enter DFU mode after disconnect",
		type: 'command',
	},
	[CommandNames.device]: {
		name: CommandNames.device,
		readCommand: "device",
		description: "Product name (e.g. WW500-C00)",
		type: 'command',
	},
	[CommandNames.ai_info]: {
		name: CommandNames.ai_info,
		writeCommand: () => "AI info",
		// Matches total and available drive space response
		// Example: "30515200 K total drive space.\n  30511056 K available."
		readRegex: /(\d+)\s*[Kk]\s*total\s*drive\s*space\.\s*(\d+)\s*[Kk]\s*available/i,
		description: "SD card label, serial number, size and free space in KB",
		type: 'command',
	},
	[CommandNames.selftest]: {
		name: CommandNames.selftest,
		writeCommand: () => "selftest",
		readRegex: /Error\s*bits\s*=\s*(0x[0-9A-Fa-f]+)/,
		description: "Returns self test bit mask",
		type: 'command',
	},
	[CommandNames.flashr]: {
		name: CommandNames.flashr,
		writeCommand: (value?: string) => `flashr ${value || '2 500'}`,
		readRegex: /Flashing\s+(\d+)ms\s+(\d+)\s+times/i,
		description: "Flash the red LED 2 times at 500 ms (flashr <count> <ms>)",
		type: 'command',
	},
	[CommandNames.flashg]: {
		name: CommandNames.flashg,
		writeCommand: (value?: string) => `flashg ${value || '2 500'}`,
		readRegex: /Flashing\s+(\d+)ms\s+(\d+)\s+times/i,
		description: "Flash the green LED 2 times at 500 ms (flashg <count> <ms>)",
		type: 'command',
	},
	[CommandNames.flashb]: {
		name: CommandNames.flashb,
		writeCommand: (value?: string) => `flashb ${value || '2 500'}`,
		readRegex: /Flashing\s+(\d+)ms\s+(\d+)\s+times/i,
		description: "Flash the blue LED 2 times at 500 ms (flashb <count> <ms>)",
		type: 'command',
	},
	[CommandNames.setutc]: {
		name: CommandNames.setutc,
		writeCommand: () => {
			// Format: setutc YYYY-MM-DDTHH:MM:SSZ
			const now = new Date()
			const iso = now.toISOString()
			// Strip milliseconds: "2024-12-07T12:00:00.123Z" -> "2024-12-07T12:00:00Z"
			const timestamp = iso.split('.')[0] + 'Z'
			return `setutc ${timestamp}`
		},
		// Matches "RTC set to..." OR "System time set successfully" OR "UTC is: ..." (device echo/response variations)
		readRegex: /(RTC\s+set\s+to|System\s+time\s+set\s+successfully|UTC\s+is:)/i,
		description: "Sync device clock to phone UTC (auto-generates timestamp)",
		type: 'command',
	},
	[CommandNames.setop]: {
		name: CommandNames.setop,
		writeCommand: (index?: string, value?: string) => `AI setop ${index || ''} ${value || ''}`.trim(),
		params: [
			{ label: 'Index', kind: 'op', hint: 'e.g. 11 or MD_INTERVAL' },
			OP_VALUE_PARAM,
		],
		readRegex: /^Set\s+OpParam\s+(\d+)\s+=\s+(.*)$/i,
		description: "Set Operational Parameter <index> to <value>, saved to CONFIG.TXT at once (Advanced)",
		type: 'command',
	},
	[CommandNames.getop]: {
		name: CommandNames.getop,
		readCommand: "AI getop",
		writeCommand: (index?: string) => `AI getop ${index || ''}`.trim(),
		params: [{ label: 'Index', kind: 'op', hint: 'e.g. 17 or MD_SENSITIVITY' }],
		readRegex: /^Op(?:Param\s+|\[)(\d+)\]?\s+=\s+(.+)$/i,
		description: "Get Operational Parameter <index> (Advanced)",
		type: 'command',
	},
	[CommandNames.getop_all]: {
		name: CommandNames.getop_all,
		readCommand: "AI getop -1",
		writeCommand: () => `AI getop -1`,
		readRegex: /^OpParams\s+(.+)$/i,
		description: "Get all Operational Parameters at once",
		type: 'command',
	},
	[CommandNames.ai_ver]: {
		name: CommandNames.ai_ver,
		readCommand: "AI ver",
		readRegex: /V\s*(\d+\.\d+\.\d+(?:-[\w.-]+)?)/i,
		description: "Get AI processor version",
		type: 'command',
	},
	[CommandNames.wake]: {
		name: CommandNames.wake,
		writeCommand: () => 'wake',
		readRegex: /(AI processor is awake|Waking AI processor|Wake)/i,
		description: "Wake AI processor from Deep Power Down (firmware v0.8.14+)",
		type: 'command',
	},
	[CommandNames.slots]: {
		name: CommandNames.slots,
		readCommand: "AI slots",
		readRegex: /Active slot (\d) running '([^']*)'/i,
		description: "Report firmware slots and the camera variant in each (day/night switching)",
		type: 'command',
	},
	[CommandNames.switchslot]: {
		name: CommandNames.switchslot,
		readCommand: "AI switchslot",
		readRegex: /(Switched to slot \d|Slot switch failed)/i,
		description: "Boot the other firmware slot (day/night camera change); device resets at next sleep",
		type: 'command',
	},
	[CommandNames.inithm0360]: {
		name: CommandNames.inithm0360,
		writeCommand: () => 'AI inithm0360',
		readRegex: /^(OK|Error)/i,
		description: "Reinitialise HM0360 camera sensor registers (diagnostic for black images). HM0360 firmware only",
		type: 'command',
	},
	[CommandNames.dir]: {
		name: CommandNames.dir,
		writeCommand: () => 'AI dir',
		description: "Lists the files in the current directory of the SD card",
		type: 'command',
	},
	[CommandNames.format]: {
		name: CommandNames.format,
		writeCommand: () => 'AI format',
		description: "Erases the SD card and formats it as FAT32, confirming on the camera by itself. Reboot the camera afterwards",
		type: 'command',
	},
	// One tap, one photo, and nothing else (#300): no keep-awake or flash hold,
	// no download, no preview. The device's own replies are the result. Built
	// by the registry's `capture` so the bytes are the golden-tested ones that
	// Capture Picture sends. 500, not 0: the interval is only waited between
	// pictures, but on the HM0360 firmware it also programs the sensor's own
	// frame timer, where 0 means its slowest rate, and 500 is what has been
	// proven on the bench on both cameras.
	[CommandNames.capture_one]: {
		name: CommandNames.capture_one,
		writeCommand: () => commandRegistry.capture(1, 500).build(),
		description: "Take one photo now (AI capture 1 500). Saved to the SD card, not downloaded; the flash fires only if the device has it armed",
		type: 'command',
	},
	[CommandNames.light]: {
		name: CommandNames.light,
		readCommand: 'AI light',
		// The reply is only an acknowledgement ("Checking light level..."); the
		// reading follows a couple of seconds later as its own telemetry line.
		expectedPattern: /^Checking light level/i,
		description: "Measure light without taking a photo (reading follows separately)",
		type: 'command',
	},
	[CommandNames.temp]: {
		name: CommandNames.temp,
		readCommand: "temp",
		readRegex: /Temperature: (-?\d+)\.(\d+)C/,
		description: "Report the BLE chip's own die temperature",
		type: 'command',
	},
	[CommandNames.network]: {
		name: CommandNames.network,
		readCommand: "network",
		readRegex: /RSSI: (-?\d+)dB, SNR: (-?\d+)dB|No network comms yet/i,
		description: "Most recent RSSI, SNR etc",
		type: 'command',
	},
	[CommandNames.join]: {
		name: CommandNames.join,
		writeCommand: () => "join",
		readRegex: /^(Already joined|OK|Wrong state)/i,
		description: "Request a LoRaWAN join",
		type: 'command',
	},
	[CommandNames.setgps]: {
		name: CommandNames.setgps,
		writeCommand: (gpsString?: string) => `AI setgps ${gpsString || ''}`.trim(),
		// Degrees, minutes, seconds with underscores for spaces, the format
		// commandRegistry.setgps sends. Decimal "lat,lng,alt" is one token the
		// firmware silently discards (#315).
		params: [{ label: 'Location', kind: 'text', hint: `e.g. 37°48'30.50"_N_122°25'10.22"_W_500.75_Above` }],
		readRegex: /Device GPS set/i,
		description: "Set the location written into photos, degrees minutes seconds with _ for spaces",
		type: 'command',
	},
	[CommandNames.ai_getgps]: {
		name: CommandNames.ai_getgps,
		readCommand: "AI getgps",
		description: "The location the AI processor writes into photos, as set by setgps",
		type: 'command',
	},
	[CommandNames.getutc]: {
		name: CommandNames.getutc,
		readCommand: "getutc",
		readRegex: /UTC is: (.*)/,
		description: "Get the system time",
		type: 'command',
	},
	[CommandNames.UPDATE_BLE_FIRMWARE]: {
		name: CommandNames.UPDATE_BLE_FIRMWARE,
		description: "Update BLE Firmware (DFU)",
		type: 'process',
	},
	[CommandNames.UPDATE_HIMAX_FIRMWARE]: {
		name: CommandNames.UPDATE_HIMAX_FIRMWARE,
		description: "Update Himax Firmware from SD Card",
		type: 'process',
	},
	[CommandNames.MOTION_DETECTION_PREVIEW]: {
		name: CommandNames.MOTION_DETECTION_PREVIEW,
		description: "Open standalone motion detection preview page",
		type: 'process',
	},
	[CommandNames.CAPTURE_PICTURE]: {
		name: CommandNames.CAPTURE_PICTURE,
		description: "Take a picture: camera mode, flash, preview and gallery",
		type: 'process',
	},
	[CommandNames.LIGHT_SENSOR]: {
		name: CommandNames.LIGHT_SENSOR,
		description: "Light sensor testing and logs",
		type: 'process',
	},
	[CommandNames.FILE_TRANSFER_TEST]: {
		name: CommandNames.FILE_TRANSFER_TEST,
		description: "Send test files to device SD card via BLE",
		type: 'process',
	},
	[CommandNames.MODEL_VALIDATION]: {
		name: CommandNames.MODEL_VALIDATION,
		description: "Validate, download, and load an AI model",
		type: 'process',
	},
	[CommandNames.FIRMWARE_STATUS]: {
		name: CommandNames.FIRMWARE_STATUS,
		description: "Check all firmware versions (BLE, Himax, Config) and update if needed",
		type: 'process',
	},
	[CommandNames.RESET_TO_DEFAULTS]: {
		name: CommandNames.RESET_TO_DEFAULTS,
		description: "Reset ALL operational parameters to factory defaults, erase AI model, clear deployment ID",
		type: 'process',
	},
	[CommandNames.DEV_DEPLOYMENT_TEST]: {
		name: CommandNames.DEV_DEPLOYMENT_TEST,
		description: "Start monitoring with full parameter control (developer testing)",
		type: 'process',
	},
	[CommandNames.DEVICE_CHECK]: {
		name: CommandNames.DEVICE_CHECK,
		description: "Ship check for a finished unit: both cameras, the focus lens, LEDs, sensors, SD card and clocks",
		type: 'process',
	},
}

type CharacteristicProperty =
	| "Read"
	| "Write"
	| "WriteWithoutResponse"
	| "Notify"
	| "Indicate"

type CharacteristicProperties = {
	[key in CharacteristicProperty]?: CharacteristicProperty
}

type Descriptor = {
	value: any
	uuid: string
}

type Characteristic = {
	properties: CharacteristicProperties
	characteristic: string
	service: string
	descriptors?: Descriptor[]
}

type Service = {
	uuid: string
}

type ManufacturerRawData = {
	bytes: number[]
	data: string
	CDVType: string
}

type RawData = {
	bytes: number[]
	data: string
	CDVType: string
}

type Advertising = {
	manufacturerData: any
	txPowerLevel: number
	isConnectable: boolean
	serviceData: any
	localName: string
	serviceUUIDs: string[]
	manufacturerRawData: ManufacturerRawData
	rawData: RawData
}

export type Services = {
	characteristics: Characteristic[]
	services: Service[]
	advertising: Advertising
	name?: string
	rssi: number
	id: string
}
