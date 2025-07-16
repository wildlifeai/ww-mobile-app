# Wildlife Watcher Mobile App - Features & Implementation Analysis

## Overview

Wildlife Watcher is a React Native mobile application designed for communication with Wildlife Watcher cameras via Bluetooth Low Energy (BLE). These cameras are AI-powered wildlife monitoring devices that record animals and identify them automatically. The app serves as a comprehensive configuration, management, and deployment interface for these wildlife monitoring systems.

## Core Functionality

### Primary Purpose
- Configure and manage Wildlife Watcher camera devices via BLE
- Deploy devices for wildlife monitoring projects
- Track and manage multiple wildlife monitoring deployments
- Update device firmware remotely

## Technology Stack

### Framework & Core Libraries
- **React Native 0.74.6** - Cross-platform mobile development
- **TypeScript** - Type-safe development
- **React Navigation 6** - Navigation management
- **Redux Toolkit + RTK Query** - State management and API calls
- **React Native Paper** - Material Design UI components

### BLE & Device Communication
- **react-native-ble-manager** - Core BLE functionality
- **react-native-nordic-dfu** - Device firmware updates
- Custom BLE protocol for Wildlife Watcher devices

### Maps & Location
- **React Native Maps** - Map integration for deployment tracking
- **@react-native-community/geolocation** - Location services

### Authentication & Backend
- **@react-native-firebase/app** - Firebase integration
- **react-native-app-auth** - OAuth authentication (currently disabled)
- **REST API integration** via RTK Query

## Key Features Implemented

### 1. Device Management & BLE Communication

**Main Implementation**: `src/hooks/useBle.ts:76-397`

**Features**:
- **Device Discovery**: Automatic scanning for Wildlife Watcher devices
- **BLE Connection Management**: Connect/disconnect from devices with timeout handling
- **Command Queue System**: Manages BLE write operations with proper sequencing
- **Real-time Communication**: Bidirectional communication with camera devices
- **Device Reconnection**: Automatic reconnection logic for dropped connections
- **Connection State Management**: Tracks device connection status and loading states

**Supported Device Commands** (`src/ble/types.ts:7-24`):
- `ID` - Device identification
- `VERSION` - Firmware version info
- `BATTERY` - Battery status monitoring
- `HEARTBEAT` - Connection keepalive
- `DEVEUI/APPEUI/APPKEY` - LoRaWAN configuration
- `SENSOR` - Sensor configuration
- `RESET/ERASE` - Device management
- `DFU` - Firmware update mode
- `PING` - Connection testing

### 2. Terminal Interface

**Main Implementation**: `src/navigation/screens/TerminalScreen.tsx:39-100`

**Features**:
- **Command-Line Interface**: Terminal-style interface for device configuration
- **Real-time Device Logs**: Live logging of device responses and commands
- **Interactive Configuration**: Forms for setting device parameters:
  - Heartbeat intervals
  - LoRaWAN credentials (AppEUI, DevEUI)
  - Sensor settings
- **Device Actions**: Reset, erase, firmware update triggers
- **Auto-scroll Logs**: Automatically scrolling terminal output

### 3. Firmware Update System (DFU)

**Main Implementation**: `src/services/DfuService.ts:3-32`

**Features**:
- **Nordic DFU Protocol**: Uses Nordic's Device Firmware Update protocol
- **Progress Tracking**: Real-time progress updates during firmware updates
- **File Management**: Handles firmware file selection and upload
- **Error Handling**: Comprehensive error handling for update failures
- **Update Screen**: Dedicated interface for firmware updates (`src/navigation/screens/DfuScreen.tsx`)

### 4. Project Management System

**Main Implementation**: `src/navigation/screens/AddProject.tsx:13-42`

**Features**:
- **Project Creation**: Create new wildlife monitoring projects with:
  - Project title and acronym
  - Description and sampling design
  - Capture methods
  - Individual animal tracking
  - Observation levels
  - Project team management
  - Privacy settings
- **Form Validation**: Input validation using react-hook-form
- **API Integration**: Saves projects to backend via RTK Query

### 5. Deployment Management

**Main Implementation**: `src/navigation/screens/Deployments.tsx:17-100`

**Features**:
- **Device Discovery Dashboard**: Main screen showing available devices
- **Deployment Tracking**: List and manage active deployments
- **Device Connection**: Quick connect to devices for configuration
- **Auto-scanning**: Periodic scanning for nearby devices (15-second intervals)
- **Signal Strength Display**: RSSI-based device sorting
- **Deployment Cards**: Visual representation of active deployments

### 6. Navigation & User Interface

**Main Implementation**: `src/navigation/index.tsx:50-173`

**App Structure**:
- **Conditional Navigation**: Smart routing based on system state:
  - Bluetooth status checks
  - Location permissions
  - BLE library initialization
  - Authentication status (currently disabled)
- **Bottom Tab Navigation**:
  - **Maps**: Location-based deployment view
  - **Projects**: Project management interface
  - **Deployment**: Main device discovery and deployment screen
  - **Devices**: Device management (placeholder)
- **Stack Navigation**: 
  - Device configuration screens
  - Firmware update interface
  - Project creation flows

### 7. State Management Architecture

**Main Implementation**: `src/redux/index.ts:15-30`

**Redux Slices**:
- **devices**: BLE device management and connection states
- **logs**: Device communication logging
- **configuration**: Device configuration state tracking
- **scanning**: BLE scanning state management
- **bleLibrary**: BLE library initialization status
- **authentication**: User authentication (disabled)
- **API endpoints**: RESTful API state management

### 8. Permission & Setup Management

**Provider Architecture** (`src/App.tsx:18-42`):
- **AndroidPermissionsProvider**: Handles Android BLE/location permissions
- **AppSetupProvider**: App initialization logic
- **BleEngineProvider**: BLE engine setup and management
- **ListenToBleEngineProvider**: BLE event listeners
- **AuthProvider**: Authentication management (currently disabled)
- **DeviceReconnectProvider**: Device-specific reconnection logic

### 9. Maps Integration

**Features**:
- **Deployment Mapping**: Visual representation of device deployments
- **Location Tracking**: GPS-based deployment location recording
- **React Native Maps**: Full map integration for deployment visualization

## Features Not Fully Implemented

### 1. Authentication System
- **Status**: Login/Register screens exist but are commented out
- **Location**: `src/navigation/screens/Login.tsx`, `src/navigation/screens/Register.tsx`
- **Current State**: Authentication provider exists but bypassed in navigation

### 2. Device Management Screen
- **Status**: Placeholder implementation
- **Location**: `src/navigation/screens/Devices.tsx:5-13`
- **Current State**: Shows "Devices screen coming soon" message

### 3. Community Features
- **Status**: Placeholder screens
- **Location**: `src/navigation/screens/CommunityDiscussion.tsx`
- **Current State**: Basic screen structure without functionality

### 4. Notifications System
- **Status**: Screen exists but no implementation
- **Location**: `src/navigation/screens/Notifications.tsx`

### 5. User Profile Management
- **Status**: Basic screen without full functionality
- **Location**: `src/navigation/screens/Profile.tsx`

## Technical Architecture Highlights

### BLE Communication Engine
- **Queue-based Command System**: Prevents BLE buffer overflow
- **Automatic Reconnection**: Handles connection drops gracefully
- **Command Timeout Handling**: Prevents hanging operations
- **Ping/Heartbeat System**: Maintains active connections

### State Synchronization
- **Real-time Updates**: Device state synced across app
- **Persistent Configuration**: Device settings stored in Redux
- **API Integration**: Backend synchronization for projects/deployments

### Error Handling
- **Comprehensive Logging**: Detailed logging system for debugging
- **Graceful Degradation**: App continues functioning with partial features
- **Permission Management**: Handles missing permissions elegantly

## File Structure Overview

```
src/
├── navigation/          # Navigation setup and screens
├── hooks/              # Custom React hooks for BLE, devices, etc.
├── providers/          # React context providers for app state
├── redux/              # State management (slices and API)
├── components/         # Reusable UI components
├── ble/               # BLE protocol and command parsing
├── services/          # External services (DFU, etc.)
├── utils/             # Helper functions and constants
└── assets/            # Static assets and images
```

## Development Status

### Fully Functional Features
✅ BLE device discovery and connection  
✅ Device configuration via terminal interface  
✅ Firmware update system  
✅ Project creation and management  
✅ Deployment tracking  
✅ Real-time device communication  
✅ Permission management  
✅ Maps integration  

### Partially Implemented
🟡 User authentication (disabled)  
🟡 Device management dashboard  
🟡 User profile management  

### Placeholder/Future Features
❌ Community discussion  
❌ Push notifications  
❌ Advanced analytics  

## Platform Support

### Android
- Minimum SDK: As per React Native 0.74.6 requirements
- BLE permissions handled automatically
- Firebase integration for app distribution

### iOS  
- Minimum deployment target: iOS 14.0
- CocoaPods dependency management
- Static frameworks configuration
- Firebase integration for app distribution

This app represents a sophisticated wildlife monitoring solution with robust BLE communication, device management, and project tracking capabilities, specifically designed for managing AI-powered wildlife cameras in field deployments.