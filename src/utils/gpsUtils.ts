import { log, logError } from './logger'

/**
 * GPS Utilities
 * 
 * Functions for converting and formatting GPS coordinates for BLE transmission
 * to Wildlife Watcher devices. Converts decimal degrees to DMS format required
 * by firmware.
 */

/**
 * Convert decimal degrees to degrees/minutes/seconds format
 * 
 * @param decimal - Decimal degrees (e.g., 37.809027)
 * @param isLatitude - True for latitude (N/S), false for longitude (E/W)
 * @returns Formatted DMS string with direction (e.g., "37°48'30.50\"_N")
 */
export const decimalToDMS = (decimal: number, isLatitude: boolean): string => {
    const absolute = Math.abs(decimal)
    const degrees = Math.floor(absolute)
    const minutesDecimal = (absolute - degrees) * 60
    const minutes = Math.floor(minutesDecimal)
    const seconds = (minutesDecimal - minutes) * 60

    // Determine direction based on sign and coordinate type
    const direction = isLatitude
        ? decimal >= 0
            ? 'N'
            : 'S'
        : decimal >= 0
            ? 'E'
            : 'W'

    // Format: DD°MM'SS.SS"_DIR (underscore required for BLE transmission)
    return `${degrees}°${minutes}'${seconds.toFixed(2)}"_${direction}`
}

/**
 * Format GPS coordinates for firmware transmission
 * 
 * Firmware expects format: "LAT_LON_ALT_REF"
 * Example: "37°48'30.50\"_N_122°25'10.22\"_W_500.75_Above"
 * 
 * @param lat - Latitude in decimal degrees
 * @param lon - Longitude in decimal degrees  
 * @param alt - Altitude in meters
 * @returns Formatted GPS string for BLE transmission
 */
export const formatGPSString = (
    lat: number,
    lon: number,
    alt: number
): string => {
    const latDMS = decimalToDMS(lat, true)
    const lonDMS = decimalToDMS(lon, false)
    const altRef = alt >= 0 ? 'Above' : 'Below'
    const altValue = Math.abs(alt).toFixed(2)

    // Combine all parts with underscores (spaces not allowed in BLE)
    return `${latDMS}_${lonDMS}_${altValue}_${altRef}`
}

/**
 * Parse GPS response from firmware (optional, for future use)
 * 
 * @param gpsString - GPS string from firmware
 * @returns Parsed GPS data or null if invalid
 */
export const parseGPSResponse = (
    gpsString: string
): { lat: number; lon: number; alt: number } | null => {
    try {
        // Replace underscores with spaces for parsing
        const normalized = gpsString.replace(/_/g, ' ')

        // Basic validation - firmware format expected
        // This is a placeholder for future implementation if needed
        log('[GPS] Received GPS string:', normalized)

        return null // Not implemented yet
    } catch (error) {
        logError('[GPS] Failed to parse GPS string:', error)
        return null
    }
}
