import {
	COMMANDS,
	Command,
	CommandConstructOptions,
	CommandControlTypes,
	CommandNames,
	ParseCommands,
	getCommandByName,
} from "./types"

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

const valueChecker = (value: string, command: Command) => {
	if (command.readRegex) {
		const match = command.readRegex.exec(value)

		if (match) {
			return match[1]
		}

		return undefined
	}

	return value
}

export const parseLogs = (finishedLog: string, lastLog: string) => {
	if (lastLog.trim().length === 0) return []
	if (!lastLog.match(/\n/)) return []

	const results: ParseCommands[] = []

	const lines = finishedLog.split("\n\r")

	if (!lines[0]) return []

	/**
	 * Custom parsing logic below for each command.
	 */

	// BATTERY
	const lastBatteryLine = checkForLastLine(COMMANDS.BATTERY.readCommand!, lines)

	if (lastBatteryLine) {
		const value = valueChecker(lastBatteryLine, COMMANDS.BATTERY)
		if (value) {
			results.push({
				value,
				command: COMMANDS.BATTERY,
			})
		}
	}

	// ID
	const lastIdLine = checkForLastLine(COMMANDS.ID.readCommand!, lines)

	if (lastIdLine) {
		const value = valueChecker(lastIdLine, COMMANDS.ID)
		if (value) {
			results.push({
				value,
				command: COMMANDS.ID,
			})
		}
	}

	// DEVICE
	const lastDeviceLine = checkForLastLine(COMMANDS.DEVICE.readCommand!, lines)

	if (lastDeviceLine) {
		const value = valueChecker(lastDeviceLine, COMMANDS.DEVICE)
		if (value) {
			results.push({
				value,
				command: COMMANDS.DEVICE,
			})
		}
	}

	// SENSOR

	const lastSensorLine = checkForLastLine(COMMANDS.SENSOR.readCommand!, lines)

	if (lastSensorLine) {
		const matches = COMMANDS.SENSOR.readRegex!.exec(lastSensorLine)
		if (matches) {
			let [, , value] = matches

			results.push({
				/**
				 * This is needed so that useCommand hook can realize that
				 * setting the value was succesful.
				 */
				value: value === "enabled" ? "enable" : "disable",
				command: COMMANDS.SENSOR,
			})
		}
	}

	// TRAP

	const lastTrapLine = checkForLastLine(COMMANDS.TRAP.readCommand!, lines)

	if (lastTrapLine) {
		const matches = COMMANDS.TRAP.readRegex!.exec(lastTrapLine)
		if (matches) {
			const [, value] = matches

			results.push({
				value,
				command: COMMANDS.TRAP,
			})
		}
	}

	// LORAWAN

	const lastLorawanLine = checkForLastLine(COMMANDS.LORAWAN.readCommand!, lines)

	if (lastLorawanLine) {
		const matches = COMMANDS.LORAWAN.readRegex!.exec(lastLorawanLine)
		if (matches) {
			const [, , value] = matches // Updated to match new regex with 2 capture groups

			results.push({
				value,
				command: COMMANDS.LORAWAN,
			})
		} else {
			console.log("🔍 LORAWAN regex failed to match:", lastLorawanLine)
		}
	}

	// VERSION
	const lastVersionLine = checkForLastLine(COMMANDS.VERSION.readCommand!, lines)

	if (lastVersionLine) {
		const value = valueChecker(lastVersionLine, COMMANDS.VERSION)
		if (value) {
			results.push({
				value,
				command: COMMANDS.VERSION,
			})
		}
	}

	// HEARTBEAT
	const lastHeartbeatLine = checkForLastLine(
		COMMANDS.HEARTBEAT.readCommand!,
		lines,
	)

	if (lastHeartbeatLine) {
		const value = valueChecker(lastHeartbeatLine, COMMANDS.HEARTBEAT)
		if (value) {
			results.push({
				value,
				command: COMMANDS.HEARTBEAT,
			})
		}
	}

	// DEV EUI
	const lastDevEuiLine = checkForLastLine(COMMANDS.DEVEUI.readCommand!, lines)

	if (lastDevEuiLine) {
		const value = valueChecker(lastDevEuiLine, COMMANDS.DEVEUI)
		if (value) {
			results.push({
				value,
				command: COMMANDS.DEVEUI,
			})
		}
	}

	// APP EUI
	const lastAppEuiLine = checkForLastLine(COMMANDS.APPEUI.readCommand!, lines)

	if (lastAppEuiLine) {
		const value = valueChecker(lastAppEuiLine, COMMANDS.APPEUI)
		if (value) {
			results.push({
				value,
				command: COMMANDS.APPEUI,
			})
		}
	}

	// APP KEY
	const lastAppKeyLine = checkForLastLine(COMMANDS.APPKEY.readCommand!, lines)

	if (lastAppKeyLine) {
		const value = valueChecker(lastAppKeyLine, COMMANDS.APPKEY)
		if (value) {
			results.push({
				value,
				command: COMMANDS.APPKEY,
			})
		}
	}

	// RESET
	const lastResetLine = checkForLastLine(COMMANDS.RESET.writeCommand!(), lines)

	if (lastResetLine) {
		const value = valueChecker(lastResetLine, COMMANDS.RESET)
		if (value) {
			results.push({
				value,
				command: COMMANDS.RESET,
			})
		}
	}

	// DFU
	const lastDfuLine = checkForLastLine(COMMANDS.DFU.writeCommand!(), lines)

	if (lastDfuLine) {
		const value = valueChecker(lastDfuLine, COMMANDS.DFU)
		if (value) {
			results.push({
				value,
				command: COMMANDS.DFU,
			})
		}
	}

	// ERASE
	const lastEraseLine = checkForLastLine(COMMANDS.ERASE.writeCommand!(), lines)

	if (lastEraseLine) {
		const value = valueChecker(lastEraseLine, COMMANDS.ERASE)
		if (value) {
			results.push({
				value,
				command: COMMANDS.ERASE,
			})
		}
	}

	// AI INFO
	const lastAiInfoLine = checkForLastLine(COMMANDS.AI_INFO.readCommand!, lines)
	if (lastAiInfoLine) {
		const matches = COMMANDS.AI_INFO.readRegex!.exec(lastAiInfoLine)
		if (matches) {
			const [, total, available] = matches
			results.push({
				value: JSON.stringify({ total: parseInt(total), available: parseInt(available) }),
				command: COMMANDS.AI_INFO,
			})
		}
	}

	// AI CAPTURE
	// Note: AI capture might take longer and might not be the immediate next line
	// But for now we follow the pattern. The regex is robust enough to find it if it's there.
	// We might need to scan more lines if it's not the immediate next one.
	// For now, let's try the standard approach.
	const lastAiCaptureLine = checkForLastLine("Captured", lines) // "Captured" is part of the response
	if (lastAiCaptureLine) {
		const matches = COMMANDS.AI_CAPTURE.readRegex!.exec(lastAiCaptureLine)
		if (matches) {
			const [, filename] = matches
			results.push({
				value: filename,
				command: COMMANDS.AI_CAPTURE,
			})
		}
	}

	// PING
	const lastPingLine = checkForLastLine(COMMANDS.PING.writeCommand!(), lines)
	if (lastPingLine) {
		const matches = COMMANDS.PING.readRegex!.exec(lastPingLine)
		if (matches) {
			const [, rssi, snr] = matches
			results.push({
				value: JSON.stringify({ rssi: parseInt(rssi), snr: parseFloat(snr) }),
				command: COMMANDS.PING,
			})
		}
	}

	// SELFTEST
	const lastSelftestLine = checkForLastLine(COMMANDS.SELFTEST.writeCommand!(), lines)
	if (lastSelftestLine) {
		const matches = COMMANDS.SELFTEST.readRegex!.exec(lastSelftestLine)
		if (matches) {
			const [, errorBits] = matches
			results.push({
				value: errorBits,
				command: COMMANDS.SELFTEST,
			})
		}
	}

	return results
}

const checkForLastLine = (name: string, lines: string[]) => {
	const line = lines.lastIndexOf(name)

	if (line !== -1) {
		return lines[line + 1]
	}

	return null
}
