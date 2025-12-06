# Wildlife Watcher App Architecture Guide

## Overview

The Wildlife Watcher mobile app is a React Native application that connects to wildlife monitoring camera devices via Bluetooth Low Energy (BLE). It allows researchers and conservationists to configure devices, update firmware, manage deployments, and track wildlife monitoring projects through an intuitive mobile interface.

### What This App Does
- **Device Management**: Scan, connect to, and configure wildlife camera devices via BLE
- **Firmware Updates**: Update device firmware using Nordic DFU (Device Firmware Update)
- **Project Management**: Create and manage wildlife monitoring projects
- **Deployment Tracking**: Track where devices are deployed with GPS coordinates
- **Maps Integration**: Visualize device deployments on interactive maps
- **Data Collection**: Monitor device status, battery levels, and sensor readings

## Architecture Overview

The app uses a layered architecture with clear separation of concerns:

```
┌─────────────────────────────────────────────────────────────┐
│                        UI Layer                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│  │   Screens   │  │ Components  │  │ Navigation  │        │
│  └─────────────┘  └─────────────┘  └─────────────┘        │
└─────────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────────┐
│                    Business Logic Layer                    │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│  │ Redux State │  │    Hooks    │  │  Providers  │        │
│  └─────────────┘  └─────────────┘  └─────────────┘        │
└─────────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────────┐
│                    Integration Layer                       │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│  │ BLE Engine  │  │ DFU Service │  │ Sync Engine │        │
│  └─────────────┘  └─────────────┘  └─────────────┘        │
└─────────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────────┐
│                     Platform Layer                         │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│  │ React Native│  │ Expo Modules│  │Native Modules│       │
│  └─────────────┘  └─────────────┘  └─────────────┘        │
└─────────────────────────────────────────────────────────────┘
          │                             │
┌─────────▼──────────┐        ┌─────────▼───────────┐
│   Local Storage    │        │   Cloud Backend     │
│                    │        │                     │
│  WatermelonDB      │◄──────►│  Supabase           │
│  (Reactive DB)     │  Sync  │  (PostgreSQL +      │
│                    │        │   Auth + Storage)   │
└────────────────────┘        └─────────────────────┘
```

## Provider Hierarchy

The app uses a nested provider pattern that wraps the entire application with essential services. Each provider handles a specific aspect of the app's functionality:

```typescript
<SafeAreaProvider>           // Screen safe areas
  <ReduxProvider>            // Global state management
    <PaperProvider>          // UI theme and components
      <NavigationContainer>  // Navigation state
        <AndroidPermissionsProvider>  // Permission handling
          <AppSetupProvider>          // App initialization
            <BleEngineProvider>       // BLE functionality
              <ListenToBleEngineProvider>  // BLE event handling
                <AuthProvider>             // User authentication
                  <MainNavigation />       // App screens
                </AuthProvider>
              </ListenToBleEngineProvider>  
            </BleEngineProvider>
          </AppSetupProvider>
        </AndroidPermissionsProvider>
      </NavigationContainer>
    </PaperProvider>
  </ReduxProvider>
</SafeAreaProvider>
```

### Key Providers Explained

**1. AndroidPermissionsProvider**
- Manages location and Bluetooth permissions required for BLE scanning
- Ensures proper permission flow before allowing device operations

**2. AppSetupProvider**
- Handles app initialization logic
- Sets up logging, configuration, and initial state

**3. BleEngineProvider**
- Core BLE functionality provider
- Exposes BLE actions: scan, connect, disconnect, write commands
- Manages the BLE communication engine

**4. ListenToBleEngineProvider**
- Handles BLE events and responses from devices
- Processes incoming data and updates Redux state

**5. AuthProvider**
- Manages user authentication
- Handles login/logout state and Supabase session management

## Navigation Structure

The app uses React Navigation with a stack-based structure:

### Main Navigation Flow
```
AppLoading (initial loading) 
    ↓
Prerequisites Check:
  ├─ BluetoothProblems (if BLE issues)
  ├─ LocationProblems (if location disabled)  
  ├─ BleProblems (if BLE library issues)
  └─ MainApp (if all good)
    ↓
Home (BottomTabs):
  ├─ Maps
  ├─ Projects  
  ├─ Deployment (default)
  └─ Devices
```

### Screen Flow
- **Maps**: Interactive map showing device deployments
- **Projects**: List and manage wildlife monitoring projects
- **Deployment**: Current deployment status and controls
- **Devices**: BLE device scanning, connection, and management
- **DeviceNavigator**: Individual device configuration (Terminal, DFU)
- **Settings/Profile**: App configuration and user management

### Bottom Tabs Structure
The main interface uses 4 bottom tabs:
1. **Maps** - Deployment visualization
2. **Projects** - Project management
3. **Deployment** - Current deployment (default active)
4. **Devices** - Device management

## Redux State Management

The app uses Redux Toolkit for state management with the following slices:

### State Slices
```typescript
{
  devices: devicesReducer,           // Connected BLE devices
  logs: logsReducer,                 // Device communication logs
  configuration: configurationReducer, // Device configurations
  scanning: scanningReducer,         // BLE scanning state
  bleLibrary: bleLibraryReducer,     // BLE initialization status
  blStatus: blStatusReducer,         // Bluetooth status
  locationStatus: locationStatusReducer, // GPS/location status
  androidPermissions: androidPermissionsReducer, // Permission status
  authentication: authReducer,       // User authentication
  offline: offlineReducer,           // Sync status
  projects: projectsReducer,         // UI state (filters)
  [api.reducerPath]: api.reducer     // RTK Query API state
}
```

### Key State Objects

**devices**: Tracks all discovered and connected BLE devices
- Device connection status
- Device information (ID, name, RSSI)
- Connection loading states

**logs**: Communication history with devices
- Command/response pairs
- Error messages and debugging info
- Terminal-style interaction logs

**configuration**: Device-specific settings
- LoRaWAN parameters
- Sensor configurations
- Device operational settings

## BLE Communication System

The BLE system is the heart of the app, handling all communication with wildlife camera devices.

### BLE Architecture
```
useBle Hook (BLE Engine)
    ↓
BleManager (react-native-ble-manager)
    ↓
Native BLE Stack
    ↓
Wildlife Camera Device
```

### Key BLE Components

**1. useBle Hook** (`src/hooks/useBle.ts`)
- Main BLE engine with command queue system
- Handles device scanning, connection, and communication
- Implements 500ms write intervals to prevent buffer overflow
- Manages automatic ping system (every 40 seconds)

**2. Command System** (`src/ble/types.ts`)
- Text-based command protocol
- Commands: ID, VERSION, BATTERY, PING, DFU, RESET, etc.
- Regex-based response parsing

**3. BLE Service** 
- Service UUID: `6e400001-b5a3-f393-e0a9-e50e24dcca9e`
- Text-based communication protocol
- Command/response pattern with timeout handling

### BLE Communication Flow
1. **Scan** → Discover nearby Wildlife Watcher devices
2. **Connect** → Establish BLE connection
3. **Command Queue** → Send commands with 500ms intervals
4. **Response Parsing** → Parse device responses via regex
5. **State Updates** → Update Redux state with device data
6. **Auto Ping** → Keep connection alive with periodic pings

## Device Firmware Update (DFU) System

The app supports over-the-air firmware updates using Nordic DFU:

### DFU Architecture
```
DfuService (src/services/DfuService.ts)
    ↓
react-native-nordic-dfu (Native Module)
    ↓
Nordic DFU Library
    ↓
Wildlife Camera Device (Bootloader Mode)
```

### DFU Process
1. **Firmware Selection** → User selects firmware ZIP file
2. **Device Preparation** → Device enters DFU/bootloader mode
3. **Transfer** → Nordic DFU handles the transfer process
4. **Progress Tracking** → Real-time progress updates
5. **Validation** → Device validates and applies firmware
6. **Reboot** → Device restarts with new firmware

### Limitations
- **Firmware Only**: Current system only supports nRF (BLE) firmware updates. Himax AI processor updates are planned.
- **No AI Models**: Cannot transfer AI model files (identified limitation).
- **No Config Persistence**: App cannot currently write to `CONFIG.TXT` on SD card (planned feature).
- **ZIP Format**: Requires Nordic DFU-compatible ZIP packages

## UI Component System

The app uses a custom component library with consistent styling:

### WW-Prefixed Components (`src/components/ui/`)
- **WWButton** - Standardized button component
- **WWText** - Typography with theme integration
- **WWTextInput** - Form input with validation
- **WWSelect** - Dropdown/picker component
- **WWScreenView** - Screen container with safe areas
- **WWScrollView** - Scrollable container
- **WWLoader** - Loading indicators
- **WWProgressBar** - Progress visualization

### Design System
- **Theme**: React Native Paper with custom colors
- **Typography**: Consistent text sizing and colors
- **Spacing**: Standardized margins and padding
- **Icons**: Material Design icons via React Native Paper

## Maps Integration

The app uses react-native-maps for deployment visualization:

### Maps Features
- **Device Markers** - Show deployed device locations
- **Project Boundaries** - Visual project area representation
- **Interactive Controls** - Zoom, pan, marker selection
- **GPS Integration** - Current location and device placement

### Maps Architecture
```
Maps Screen
    ↓
react-native-maps (MapView)
    ↓
Google Maps SDK (Android) / MapKit (iOS)
```

## API Integration

The app uses Supabase for backend communication and WatermelonDB for local persistence.

> **✅ Integration Status**: This app is fully integrated with Supabase. The backend project is located at `~/dev/wildlifeai/wildlife-watcher-backend`. We use the Supabase JS client for Auth and WatermelonDB's Sync Engine for offline-first data synchronization.

## Development Workflow Integration

### Hot Reload Support
- **JavaScript Changes** → Instant hot reload
- **Native Changes** → Require new EAS build
- **Configuration Changes** → May require rebuild

### Development Tools
- **Redux DevTools** - State debugging
- **BLE Logging** - Communication debugging
- **Terminal Screen** - Direct device communication
- **Metro Bundler** - Development server

## Key Dependencies

### Native Modules (Require Compilation)
- **react-native-ble-manager@11.3.2** - BLE communication
- **react-native-nordic-dfu** (GitHub fork) - Firmware updates
- **react-native-maps@1.20.1** - Maps integration
- **react-native-bluetooth-state-manager** - Bluetooth status

### Expo Modules (Cloud Compatible)
- **expo-file-system** - File operations (replaces react-native-fs)
- **expo-constants** - Environment variables (replaces react-native-config)
- **expo-splash-screen** - App startup (replaces react-native-bootsplash)

### UI Framework
- **react-native-paper@5.12.3** - Material Design components
- **@react-navigation/native@6** - Navigation system
- **react-redux + @reduxjs/toolkit** - State management

## Data Flow

### Typical User Interaction Flow
1. **App Launch** → Check prerequisites (BLE, location, permissions)
2. **Device Discovery** → Scan for nearby Wildlife Watcher devices
3. **Device Connection** → Connect to specific device via BLE
4. **Device Configuration** → Send commands to configure device settings
5. **Deployment Creation** → Create deployment record with GPS coordinates
6. **Monitoring** → Track device status, battery, sensor readings
7. **Firmware Updates** → Update device firmware when needed

### Data Flow Diagram
```
User Action
    ↓
React Component
    ↓
WatermelonDB Write (Action)
    ↓
Local Database Update
    ↓
Observables Trigger (withObservables)
    ↓
UI Re-render
    ↓
(Background) Supabase Sync
```

## Common Patterns

### 1. Device Communication Pattern
```typescript
// Get BLE actions from provider
const { write, connectDevice } = useBleActions();

// Connect to device
const device = await connectDevice(peripheral);

// Send command
await write(device, [['BATTERY', {}]]);

// State automatically updates via BLE listeners
```

### 2. Screen Structure Pattern
```typescript
export const ScreenName = () => {
  const { deviceId } = useRoute().params;
  const device = useAppSelector(/* select device */);
  
  return (
    <WWScreenView>
      <WWScrollView>
        {/* Screen content */}
      </WWScrollView>
    </WWScreenView>
  );
};
```

### 3. Data Access Pattern (WatermelonDB)
```typescript
// Connect component to database
const enhance = withObservables(['project'], ({ project }) => ({
  project,
  deployments: project.deployments.observe(),
}));

export default enhance(ProjectDetails);
```

## Error Handling

### BLE Error Handling
- **Connection Timeouts** - Automatic retry with backoff
- **Command Failures** - Error logging and user notification
- **Device Disconnection** - Auto-reconnection attempts

### Permission Handling
- **Bluetooth Permissions** - Guided permission flow
- **Location Permissions** - Required for BLE scanning
- **Graceful Degradation** - Clear error screens for missing permissions

### Network Error Handling
- **Sync Failures** - Automatic retry by WatermelonDB Sync Engine
- **Offline Mode** - Full functionality via local database
- **Conflict Resolution** - Last-write-wins strategy implemented in sync service

## Security Considerations

### BLE Security
- **Device Validation** - Verify device identity before connection
- **Command Validation** - Validate commands before sending
- **Connection Encryption** - BLE-level encryption handling

### Data Security
- **API Authentication** - JWT token-based authentication
- **Local Storage** - Secure storage for sensitive data
- **Network Security** - HTTPS for all API communication

## Performance Optimization

### BLE Performance
- **Command Queuing** - 500ms intervals prevent buffer overflow
- **Connection Pooling** - Efficient connection management
- **Background Handling** - Proper background/foreground transitions

### UI Performance
- **Component Memoization** - React.memo for expensive components
- **Lazy Loading** - Code splitting and lazy imports
- **Image Optimization** - Efficient asset loading

### Memory Management
- **Provider Cleanup** - Proper cleanup in useEffect hooks
- **BLE Connection Cleanup** - Disconnect on app background
- **Redux State Cleanup** - Clear unnecessary state

## Testing Strategy

### Unit Testing
- **BLE Command Parsing** - Test command construction and parsing
- **Redux Reducers** - Test state mutations
- **Utility Functions** - Test helper functions

### Integration Testing
- **BLE Communication** - Test with real devices
- **Navigation Flow** - Test screen transitions
- **API Integration** - Test with backend services

### Device Testing
- **Real Hardware Required** - BLE functionality needs actual devices
- **Multiple Devices** - Test device switching and multi-device scenarios
- **Different Android Versions** - Test permission handling across versions

## Troubleshooting Common Issues

### BLE Issues
- **Connection Failures** → Check permissions, device proximity
- **Command Timeouts** → Verify device is responding, check BLE status
- **Data Parsing Errors** → Check command format and regex patterns

### Build Issues
- **Native Module Errors** → Ensure development client is up to date
- **Metro Bundle Errors** → Clear cache, restart development server
- **Permission Errors** → Verify all required permissions are granted

### Development Issues
- **Hot Reload Not Working** → Check Metro connection, restart development server
- **State Not Updating** → Check Redux DevTools, verify action dispatch
- **Component Not Rendering** → Check navigation state and route parameters

## Future Architecture Considerations

### Planned Enhancements
- **Himax Firmware Updates** - Extend DFU system to support flashing Himax AI processor via BLE
- **Remote Configuration** - Implement writing to `CONFIG.TXT` on SD card for persistent settings
- **AI Model Updates** - Extend DFU system to support AI model files
- **Advanced Analytics** - Wildlife detection and analysis

### Scalability Considerations
- **Background Processing** - Move heavy operations to background
- **Data Pagination** - Handle large datasets efficiently
- **Caching Strategy** - Implement comprehensive caching layer
- **Error Recovery** - Advanced error recovery and retry mechanisms

## Getting Started with the Architecture

### For New Developers
1. **Start with Provider Hierarchy** - Understand the nested provider pattern
2. **Explore BLE System** - Key to understanding device communication
3. **Study Redux State** - Central to all app data flow
4. **Test with Real Devices** - Essential for BLE functionality
5. **Use Development Client** - Required for native module testing

### Key Files to Understand
- `src/App.tsx` - Provider hierarchy and app structure
- `src/hooks/useBle.ts` - Core BLE communication engine
- `src/database/index.ts` - WatermelonDB setup
- `src/services/SupabaseSyncService.ts` - Offline sync engine
- `src/navigation/index.tsx` - Navigation flow and prerequisite checks

### Development Flow
1. **Set up development environment** - Follow onboarding guides
2. **Build development client** - Required for native modules
3. **Connect real Wildlife Watcher device** - Essential for testing
4. **Study BLE logs** - Use terminal screen to understand communication
5. **Make changes incrementally** - Test frequently with hot reload

---

*This architecture guide provides a comprehensive overview of how the Wildlife Watcher app is structured and operates. For specific implementation details, refer to the individual code files and other documentation guides.*