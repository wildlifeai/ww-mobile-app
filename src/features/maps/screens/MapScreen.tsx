/**
 * MapScreen Component
 *
 * Main map screen with user location, controls, and permission handling
 * Foundational implementation - zero dependencies on other MVP2 features
 */

import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BasicMapView } from '../components/BasicMapView';
import { MapControls } from '../components/MapControls';
import { LocationPermissionPrompt } from '../components/LocationPermissionPrompt';
import { useLocation } from '../hooks/useLocation';
import { useMapRegion } from '../hooks/useMapRegion';
import { MapType } from '../types';

export const MapScreen: React.FC = () => {
  const {
    location,
    permissions,
    loading: locationLoading,
    error: locationError,
    requestPermissions,
    getCurrentLocation,
  } = useLocation();

  const {
    region,
    setRegion,
    zoomIn,
    zoomOut,
    resetToUserLocation,
    mapRef,
  } = useMapRegion();

  const [mapType, setMapType] = useState<MapType>('standard');
  const [initialLoad, setInitialLoad] = useState(true);

  /**
   * Debug logging
   */
  useEffect(() => {
    console.log('[MapScreen] Permission status:', permissions.foreground);
    console.log('[MapScreen] Location loading:', locationLoading);
    console.log('[MapScreen] Has location:', !!location);
    console.log('[MapScreen] Error:', locationError);
  }, [permissions.foreground, locationLoading, location, locationError]);

  /**
   * Center map on user location when available
   */
  useEffect(() => {
    if (location && initialLoad) {
      console.log('[MapScreen] Centering on user location:', location);
      resetToUserLocation(location);
      setInitialLoad(false);
    }
  }, [location, initialLoad, resetToUserLocation]);

  /**
   * Request permission on mount if not determined
   */
  useEffect(() => {
    if (permissions.foreground === 'undetermined') {
      // Don't auto-request - show prompt first
      console.log('[MapScreen] Location permission undetermined - showing prompt');
    }
  }, [permissions.foreground]);

  /**
   * Handle center on user button
   */
  const handleCenterUser = () => {
    if (location) {
      resetToUserLocation(location);
    } else {
      // Request fresh location if not available
      getCurrentLocation();
    }
  };

  /**
   * Show map with permission prompt overlay if needed
   * CHANGED: Always show map, overlay permission prompt
   */
  const showPermissionPrompt = permissions.foreground !== 'granted';
  const showMapUserLocation = permissions.foreground === 'granted';

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Map View - ALWAYS SHOWN */}
      <BasicMapView
        region={region}
        onRegionChangeComplete={setRegion}
        mapType={mapType}
        mapRef={mapRef}
        config={{ showsUserLocation: showMapUserLocation }}
      />

      {/* Permission Prompt Overlay */}
      {showPermissionPrompt && (
        <LocationPermissionPrompt
          status={permissions.foreground}
          onRequestPermission={requestPermissions}
          canAskAgain={permissions.canAskAgain}
        />
      )}

      {/* Map Controls */}
      <MapControls
        onZoomIn={zoomIn}
        onZoomOut={zoomOut}
        onCenterUser={handleCenterUser}
        onMapTypeChange={setMapType}
        currentMapType={mapType}
      />

      {/* Loading Indicator */}
      {locationLoading && (
        <View style={styles.loadingOverlay}>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#007AFF" />
            <Text style={styles.loadingText}>Getting your location...</Text>
          </View>
        </View>
      )}

      {/* Error Message */}
      {locationError && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>⚠️ {locationError}</Text>
        </View>
      )}

      {/* Location Info (Development) */}
      {__DEV__ && location && (
        <View style={styles.debugInfo}>
          <Text style={styles.debugText}>
            Lat: {location.latitude.toFixed(6)}
          </Text>
          <Text style={styles.debugText}>
            Lng: {location.longitude.toFixed(6)}
          </Text>
          {location.accuracy && (
            <Text style={styles.debugText}>
              Accuracy: ±{location.accuracy.toFixed(0)}m
            </Text>
          )}
        </View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#E5E5E5',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingContainer: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
    fontWeight: '500',
  },
  errorContainer: {
    position: 'absolute',
    top: 16,
    left: 16,
    right: 16,
    backgroundColor: '#FF3B30',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  errorText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  debugInfo: {
    position: 'absolute',
    bottom: 16,
    left: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    borderRadius: 8,
    padding: 12,
  },
  debugText: {
    color: 'white',
    fontSize: 12,
    fontFamily: 'monospace',
  },
});
