import { useCallback, useState } from "react"
import { useEffect, useRef } from "react"
import {
	Command,
	CommandConstructOptions,
	CommandControlTypes,
	CommandNames,
} from "../ble/types"
import { useAppDispatch, useAppSelector } from "../redux"
import { ExtendedPeripheral } from "../redux/slices/devicesSlice"
import { logError, log } from "../utils/logger"
import { useBleActions } from "../providers/BleEngineProvider"
import {
	ConfigKey,
	deviceConfigChanged,
} from "../redux/slices/configurationSlice"

type Props = {
	deviceId: string
	command: Command
}

const INTERVAL = 1000 * 7
const TIMEOUT = 1000 * 10

export const useCommand = ({ deviceId, command }: Props) => {
	const [goal, setGoal] = useState<number | string>()
	const [commandLoading, setCommandLoading] = useState(
		!!(command.readRegex || command.readCommand),
	)

	const { write } = useBleActions()
	const devices = useAppSelector((state) => state.devices)
	const configuration = useAppSelector((state) => state.configuration)

	const dispatch = useAppDispatch()

	const device = devices[deviceId] as ExtendedPeripheral

	const sendCommand = useCallback(
		async (rw: CommandControlTypes, value?: string) => {
			const payload: [CommandNames, CommandConstructOptions][] = [
				[
					command.name,
					{
						control: CommandControlTypes.READ,
					},
				],
			]

			if (rw === CommandControlTypes.WRITE) {
				payload.unshift([
					command.name,
					{
						control: CommandControlTypes.WRITE,
						value,
					},
				])
			}
			
			try {
				const responses = await write(device, payload)
				return responses
			} catch (e) {
				logError(`[useCommand] write failed: ${e}`)
				throw e
			}
		},
		[device, command.name, write],
	)

	const set = useCallback(
		async (data?: string) => {
			setCommandLoading(true)
			setGoal(data)

			try {
				await sendCommand(CommandControlTypes.WRITE, data)
				
				// Optional: If the command is just an action, we are done
				if (!command.readRegex && !command.readCommand) {
					setCommandLoading(false)
					return
				}
			} catch (e) {
				dispatch(
					deviceConfigChanged({
						id: deviceId,
						configuration: {
							[command.name]: {
								...configuration[command.name],
								loaded: true,
								loading: false,
								error: `Writing value failed: ${e}`,
							},
						},
					}),
				)
			} finally {
				setCommandLoading(false)
			}
		},
		[
			sendCommand,
			command.readRegex,
			command.readCommand,
			command.name,
			dispatch,
			deviceId,
			configuration,
		],
	)

	const get = useCallback(async () => {
		// Means its a set only command in reality
		if (!command.readCommand) return

		setCommandLoading(true)
		setGoal(undefined)

		try {
			await sendCommand(CommandControlTypes.READ)
		} catch (e) {
			dispatch(
				deviceConfigChanged({
					id: deviceId,
					configuration: {
						[command.name]: {
							...configuration[command.name],
							loaded: true,
							loading: false,
							error: `Getting value failed: ${e}`,
						},
					},
				}),
			)
		} finally {
			setCommandLoading(false)
		}
	}, [
		command.readCommand,
		command.name,
		sendCommand,
		dispatch,
		deviceId,
		configuration,
	])

	return {
		set,
		get,
		commandLoading,
	}
}
