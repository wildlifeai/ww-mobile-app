/**
 * useMapRegion Hook
 *
 * Manages map viewport region and zoom controls
 * Zero dependencies - foundational hook for maps feature
 */

import { useState, useCallback, useRef } from "react"
import { MapRegion, UserLocation } from "../types"
import MapView from "react-native-maps"

interface UseMapRegionReturn {
	region: MapRegion
	setRegion: (region: MapRegion) => void
	centerOnLocation: (location: UserLocation, zoomLevel?: number) => void
	zoomIn: () => void
	zoomOut: () => void
	resetToUserLocation: (location: UserLocation | null) => void
	mapRef: React.RefObject<MapView | null>
}

const DEFAULT_REGION: MapRegion = {
	latitude: 0,
	longitude: 0,
	latitudeDelta: 0.0922,
	longitudeDelta: 0.0421,
}

const ZOOM_MULTIPLIER = 0.5 // How much to zoom in/out per action

export const useMapRegion = (initialRegion?: MapRegion): UseMapRegionReturn => {
	const [region, setRegionState] = useState<MapRegion>(
		initialRegion || DEFAULT_REGION,
	)
	const mapRef = useRef<MapView>(null)

	/**
	 * Update region state
	 */
	const setRegion = useCallback((newRegion: MapRegion) => {
		setRegionState(newRegion)
	}, [])

	/**
	 * Center map on specific location with optional zoom level
	 */
	const centerOnLocation = useCallback(
		(location: UserLocation, zoomLevel?: number) => {
			const newRegion: MapRegion = {
				latitude: location.latitude,
				longitude: location.longitude,
				latitudeDelta: zoomLevel
					? calculateDeltaFromZoom(zoomLevel)
					: region.latitudeDelta,
				longitudeDelta: zoomLevel
					? calculateDeltaFromZoom(zoomLevel)
					: region.longitudeDelta,
			}

			setRegionState(newRegion)

			// Animate to new region if map ref available
			if (mapRef.current) {
				mapRef.current.animateToRegion(newRegion, 500)
			}
		},
		[region],
	)

	/**
	 * Zoom in on current region
	 */
	const zoomIn = useCallback(() => {
		const newRegion: MapRegion = {
			...region,
			latitudeDelta: region.latitudeDelta * ZOOM_MULTIPLIER,
			longitudeDelta: region.longitudeDelta * ZOOM_MULTIPLIER,
		}

		setRegionState(newRegion)

		if (mapRef.current) {
			mapRef.current.animateToRegion(newRegion, 300)
		}
	}, [region])

	/**
	 * Zoom out from current region
	 */
	const zoomOut = useCallback(() => {
		const newRegion: MapRegion = {
			...region,
			latitudeDelta: region.latitudeDelta / ZOOM_MULTIPLIER,
			longitudeDelta: region.longitudeDelta / ZOOM_MULTIPLIER,
		}

		setRegionState(newRegion)

		if (mapRef.current) {
			mapRef.current.animateToRegion(newRegion, 300)
		}
	}, [region])

	/**
	 * Reset map to user location
	 */
	const resetToUserLocation = useCallback((location: UserLocation | null) => {
		if (!location) return

		const newRegion: MapRegion = {
			latitude: location.latitude,
			longitude: location.longitude,
			latitudeDelta: 0.01, // Close zoom on user
			longitudeDelta: 0.01,
		}

		setRegionState(newRegion)

		if (mapRef.current) {
			mapRef.current.animateToRegion(newRegion, 500)
		}
	}, [])

	return {
		region,
		setRegion,
		centerOnLocation,
		zoomIn,
		zoomOut,
		resetToUserLocation,
		mapRef,
	}
}

/**
 * Helper: Calculate delta from zoom level (approximate)
 * Zoom 0 = whole world, higher zoom = closer
 */
const calculateDeltaFromZoom = (zoom: number): number => {
	return 360 / Math.pow(2, zoom)
}
