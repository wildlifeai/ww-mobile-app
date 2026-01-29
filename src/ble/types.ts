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
	appkey = "appkey",
	ping = "ping",
	reset = "reset",
	erase = "erase",
	dis = "dis",
	dfu = "dfu",
	status = "status",
	device = "device",
	aiinfo = "aiinfo",
	selftest = "selftest",
	flashr = "flashr",
	flashg = "flashg",
	flashb = "flashb",
	temp = "temp",
	network = "network",
	join = "join",
	getgps = "getgps",
	setgps = "setgps",
	getutc = "getutc",
	state = "state",
	setop = "setop",
	getop = "getop",
	getops = "getops",
	ai_ver = "ai_ver",
	erasemodel = "erasemodel",
	loadmodel = "loadmodel",
	wake = "wake",

	// Process commands (UPPERCASE - app-specific workflows)
	SET_UTC = "SET_UTC",
	SET_GPS = "SET_GPS",
	AI_CAPTURE = "AI_CAPTURE",
	SET_NUM_PICTURES = "SET_NUM_PICTURES",
	SET_PICTURE_INTERVAL = "SET_PICTURE_INTERVAL",
	SET_TIMELAPSE_INTERVAL = "SET_TIMELAPSE_INTERVAL",
	SET_MOTION_DETECT_INTERVAL = "SET_MOTION_DETECT_INTERVAL",
	DISABLE_MOTION_DETECT = "DISABLE_MOTION_DETECT",
	DISABLE_TIMELAPSE = "DISABLE_TIMELAPSE",
	ENABLE_CAMERA = "ENABLE_CAMERA",
	DISABLE_CAMERA = "DISABLE_CAMERA",
	TX_FILE = "TX_FILE",
	CAPTURE_PREVIEW = "CAPTURE_PREVIEW",
	UPDATE_BLE_FIRMWARE = "UPDATE_BLE_FIRMWARE",

	// Local commands (UPPERCASE - app-only actions)
	CLEAR_CONSOLE = "CLEAR_CONSOLE",
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
	readRegex?: RegExp
	description?: string
	type?: 'command' | 'process' | 'local'
}

export const getCommandByName = (name: CommandNames | string) => {
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

	return null
}

export enum CommandControlTypes {
	READ = "read",
	WRITE = "write",
}

export type CommandConstructOptions = {
	control: CommandControlTypes
	value?: string
}

/**
 * Options for BLE command execution with response tracking
 */
export interface BleCommandOptions {
	/** Timeout in milliseconds (default: 3000) */
	timeout?: number
	/** Retry command if AI NACK received (default: true) */
	retryOnNack?: boolean
	/** Maximum number of retries (default: 1) */
	maxRetries?: number
	/** Wait for Wake + Error bits sequence before considering complete (default: false) */
	waitForWake?: boolean
	/** Expected response pattern to prioritize over regex matching (optional) */
	expectedPattern?: RegExp
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
	expectedPattern?: RegExp
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
		readRegex: /WW500-[a-zA-Z0-9]+\s+V\s+(\d+\.\d+\.\d+)/i,
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
		description: "Report/set heartbeat rate",
		type: 'command',
	},
	[CommandNames.deveui]: {
		name: CommandNames.deveui,
		readCommand: "get deveui",
		readRegex: /\DevEui:\s([a-zA-Z0-9:]+)\b/,
		writeCommand: (value?: string) => value ? `deveui ${value}` : "get deveui",
		description: "Report/set LoRaWan DevEUI",
		type: 'command',
	},
	[CommandNames.appeui]: {
		name: CommandNames.appeui,
		readCommand: "get appeui",
		readRegex: /\bAppEui:\s([a-zA-Z0-9:]+)\b/,
		writeCommand: (value?: string) => value ? `appeui ${value}` : "get appeui",
		description: "Report/set LoRaWan AppEUI",
		type: 'command',
	},
	[CommandNames.appkey]: {
		name: CommandNames.appkey,
		readCommand: "get appkey",
		readRegex: /\bAppKey:\s([a-zA-Z0-9:]+)\b/,
		writeCommand: (value?: string) => value ? `set appkey ${value}` : "get appkey",
		description: "Report/set LoRaWan AppKey (Note: get appkey may fail with 'Failed 2')",
		type: 'command',
	},
	[CommandNames.ping]: {
		name: CommandNames.ping,
		writeCommand: () => "ping",
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
	[CommandNames.erase]: {
		name: CommandNames.erase,
		writeCommand: () => "erase",
		readRegex: /(NVM will be erased after disconnecting.)\s*/,
		description: "Erase NVM after disconnect",
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
	[CommandNames.aiinfo]: {
		name: CommandNames.aiinfo,
		writeCommand: () => "AI info",
		// Matches total and available drive space response
		readRegex: /(\d+)\s*[Kk]\s*total\s*drive\s*space/i,
		description: "Get AI module info (label, serial, total/available drive space in KB)",
		type: 'command',
	},
	[CommandNames.AI_CAPTURE]: {
		name: CommandNames.AI_CAPTURE,
		writeCommand: (count?: string, interval?: string) => `AI capture ${count || '1'} ${interval || '0'}`,
		description: "Capture image(s) with AI module (count interval_ms). Returns filename of last captured image",
		type: 'process',
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
		description: "Flash red LED (count duration_ms)",
		type: 'command',
	},
	[CommandNames.flashg]: {
		name: CommandNames.flashg,
		writeCommand: (value?: string) => `flashg ${value || '2 500'}`,
		readRegex: /Flashing\s+(\d+)ms\s+(\d+)\s+times/i,
		description: "Flash green LED (count duration_ms)",
		type: 'command',
	},
	[CommandNames.flashb]: {
		name: CommandNames.flashb,
		writeCommand: (value?: string) => `flashb ${value || '2 500'}`,
		readRegex: /Flashing\s+(\d+)ms\s+(\d+)\s+times/i,
		description: "Flash blue LED (count duration_ms)",
		type: 'command',
	},
	[CommandNames.SET_UTC]: {
		name: CommandNames.SET_UTC,
		writeCommand: () => {
			// Format: setutc YYYY-MM-DDTHH:MM:SSZ
			const now = new Date()
			const iso = now.toISOString()
			// Strip milliseconds: "2024-12-07T12:00:00.123Z" -> "2024-12-07T12:00:00Z"
			const timestamp = iso.split('.')[0] + 'Z'
			return `setutc ${timestamp}`
		},
		readRegex: /RTC\s+set\s+to[\s:]+(.*)/i,
		description: "Set system time from UTC string",
		type: 'process',
	},
	[CommandNames.SET_GPS]: {
		name: CommandNames.SET_GPS,
		description: "Set GPS location from phone (requires location access)",
		type: 'process',
	},
	[CommandNames.setop]: {
		name: CommandNames.setop,
		writeCommand: (index?: string, value?: string) => `AI setop ${index || ''} ${value || ''}`.trim(),
		readRegex: /^Set\s+OpParam\s+(\d+)\s+=\s+(.*)$/i,
		description: "Set Operational Parameter <index> to <value> (Advanced)",
		type: 'command',
	},
	[CommandNames.getop]: {
		name: CommandNames.getop,
		readCommand: "AI getop",
		writeCommand: (index?: string) => `AI getop ${index || ''}`.trim(),
		readRegex: /^Op\[(\d+)\] = (.+)$/i,
		description: "Get Operational Parameter <index> (Advanced)",
		type: 'command',
	},
	[CommandNames.getops]: {
		name: CommandNames.getops,
		readCommand: "getops",
		readRegex: /OpParams:\s(.+)/,
		description: "Get all operational parameters (array)",
		type: 'command',
	},
	[CommandNames.ai_ver]: {
		name: CommandNames.ai_ver,
		readCommand: "AI ver",
		description: "Get AI processor version",
		type: 'command',
	},
	[CommandNames.erasemodel]: {
		name: CommandNames.erasemodel,
		writeCommand: () => "AI erasemodel",
		description: "Erases the model and write 0, 0 to the CONFIG.TXT lines 14 & 15",
		type: 'command',
	},
	[CommandNames.loadmodel]: {
		name: CommandNames.loadmodel,
		writeCommand: (id?: string, ver?: string) => `AI loadmodel ${id || '0'} ${ver || '0'}`,
		description: "Load model <id> <ver> from SD (e.g. 1V1.TFL) and update lines 14 & 15 of CONFIG.TXT",
		type: 'command',
	},
	[CommandNames.wake]: {
		name: CommandNames.wake,
		writeCommand: () => 'wake',
		readRegex: /AI processor is (awake|Waking AI processor)/,
		description: "Wake AI processor from Deep Power Down (firmware v0.8.14+)",
		type: 'command',
	},
	// Preset Operational Parameter Commands
	[CommandNames.SET_NUM_PICTURES]: {
		name: CommandNames.SET_NUM_PICTURES,
		writeCommand: (count?: string) => `AI setop 5 ${count || '3'}`,
		description: "Set number of images per trigger (default: 3)",
		type: 'process',
	},
	[CommandNames.SET_PICTURE_INTERVAL]: {
		name: CommandNames.SET_PICTURE_INTERVAL,
		writeCommand: (intervalMs?: string) => `AI setop 6 ${intervalMs || '1500'}`,
		description: "Set interval between images in ms (default: 1500)",
		type: 'process',
	},
	[CommandNames.SET_TIMELAPSE_INTERVAL]: {
		name: CommandNames.SET_TIMELAPSE_INTERVAL,
		writeCommand: (intervalSec?: string) => `AI setop 7 ${intervalSec || '900'}`,
		description: "Set timelapse interval in seconds, 0=off (default: 900)",
		type: 'process',
	},
	[CommandNames.SET_MOTION_DETECT_INTERVAL]: {
		name: CommandNames.SET_MOTION_DETECT_INTERVAL,
		writeCommand: (intervalMs?: string) => `AI setop 11 ${intervalMs || '1000'}`,
		description: "Set motion detection interval in ms, 0=off (default: 1000)",
		type: 'process',
	},
	[CommandNames.DISABLE_MOTION_DETECT]: {
		name: CommandNames.DISABLE_MOTION_DETECT,
		writeCommand: () => 'AI setop 11 0',
		description: "Disable motion detection",
		type: 'process',
	},
	[CommandNames.DISABLE_TIMELAPSE]: {
		name: CommandNames.DISABLE_TIMELAPSE,
		writeCommand: () => 'AI setop 7 0',
		description: "Disable timelapse capture",
		type: 'process',
	},
	[CommandNames.ENABLE_CAMERA]: {
		name: CommandNames.ENABLE_CAMERA,
		writeCommand: () => 'AI setop 10 1',
		readRegex: /Set\s+OpParam\s+10\s+=\s+1/i,
		description: "Enable camera and AI system",
		type: 'process',
	},
	[CommandNames.DISABLE_CAMERA]: {
		name: CommandNames.DISABLE_CAMERA,
		writeCommand: () => 'AI setop 10 0',
		readRegex: /Set\s+OpParam\s+10\s+=\s+0/i,
		description: "Disable camera and AI system",
		type: 'process',
	},
	[CommandNames.temp]: {
		name: CommandNames.temp,
		readCommand: "temp",
		readRegex: /Temperature: (-?\d+)\.(\d+)C/,
		description: "Report temperature",
		type: 'command',
	},
	[CommandNames.network]: {
		name: CommandNames.network,
		readCommand: "network",
		readRegex: /RSSI: (-?\d+)dB, SNR: (-?\d+)dB/,
		description: "Most recent RSSI, SNR etc",
		type: 'command',
	},
	[CommandNames.join]: {
		name: CommandNames.join,
		writeCommand: () => "join",
		description: "Request a LoRaWAN join",
		type: 'command',
	},
	[CommandNames.getgps]: {
		name: CommandNames.getgps,
		readCommand: "getgps",
		readRegex: /Location is: (.*)/,
		description: "Get the GPS location",
		type: 'command',
	},
	[CommandNames.setgps]: {
		name: CommandNames.setgps,
		writeCommand: (gpsString?: string) => `setgps ${gpsString || ''}`,
		readRegex: /Device\s+GPS\s+set/i,
		description: "Set GPS location from phone",
		type: 'command',
	},
	[CommandNames.getutc]: {
		name: CommandNames.getutc,
		readCommand: "getutc",
		readRegex: /UTC is: (.*)/,
		description: "Get the system time",
		type: 'command',
	},
	[CommandNames.state]: {
		name: CommandNames.state,
		readCommand: "state",
		readRegex: /State = (.*)/,
		description: "Returns state machine state",
		type: 'command',
	},
	[CommandNames.TX_FILE]: {
		name: CommandNames.TX_FILE,
		// "AI txfile ." requests the last captured file
		writeCommand: () => "AI txfile .",
		description: "Request last captured file from AI module",
		type: 'process',
	},
	[CommandNames.CAPTURE_PREVIEW]: {
		name: CommandNames.CAPTURE_PREVIEW,
		writeCommand: () => "AI capture 1 0",
		description: "Capture image for preview",
		type: 'process',
	},
	[CommandNames.UPDATE_BLE_FIRMWARE]: {
		name: CommandNames.UPDATE_BLE_FIRMWARE,
		description: "Update BLE Firmware (DFU)",
		type: 'process',
	},
	[CommandNames.CLEAR_CONSOLE]: {
		name: CommandNames.CLEAR_CONSOLE,
		description: "Clear Console Output",
		type: 'local',
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
