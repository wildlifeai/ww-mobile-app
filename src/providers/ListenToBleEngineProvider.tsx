import React, { useMemo } from "react"
import { useBleListeners } from "../hooks/useBleListeners"
import { useBleHeartbeat } from "../hooks/useBleHeartbeat"
import { useAppSelector } from "../redux"

export const ListenToBleEngineProvider = ({ children }: { children: React.ReactNode }) => {
	useBleListeners()

	// Find the currently connected device for the heartbeat
	const devices = useAppSelector((state) => state.devices)
	const connectedDevice = useMemo(
		() => Object.values(devices).find(d => d?.connected) ?? null,
		[devices]
	)
	useBleHeartbeat(connectedDevice)

	return children
}
