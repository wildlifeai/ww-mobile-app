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
	if (typeof name === "string" && !(name in CommandNames)) {
		return null
	}

	const response = COMMANDS[name as CommandNames]

	if (!response) {
		return null
	}

	return response
}

export enum CommandControlTypes {
	READ = "read",
	WRITE = "write",
}

export type CommandConstructOptions = {
	control: CommandControlTypes
	value?: string
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
		writeCommand: (count?: string, duration?: string) => `flashr ${count || '2'} ${duration || '1000'}`,
		description: "Flash red LED 2 times for 1 second each (count duration_ms)",
		type: 'command',
	},
	[CommandNames.flashg]: {
		name: CommandNames.flashg,
		writeCommand: (count?: string, duration?: string) => `flashg ${count || '2'} ${duration || '1000'}`,
		description: "Flash green LED 2 times for 1 second each (count duration_ms)",
		type: 'command',
	},
	[CommandNames.flashb]: {
		name: CommandNames.flashb,
		writeCommand: (count?: string, duration?: string) => `flashb ${count || '2'} ${duration || '1000'}`,
		description: "Flash blue LED 2 times for 1 second each (count duration_ms)",
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
		readRegex: /UTC is: (.*)/,
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
		description: "Set Operational Parameter <index> to <value> (Advanced)",
		type: 'command',
	},
	[CommandNames.getop]: {
		name: CommandNames.getop,
		readCommand: "AI getop",
		writeCommand: (index?: string) => `AI getop ${index || ''}`.trim(),
		readRegex: /Op\[(\d+)\] = (.+)/,
		description: "Get Operational Parameter <index> (Advanced)",
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
		description: "Enable camera and AI system",
		type: 'process',
	},
	[CommandNames.DISABLE_CAMERA]: {
		name: CommandNames.DISABLE_CAMERA,
		writeCommand: () => 'AI setop 10 0',
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
		writeCommand: (gpsString?: string) => `setgps "${gpsString || ''}"`,
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
	name: string
	rssi: number
	id: string
}
