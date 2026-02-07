import React from "react"
import { useBleListeners } from "../hooks/useBleListeners"

export const ListenToBleEngineProvider = ({ children }: { children: React.ReactNode }) => {
	useBleListeners()
	return children
}
