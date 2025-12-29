import { useRef } from "react"
import { useCallback } from "react"
import { useEffect } from "react"

import BluetoothStateManager, {
	BluetoothState,
} from "react-native-bluetooth-state-manager"

import { log } from "../utils/logger"
import { useAppDispatch, useAppSelector } from "../redux"
import { blStatusChanged } from "../redux/slices/bluetoothStatusSlice"

export type BluetoothStatusResult = {
	status: BluetoothState
	initialLoad: boolean
}

export const useBluetoothStatus = (): BluetoothStatusResult => {
	const bleLibRef = useRef<any>(null)
	const { initialLoad, status } = useAppSelector((state) => state.blStatus)
	const dispatch = useAppDispatch()

	const updateState = useCallback(
		(bluetoothState: BluetoothState) => {
			log(`BLE is currently: ${bluetoothState}`)
			dispatch(blStatusChanged(bluetoothState))
		},
		[dispatch],
	)

	useEffect(() => {
		if (bleLibRef.current) {
			bleLibRef.current.remove()
		}

		bleLibRef.current = BluetoothStateManager.onStateChange(updateState, true)

		return () => {
			bleLibRef.current && bleLibRef.current.remove()
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [])

	return {
		status,
		initialLoad,
	}
}
