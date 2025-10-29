/**
 * useLocation Hook
 *
 * Manages location permissions and current user location
 * Zero dependencies - foundational hook for maps feature
 */

import { useState, useEffect, useCallback } from 'react';
import * as Location from 'expo-location';
import {
  LocationPermissions,
  LocationPermissionStatus,
  UserLocation,
  LocationTrackingOptions
} from '../types';

interface UseLocationReturn {
  location: UserLocation | null;
  permissions: LocationPermissions;
  loading: boolean;
  error: string | null;
  requestPermissions: () => Promise<boolean>;
  getCurrentLocation: () => Promise<void>;
  startTracking: (options?: LocationTrackingOptions) => Promise<void>;
  stopTracking: () => void;
}

export const useLocation = (): UseLocationReturn => {
  const [location, setLocation] = useState<UserLocation | null>(null);
  const [permissions, setPermissions] = useState<LocationPermissions>({
    foreground: 'undetermined',
    canAskAgain: true,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [subscription, setSubscription] = useState<Location.LocationSubscription | null>(null);

  /**
   * Check current permission status
   */
  const checkPermissions = async () => {
    try {
      const foregroundStatus = await Location.getForegroundPermissionsAsync();

      setPermissions({
        foreground: mapPermissionStatus(foregroundStatus.status),
        canAskAgain: foregroundStatus.canAskAgain,
      });
    } catch (err) {
      console.error('[useLocation] Error checking permissions:', err);
      setError('Failed to check location permissions');
    }
  };

  /**
   * Get current location (one-time)
   */
  const getCurrentLocation = useCallback(async () => {
    if (permissions.foreground !== 'granted') {
      setError('Location permission not granted');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      setLocation({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        altitude: position.coords.altitude,
        accuracy: position.coords.accuracy,
        heading: position.coords.heading,
        speed: position.coords.speed,
        timestamp: position.timestamp,
      });
    } catch (err) {
      console.error('[useLocation] Error getting current location:', err);
      setError('Failed to get current location');
    } finally {
      setLoading(false);
    }
  }, [permissions.foreground]);

  /**
   * Request location permissions
   */
  const requestPermissions = useCallback(async (): Promise<boolean> => {
    try {
      setLoading(true);
      setError(null);

      const { status, canAskAgain } = await Location.requestForegroundPermissionsAsync();

      const permissionStatus = mapPermissionStatus(status);

      setPermissions({
        foreground: permissionStatus,
        canAskAgain,
      });

      if (permissionStatus === 'granted') {
        // Automatically get current location on permission grant
        await getCurrentLocation();
        return true;
      } else if (permissionStatus === 'denied' && !canAskAgain) {
        setError('Location permission denied. Please enable in device settings.');
      } else {
        setError('Location permission not granted');
      }

      return false;
    } catch (err) {
      console.error('[useLocation] Error requesting permissions:', err);
      setError('Failed to request location permissions');
      return false;
    } finally {
      setLoading(false);
    }
  }, [getCurrentLocation]);

  /**
   * Check current permission status on mount
   */
  useEffect(() => {
    const initializeLocation = async () => {
      await checkPermissions();
    };

    initializeLocation();

    // Cleanup subscription on unmount
    return () => {
      if (subscription) {
        subscription.remove();
      }
    };
  }, []);

  /**
   * Auto-fetch location when permission becomes granted
   */
  useEffect(() => {
    if (permissions.foreground === 'granted' && !location && !loading) {
      console.log('[useLocation] Permission granted, auto-fetching location...');
      getCurrentLocation();
    }
  }, [permissions.foreground, location, loading, getCurrentLocation]);

  /**
   * Start continuous location tracking
   */
  const startTracking = useCallback(async (options?: LocationTrackingOptions) => {
    if (permissions.foreground !== 'granted') {
      setError('Location permission not granted');
      return;
    }

    // Stop existing subscription if any
    if (subscription) {
      subscription.remove();
    }

    try {
      setLoading(true);
      setError(null);

      const accuracy = mapAccuracy(options?.accuracy || 'balanced');

      const newSubscription = await Location.watchPositionAsync(
        {
          accuracy,
          timeInterval: options?.timeInterval || 5000,
          distanceInterval: options?.distanceInterval || 10,
        },
        (position) => {
          setLocation({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            altitude: position.coords.altitude,
            accuracy: position.coords.accuracy,
            heading: position.coords.heading,
            speed: position.coords.speed,
            timestamp: position.timestamp,
          });
        }
      );

      setSubscription(newSubscription);
    } catch (err) {
      console.error('[useLocation] Error starting location tracking:', err);
      setError('Failed to start location tracking');
    } finally {
      setLoading(false);
    }
  }, [permissions.foreground, subscription]);

  /**
   * Stop location tracking
   */
  const stopTracking = useCallback(() => {
    if (subscription) {
      subscription.remove();
      setSubscription(null);
    }
  }, [subscription]);

  return {
    location,
    permissions,
    loading,
    error,
    requestPermissions,
    getCurrentLocation,
    startTracking,
    stopTracking,
  };
};

/**
 * Helper: Map Expo permission status to our enum
 */
const mapPermissionStatus = (status: Location.PermissionStatus): LocationPermissionStatus => {
  switch (status) {
    case Location.PermissionStatus.GRANTED:
      return 'granted';
    case Location.PermissionStatus.DENIED:
      return 'denied';
    default:
      return 'undetermined';
  }
};

/**
 * Helper: Map accuracy option to Expo accuracy constant
 */
const mapAccuracy = (accuracy: LocationTrackingOptions['accuracy']): Location.Accuracy => {
  switch (accuracy) {
    case 'low':
      return Location.Accuracy.Low;
    case 'balanced':
      return Location.Accuracy.Balanced;
    case 'high':
      return Location.Accuracy.High;
    case 'highest':
      return Location.Accuracy.Highest;
    default:
      return Location.Accuracy.Balanced;
  }
};
