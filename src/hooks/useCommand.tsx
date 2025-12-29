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
	const requestRef = useRef<any>(null)
	const timeoutRef = useRef<any>(null)

	const [goal, setGoal] = useState<number | string>()
	const [commandLoading, setCommandLoading] = useState(
		!!(command.readRegex || command.readCommand),
	)

	const { write } = useBleActions()
	const devices = useAppSelector((state) => state.devices)
	const configuration = useAppSelector((state) => state.configuration)

	const [initialHookLoad, setInitialHookLoad] = useState(false)

	const dispatch = useAppDispatch()

	const device = devices[deviceId] as ExtendedPeripheral

	const clearTimers = () => {
		requestRef.current && clearInterval(requestRef.current)
		timeoutRef.current && clearTimeout(timeoutRef.current)
	}

	const sendCommand = useCallback(
		(rw: CommandControlTypes, value?: string) => {
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
			write(device, payload)
		},
		[device, command.name, write],
	)

	const set = useCallback(
		(data?: string) => {
			clearTimers()
			setCommandLoading(true)

			sendCommand(CommandControlTypes.WRITE, data)

			// Means its just an action command in reality, can not set or get
			if (!command.readRegex && !command.readCommand) {
				setCommandLoading(false)
				return
			}

			requestRef.current = setInterval(
				() => sendCommand(CommandControlTypes.WRITE, data),
				INTERVAL,
			)
			timeoutRef.current = setTimeout(() => {
				if (requestRef.current) {
					clearInterval(requestRef.current)
				}

				setCommandLoading(false)

				dispatch(
					deviceConfigChanged({
						id: deviceId,
						configuration: {
							[command.name]: {
								...configuration[command.name],
								loaded: true,
								loading: false,
								error: "Writing the value timed out.",
							},
						},
					}),
				)

				logError(`Trying to set ${command.name} timed out.`)
			}, TIMEOUT)

			setGoal(data)
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

	const get = useCallback(() => {
		clearTimers()

		// Means its a set only command in reality
		if (!command.readCommand) return

		setCommandLoading(true)

		sendCommand(CommandControlTypes.READ)

		requestRef.current = setInterval(
			() => sendCommand(CommandControlTypes.READ),
			INTERVAL,
		)
		timeoutRef.current = setTimeout(() => {
			if (requestRef.current) {
				clearInterval(requestRef.current)
			}

			setCommandLoading(false)

			dispatch(
				deviceConfigChanged({
					id: deviceId,
					configuration: {
						[command.name]: {
							...configuration[command.name],
							loaded: true,
							loading: false,
							error: "Getting the value timed out.",
						},
					},
				}),
			)

			logError(`Trying to get ${command.name} timed out.`)
		}, TIMEOUT)

		setGoal(undefined)
	}, [
		command.readCommand,
		command.name,
		sendCommand,
		dispatch,
		deviceId,
		configuration,
	])

	useEffect(() => {
		const config = configuration[device.id]

		if (
			isCommandCompleted({
				goal,
				config: config[command.name],
			})
		) {
			clearTimers()
			setCommandLoading(false)
			/**
			 * If the hook already detects the correct configuration
			 * when it first renders, the get() method isn't even
			 * fired, so we simply make sure to avoid running the
			 * get() below.
			 */
			setInitialHookLoad(true)
			setGoal(undefined)

			return
		}

		if (requestRef.current || initialHookLoad) return

		// get()
	}, [
		write,
		command.name,
		sendCommand,
		goal,
		get,
		configuration,
		initialHookLoad,
		device,
		deviceId,
		command,
	])

	useEffect(() => {
		return () => {
			// log(`Cancelling timers for ${command.name} hook.`)
			clearTimers()
		}
	}, [command.name])

	return {
		set,
		get,
		commandLoading,
	}
}

const isCommandCompleted = ({
	config,
	goal,
}: {
	config?: ConfigKey
	goal?: number | string
}) => {
	if (!config) return false

	if (config.loading) return false

	if (goal) {
		return config.value === goal
	}

	if (!config.value && config.value !== "") {
		return false
	}
	return true
}
