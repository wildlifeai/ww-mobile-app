/**
 * GPS Location Hook
 * 
 * Custom hook for accessing device location via expo-location
 * Handles permission requests and location fetching with error handling
 */

import { useState, useCallback, useRef, useEffect } from 'react'
import * as Location from 'expo-location'
import { Alert } from 'react-native'
import { log, logError } from '../utils/logger'
import { useAppDispatch } from '../redux'
import { setLocation, setIsTracking as setIsTrackingRedux, GPSLocation } from '../redux/slices/locationSlice'


// TEST MODE: Set to true to use hardcoded coordinates (for testing without GPS)
const TEST_MODE = false
const TEST_COORDS = {
    latitude: -41.2865, // Wellington, NZ
    longitude: 174.7762,
    altitude: 10,
    accuracy: 5
}

export const useGPSLocation = () => {
    const dispatch = useAppDispatch()
    const [isGettingLocation, setIsGettingLocation] = useState(false)
    const [location, setLocalLocation] = useState<GPSLocation | null>(null)
    const locationSubscription = useRef<Location.LocationSubscription | null>(null)

    const getLocation = useCallback(async (): Promise<GPSLocation | null> => {
        log('[GPS] Starting location request...')
        setIsGettingLocation(true)

        // TEST MODE: Return hardcoded coordinates
        if (TEST_MODE) {
            log('[GPS] TEST MODE: Using hardcoded coordinates')
            await new Promise(resolve => setTimeout(resolve, 500)) // Simulate delay
            const locationData: GPSLocation = { ...TEST_COORDS, timestamp: Date.now() }
            setLocalLocation(locationData)
            dispatch(setLocation(locationData))
            setIsGettingLocation(false)
            log('[GPS] TEST MODE: Returning coordinates:', locationData)
            return locationData
        }

        try {
            // Check existing permissions first
            log('[GPS] Checking existing permissions...')
            let { status } = await Location.getForegroundPermissionsAsync()
            log('[GPS] Existing permission status:', status)

            if (status !== 'granted') {
                log('[GPS] Requesting permissions...')
                const req = await Location.requestForegroundPermissionsAsync()
                status = req.status
                log('[GPS] New permission status:', status)
            }

            if (status !== 'granted') {
                log('[GPS] Permission denied by user')
                Alert.alert(
                    'Permission Denied',
                    'Location permission is required to set GPS coordinates on the device.'
                )
                setIsGettingLocation(false)
                return null
            }

            // Get current position with high accuracy
            log('[GPS] Getting current position...')

            // Add a race with timeout 
            const locationPromise = Location.getCurrentPositionAsync({
                accuracy: Location.Accuracy.High,
            })

            const timeoutPromise = new Promise<never>((_, reject) => {
                setTimeout(() => reject(new Error('Location request timed out')), 15000)
            })

            const loc = await Promise.race([locationPromise, timeoutPromise])
            log('[GPS] Location received:', loc.coords)

            const locationData: GPSLocation = {
                latitude: loc.coords.latitude,
                longitude: loc.coords.longitude,
                altitude: loc.coords.altitude || 0, // Default to 0 if null
                accuracy: loc.coords.accuracy || null,
                timestamp: Date.now()
            }

            setLocalLocation(locationData)
            dispatch(setLocation(locationData))
            return locationData
        } catch (error) {
            logError('[GPS] Failed to get location:', error)
            Alert.alert(
                'Location Error',
                'Failed to get current location. Please ensure location services are enabled.'
            )
            return null
        } finally {
            setIsGettingLocation(false)
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []) // Empty deps - getLocation doesn't depend on any props or state

    const startGeolocation = useCallback(async () => {
        try {
            log('[GPS] Starting geolocation tracking...')
            const { status } = await Location.getForegroundPermissionsAsync()
            if (status !== 'granted') {
                log('[GPS] Cannot start geolocation: Foreground permission not granted')
                return
            }

            if (locationSubscription.current) {
                log('[GPS] Geolocation tracking already active')
                return
            }

            dispatch(setIsTrackingRedux(true))

            locationSubscription.current = await Location.watchPositionAsync(
                {
                    accuracy: Location.Accuracy.High,
                    timeInterval: 4000,
                    distanceInterval: 1, // Require at least 1 meter of movement
                },
                (loc) => {
                    log('[GPS] Geolocation update received:', loc.coords)
                    const locationData: GPSLocation = {
                        latitude: loc.coords.latitude,
                        longitude: loc.coords.longitude,
                        altitude: loc.coords.altitude || 0,
                        accuracy: loc.coords.accuracy || null,
                        timestamp: Date.now()
                    }
                    setLocalLocation(locationData)
                    dispatch(setLocation(locationData))
                }
            )
            log('[GPS] Geolocation tracking started successfully')
        } catch (error) {
            logError('[GPS] Failed to start geolocation tracking:', error)
            dispatch(setIsTrackingRedux(false))
        }
    }, [dispatch])

    const stopGeolocation = useCallback(() => {
        log('[GPS] Stopping geolocation tracking...')
        if (locationSubscription.current) {
            locationSubscription.current.remove()
            locationSubscription.current = null
        }
        dispatch(setIsTrackingRedux(false))
        log('[GPS] Geolocation tracking stopped')
    }, [dispatch])

    useEffect(() => {
        return () => {
            // Cleanup on unmount
            if (locationSubscription.current) {
                locationSubscription.current.remove()
            }
        }
    }, [])

    return {
        location,
        isGettingLocation,
        getLocation,
        startGeolocation,
        stopGeolocation
    }
}
