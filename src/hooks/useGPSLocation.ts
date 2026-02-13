/**
 * GPS Location Hook
 * 
 * Custom hook for accessing device location via expo-location
 * Handles permission requests and location fetching with error handling
 */

import { useState, useCallback } from 'react'
import * as Location from 'expo-location'
import { Alert } from 'react-native'
import { log, logError } from '../utils/logger'


// TEST MODE: Set to true to use hardcoded coordinates (for testing without GPS)
const TEST_MODE = false
const TEST_COORDS = {
    latitude: -41.2865, // Wellington, NZ
    longitude: 174.7762,
    altitude: 10,
    accuracy: 5
}

interface GPSLocation {
    latitude: number
    longitude: number
    altitude: number
    accuracy: number | null
}

export const useGPSLocation = () => {
    const [isGettingLocation, setIsGettingLocation] = useState(false)
    const [location, setLocation] = useState<GPSLocation | null>(null)

    const getLocation = useCallback(async (): Promise<GPSLocation | null> => {
        log('[GPS] Starting location request...')
        setIsGettingLocation(true)

        // TEST MODE: Return hardcoded coordinates
        if (TEST_MODE) {
            log('[GPS] TEST MODE: Using hardcoded coordinates')
            await new Promise(resolve => setTimeout(resolve, 500)) // Simulate delay
            const locationData: GPSLocation = TEST_COORDS
            setLocation(locationData)
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
            }

            setLocation(locationData)
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
    }, []) // Empty deps - getLocation doesn't depend on any props or state

    return {
        location,
        isGettingLocation,
        getLocation,
    }
}
