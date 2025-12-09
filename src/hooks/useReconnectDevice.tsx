import { useEffect } from "react"

import { useAppNavigation } from "./useAppNavigation"
import { log } from "../utils/logger"
import { useSelectDevice } from "./useSelectDevice"

type Props = {
	deviceId: string
	initialTarget?: number
	ignoreDisconnect?: boolean
}

export type ReturnType = {
	connected: boolean
}

export const useReconnectDevice = ({ deviceId, ignoreDisconnect = false }: Props) => {
	const device = useSelectDevice({ deviceId })
	const navigation = useAppNavigation()

	useEffect(() => {
		const { connected } = device

		if (!connected) {
			if (ignoreDisconnect || device.dfuInProgress) {
				log("Device disconnected, but ignoring due to ignoreDisconnect flag or DFU in progress.")
				return
			}
			log("Device disconnected, navigating to the Home screen.")
			navigation.navigate("Home")
		}
	}, [device, navigation, ignoreDisconnect])
}
