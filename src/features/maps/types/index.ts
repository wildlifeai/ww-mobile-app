/**
 * Maps Feature - Type Definitions
 *
 * Foundational types for map functionality (zero dependencies on other features)
 */

import { LatLng, Region } from 'react-native-maps';

/**
 * Map region with viewport bounds
 */
export interface MapRegion extends Region {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
}

/**
 * User location coordinates
 */
export interface UserLocation {
  latitude: number;
  longitude: number;
  altitude: number | null;
  accuracy: number | null;
  heading: number | null;
  speed: number | null;
  timestamp: number;
}

/**
 * Location permission status
 */
export type LocationPermissionStatus =
  | 'granted'
  | 'denied'
  | 'undetermined';

/**
 * Location permission state
 */
export interface LocationPermissions {
  foreground: LocationPermissionStatus;
  background?: LocationPermissionStatus;
  canAskAgain: boolean;
}

/**
 * Map control actions
 */
export interface MapControls {
  centerOnUser: () => void;
  zoomIn: () => void;
  zoomOut: () => void;
  setMapType: (type: MapType) => void;
}

/**
 * Map display type
 */
export type MapType = 'standard' | 'satellite' | 'hybrid';

/**
 * Map viewport configuration
 */
export interface MapViewConfig {
  showsUserLocation: boolean;
  showsMyLocationButton: boolean;
  showsCompass: boolean;
  showsScale: boolean;
  zoomEnabled: boolean;
  scrollEnabled: boolean;
  rotateEnabled: boolean;
  pitchEnabled: boolean;
}

/**
 * Location tracking options
 */
export interface LocationTrackingOptions {
  accuracy: 'low' | 'balanced' | 'high' | 'highest';
  distanceInterval?: number; // meters
  timeInterval?: number; // milliseconds
}
