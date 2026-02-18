import { createContext, useContext } from "react"
import { PropsWithChildren } from "react"

import { ReturnType, useBle } from "../hooks/useBle"

const BLEDevicesContext = createContext<ReturnType>({} as ReturnType)

export const useBleActions = () => {
	return useContext(BLEDevicesContext)
}

export const BleEngineProvider = ({ children }: PropsWithChildren<{}>) => {
	const {
		isBleConnecting,
		startScan,
		connectDevice,
		disconnectDevice,
		write,
		pingsPause,
		pingsPaused,
	} = useBle()

	return (
		<BLEDevicesContext.Provider
			value={{
				isBleConnecting,
				startScan,
				connectDevice,
				disconnectDevice,
				write,
				pingsPause,
				pingsPaused,
			}}
		>
			{children}
		</BLEDevicesContext.Provider>
	)
}
