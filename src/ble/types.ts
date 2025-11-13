export type ParseCommands = {
	value?: string
	command?: Command | null
	error?: string
}

export enum CommandNames {
	ID = "ID",
	VERSION = "VERSION",
	BATTERY = "BATTERY",
	HEARTBEAT = "HEARTBEAT",
	DEVEUI = "DEVEUI",
	APPEUI = "APPEUI",
	APPKEY = "APPKEY",
	PING = "PING",
	RESET = "RESET",
	ERASE = "ERASE",
	DISCONNECT = "DISCONNECT",
	DFU = "DFU",
	SENSOR = "SENSOR",
	TRAP = "TRAP",
	LORAWAN = "LORAWAN",
	DEVICE = "DEVICE",
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
	writeCommand?: (value?: string) => string
	readRegex?: RegExp
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
	[CommandNames.ID]: {
		name: CommandNames.ID,
		readCommand: "id",
	},
	[CommandNames.VERSION]: {
		name: CommandNames.VERSION,
		readCommand: "ver",
	},
	[CommandNames.BATTERY]: {
		name: CommandNames.BATTERY,
		readCommand: "battery",
		readRegex: /\bBattery\s=\s(100|\d{1,3})%/,
	},
	[CommandNames.SENSOR]: {
		name: CommandNames.SENSOR,
		readCommand: "status",
		readRegex:
			/Trap: (\w+). Sensor: (enabled|disabled). LoRaWan: ((?:\w+\s*)+)./,
		writeCommand: (value?: string) => `${value}`,
	},
	[CommandNames.TRAP]: {
		name: CommandNames.TRAP,
		readCommand: "status",
		readRegex:
			/Trap: (\w+). Sensor: (enabled|disabled). LoRaWan: ((?:\w+\s*)+)./,
	},
	[CommandNames.LORAWAN]: {
		name: CommandNames.LORAWAN,
		readCommand: "status",
		readRegex: /Sensor: (enabled|disabled). LoRaWan: ((?:\w+\s*)+)\./,
	},
	[CommandNames.HEARTBEAT]: {
		name: CommandNames.HEARTBEAT,
		readCommand: "get heartbeat",
		readRegex: /\bheartbeat\s+is\s+(\d+d|\d+h|\d+m|\d+s)\b/,
		writeCommand: (value?: string) => `heartbeat ${value}`,
	},
	[CommandNames.DEVEUI]: {
		name: CommandNames.DEVEUI,
		readCommand: "get deveui",
		readRegex: /\DevEui:\s([a-zA-Z0-9:]+)\b/,
		writeCommand: (value?: string) => `deveui ${value}`,
	},
	[CommandNames.APPEUI]: {
		name: CommandNames.APPEUI,
		readCommand: "get appeui",
		readRegex: /\bAppEui:\s([a-zA-Z0-9:]+)\b/,
		writeCommand: (value?: string) => `appeui ${value}`,
	},
	[CommandNames.APPKEY]: {
		name: CommandNames.APPKEY,
		readCommand: "get appkey",
		readRegex: /\bAppKey:\s([a-zA-Z0-9:]+)\b/,
		writeCommand: (value?: string) => `appkey ${value}`,
	},
	[CommandNames.PING]: {
		name: CommandNames.PING,
		writeCommand: () => "ping",
	},
	[CommandNames.RESET]: {
		name: CommandNames.RESET,
		writeCommand: () => "reset",
		readRegex: /(Device will reset after disconnecting.)\s*/,
	},
	[CommandNames.ERASE]: {
		name: CommandNames.ERASE,
		writeCommand: () => "erase",
		readRegex: /(NVM will be erased after disconnecting.)\s*/,
	},
	[CommandNames.DISCONNECT]: {
		name: CommandNames.DISCONNECT,
		writeCommand: () => "dis",
	},
	[CommandNames.DFU]: {
		name: CommandNames.DFU,
		writeCommand: () => "dfu",
		readRegex: /(Device will enter DFU mode after disconnecting.)\s*/,
	},
	[CommandNames.DEVICE]: {
		name: CommandNames.DEVICE,
		readCommand: "device",
	},
}

type CharacteristicProperty =
	| "Read"
	| "Write"
	| "WriteWithoutResponse"
	| "Notify"

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
