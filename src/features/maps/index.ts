/**
 * Maps Feature - Public Exports
 *
 * Foundational map functionality (zero dependencies)
 */

// Screens
export { MapScreen } from './screens/MapScreen';

// Components
export { BasicMapView } from './components/BasicMapView';
export { MapControls } from './components/MapControls';
export { LocationPermissionPrompt } from './components/LocationPermissionPrompt';

// Hooks
export { useLocation } from './hooks/useLocation';
export { useMapRegion } from './hooks/useMapRegion';

// Types
export type {
  MapRegion,
  UserLocation,
  LocationPermissionStatus,
  LocationPermissions,
  MapControls as MapControlsType,
  MapType,
  MapViewConfig,
  LocationTrackingOptions,
} from './types';
