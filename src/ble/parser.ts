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
	const lastBatteryLine = checkForLastLine(COMMANDS.battery.readCommand!, lines)

	if (lastBatteryLine) {
		const value = valueChecker(lastBatteryLine, COMMANDS.battery)
		if (value) {
			results.push({
				value,
				command: COMMANDS.battery,
			})
		}
	}

	// ID
	const lastIdLine = checkForLastLine(COMMANDS.id.readCommand!, lines)

	if (lastIdLine) {
		const value = valueChecker(lastIdLine, COMMANDS.id)
		if (value) {
			results.push({
				value,
				command: COMMANDS.id,
			})
		}
	}

	// DEVICE
	const lastDeviceLine = checkForLastLine(COMMANDS.device.readCommand!, lines)

	if (lastDeviceLine) {
		const value = valueChecker(lastDeviceLine, COMMANDS.device)
		if (value) {
			results.push({
				value,
				command: COMMANDS.device,
			})
		}
	}

	// STATUS (previously SENSOR)
	const lastStatusLine = checkForLastLine(COMMANDS.status.readCommand!, lines)

	if (lastStatusLine) {
		const matches = COMMANDS.status.readRegex!.exec(lastStatusLine)
		if (matches) {
			let [, , value] = matches

			results.push({
				/**
				 * This is needed so that useCommand hook can realize that
				 * setting the value was succesful.
				 */
				value: value === "enabled" ? "enable" : "disable",
				command: COMMANDS.status,
			})
		}
	}

	// VERSION
	const lastVersionLine = checkForLastLine(COMMANDS.ver.readCommand!, lines)

	if (lastVersionLine) {
		const value = valueChecker(lastVersionLine, COMMANDS.ver)
		if (value) {
			results.push({
				value,
				command: COMMANDS.ver,
			})
		}
	}

	// HEARTBEAT
	const lastHeartbeatLine = checkForLastLine(
		COMMANDS.heartbeat.readCommand!,
		lines,
	)

	if (lastHeartbeatLine) {
		const value = valueChecker(lastHeartbeatLine, COMMANDS.heartbeat)
		if (value) {
			results.push({
				value,
				command: COMMANDS.heartbeat,
			})
		}
	}

	// DEV EUI
	const lastDevEuiLine = checkForLastLine(COMMANDS.deveui.readCommand!, lines)

	if (lastDevEuiLine) {
		const value = valueChecker(lastDevEuiLine, COMMANDS.deveui)
		if (value) {
			results.push({
				value,
				command: COMMANDS.deveui,
			})
		}
	}

	// APP EUI
	const lastAppEuiLine = checkForLastLine(COMMANDS.appeui.readCommand!, lines)

	if (lastAppEuiLine) {
		const value = valueChecker(lastAppEuiLine, COMMANDS.appeui)
		if (value) {
			results.push({
				value,
				command: COMMANDS.appeui,
			})
		}
	}

	// APP KEY
	const lastAppKeyLine = checkForLastLine(COMMANDS.appkey.readCommand!, lines)

	if (lastAppKeyLine) {
		const value = valueChecker(lastAppKeyLine, COMMANDS.appkey)
		if (value) {
			results.push({
				value,
				command: COMMANDS.appkey,
			})
		}
	}

	// RESET
	const lastResetLine = checkForLastLine(COMMANDS.reset.writeCommand!(), lines)

	if (lastResetLine) {
		const value = valueChecker(lastResetLine, COMMANDS.reset)
		if (value) {
			results.push({
				value,
				command: COMMANDS.reset,
			})
		}
	}

	// DFU
	const lastDfuLine = checkForLastLine(COMMANDS.dfu.writeCommand!(), lines)

	if (lastDfuLine) {
		const value = valueChecker(lastDfuLine, COMMANDS.dfu)
		if (value) {
			results.push({
				value,
				command: COMMANDS.dfu,
			})
		}
	}

	// ERASE
	const lastEraseLine = checkForLastLine(COMMANDS.erase.writeCommand!(), lines)

	if (lastEraseLine) {
		const value = valueChecker(lastEraseLine, COMMANDS.erase)
		if (value) {
			results.push({
				value,
				command: COMMANDS.erase,
			})
		}
	}

	// AI INFO
	const lastAiInfoLine = checkForLastLine(COMMANDS.aiinfo.writeCommand!() || "AI info", lines)
	if (lastAiInfoLine) {
		// Regex to capture total and available space
		const aiInfoRegex = /(\d+)\s*K\s*total\s*drive\s*space[\s\S]*?(\d+)\s*K\s*available/
		const matches = aiInfoRegex.exec(lastAiInfoLine)
		if (matches) {
			const [, total, available] = matches
			results.push({
				value: JSON.stringify({ total: parseInt(total, 10), available: parseInt(available, 10) }),
				command: COMMANDS.aiinfo,
			})
		}
	}

	// AI CAPTURE
	// Note: AI capture might take longer and might not be the immediate next line
	// But for now we follow the pattern. The regex is robust enough to find it if it's there.
	// We might need to scan more lines if it's not the immediate next one.
	// For now, let's try the standard approach.
	// AI CAPTURE
	const lastAiCaptureLine = checkForLastLine("Captured", lines)
	if (lastAiCaptureLine) {
		// Regex for captured file
		const aiCaptureRegex = /Captured\s+([a-zA-Z0-9_]+\.jpg)/
		const matches = aiCaptureRegex.exec(lastAiCaptureLine)
		if (matches) {
			const [, filename] = matches
			results.push({
				value: filename,
				command: COMMANDS.AI_CAPTURE,
			})
		}
	}



	// GETOPS
	const lastGetopsLine = checkForLastLine(COMMANDS.getops.readCommand!, lines)
	if (lastGetopsLine) {
		const matches = COMMANDS.getops.readRegex!.exec(lastGetopsLine)
		if (matches) {
			const [, params] = matches
			results.push({
				value: params,
				command: COMMANDS.getops,
			})
		}
	}

	// AI VER
	const lastAiVerLine = checkForLastLine(COMMANDS.ai_ver.readCommand!, lines)
	if (lastAiVerLine) {
		results.push({
			value: lastAiVerLine.trim(),
			command: COMMANDS.ai_ver,
		})
	}

	// SELFTEST
	const lastSelftestLine = checkForLastLine(COMMANDS.selftest.writeCommand!(), lines)
	if (lastSelftestLine) {
		const matches = COMMANDS.selftest.readRegex!.exec(lastSelftestLine)
		if (matches) {
			const [, errorBits] = matches
			results.push({
				value: errorBits,
				command: COMMANDS.selftest,
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
