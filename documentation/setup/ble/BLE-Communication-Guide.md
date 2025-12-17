# BLE Communication Guide

## Overview

The Wildlife Watcher mobile app communicates with camera devices via Bluetooth Low Energy (BLE). This guide covers the BLE architecture, command system, and image preview functionality.

## Architecture

### BLE Stack

```
┌─────────────────────────────────────────┐
│  React Native UI                        │
│  (EngineerConsoleScreen, etc.)          │
└─────────────────────────────────────────┘
                  ↓
┌─────────────────────────────────────────┐
│  BLE Service Layer                      │
│  (src/ble/bleService.ts)                │
│  - Device discovery                     │
│  - Connection management                │
│  - Command sending                      │
│  - Response parsing                     │
└─────────────────────────────────────────┘
                  ↓
┌─────────────────────────────────────────┐
│  react-native-ble-manager               │
│  (Native BLE library)                   │
└─────────────────────────────────────────┘
                  ↓
┌─────────────────────────────────────────┐
│  Camera Firmware                        │
│  (ESP32 BLE peripheral)                 │
└─────────────────────────────────────────┘
```

## Command System

### Command Structure

Commands are defined in `src/ble/types.ts`:

```typescript
export interface BLECommand {
    id: string
    name: string
    description: string
    category: 'camera' | 'system' | 'flash' | 'time' | 'network'
    parameters: BLECommandParameter[]
    response?: {
        type: 'json' | 'text' | 'binary'
        schema?: any
    }
}
```

### Command Categories

**Camera Commands**
- `CAPTURE_PREVIEW` - Capture and download preview image
- `CAPTURE_PHOTO` - Capture full-resolution photo
- `START_VIDEO` - Start video recording
- `STOP_VIDEO` - Stop video recording

**Flash Commands**
- `FLASH_ON` - Turn flash on with duration and count
  - Parameters: `count` (number of flashes), `duration` (ms per flash)
- `FLASH_OFF` - Turn flash off

**System Commands**
- `GET_STATUS` - Get camera status (battery, storage, etc.)
- `GET_CONFIG` - Get camera configuration
- `SET_CONFIG` - Update camera configuration
- `REBOOT` - Reboot camera

**Time Commands**
- `GET_TIME` - Get camera's current time
- `SET_TIME` - Sync camera time with phone

**Network Commands**
- `GET_WIFI_STATUS` - Get WiFi connection status
- `SET_WIFI_CREDENTIALS` - Configure WiFi

### Sending Commands

```typescript
import { bleService } from '@/ble/bleService'

// Send command with parameters
await bleService.sendCommand('FLASH_ON', {
    count: 3,      // Flash 3 times
    duration: 500  // 500ms per flash
})

// Send command without parameters
await bleService.sendCommand('GET_STATUS')
```

### Command Responses

Commands return responses in different formats:

**JSON Response:**
```typescript
const response = await bleService.sendCommand('GET_STATUS')
// response = {
//     battery: 85,
//     storage_free: 1024000,
//     temperature: 25
// }
```

**Text Response:**
```typescript
const response = await bleService.sendCommand('GET_TIME')
// response = "2025-12-09T12:34:56Z"
```

**Binary Response:**
```typescript
const response = await bleService.sendCommand('CAPTURE_PREVIEW')
// response = Uint8Array (JPEG image data)
```

## Image Preview Feature

### Overview

The image preview feature allows users to capture and view preview images from the camera without storing them permanently.

### Flow

```
User Action → Send CAPTURE_PREVIEW → Camera captures → 
Download image → Display in modal → User saves/discards
```

### Implementation

**1. Trigger Capture**
```typescript
// EngineerConsoleScreen.tsx
const handleCapturePreview = async () => {
    await bleService.sendCommand('CAPTURE_PREVIEW')
    // Auto-download is triggered by command response
}
```

**2. Auto-Download**
```typescript
// bleService.ts
async sendCommand(commandId: string, params?: any) {
    const response = await this.executeCommand(commandId, params)
    
    if (commandId === 'CAPTURE_PREVIEW' && response) {
        // Trigger download automatically
        await this.downloadPreviewImage()
    }
    
    return response
}
```

**3. Display Modal**
```typescript
// ImagePreviewModal.tsx
<Modal visible={visible} onDismiss={onDismiss}>
    <Image 
        source={{ uri: imageUri }} 
        style={styles.image}
        resizeMode="contain"
    />
    <Button onPress={onSave}>Save</Button>
    <Button onPress={onDismiss}>Discard</Button>
</Modal>
```

### Image Storage

Preview images are stored temporarily:

```typescript
const PREVIEW_DIR = `${FileSystem.documentDirectory}previews/`

// Save preview
await FileSystem.writeAsStringAsync(
    `${PREVIEW_DIR}preview_${Date.now()}.jpg`,
    base64Image,
    { encoding: FileSystem.EncodingType.Base64 }
)

// Clean up old previews
await FileSystem.deleteAsync(PREVIEW_DIR, { idempotent: true })
```

## Connection Management

### Device Discovery

```typescript
// Start scanning
await bleService.startScan()

// Devices are discovered via callback
bleService.onDeviceDiscovered((device) => {
    console.log('Found device:', device.name)
})

// Stop scanning after timeout
setTimeout(() => bleService.stopScan(), 10000)
```

### Connection

```typescript
// Connect to device
await bleService.connect(deviceId)

// Check connection status
const isConnected = await bleService.isConnected(deviceId)

// Disconnect
await bleService.disconnect(deviceId)
```

### Connection State

The app maintains connection state in Redux:

```typescript
// Redux state
interface BLEState {
    connectedDevice: Device | null
    isScanning: boolean
    discoveredDevices: Device[]
    connectionStatus: 'disconnected' | 'connecting' | 'connected'
}
```

## Error Handling

### Common Errors

**Connection Timeout**
```typescript
try {
    await bleService.connect(deviceId)
} catch (error) {
    if (error.message.includes('timeout')) {
        // Show user-friendly message
        Alert.alert('Connection failed', 'Camera did not respond')
    }
}
```

**Command Timeout**
```typescript
try {
    await bleService.sendCommand('GET_STATUS', {}, { timeout: 5000 })
} catch (error) {
    if (error.message.includes('timeout')) {
        Alert.alert('Command timeout', 'Camera did not respond')
    }
}
```

**Bluetooth Disabled**
```typescript
bleService.onStateChange((state) => {
    if (state === 'PoweredOff') {
        Alert.alert('Bluetooth disabled', 'Please enable Bluetooth')
    }
})
```

## Testing

### Manual Testing

1. **Device Discovery**
   - Open Engineer Console
   - Tap "Scan for Devices"
   - Verify camera appears in list

2. **Connection**
   - Tap camera in device list
   - Verify "Connected" status
   - Check connection indicator

3. **Commands**
   - Send "Get Status" command
   - Verify response displays
   - Try flash commands

4. **Image Preview**
   - Tap "Capture & Download" quick action
   - Verify image downloads
   - Check modal displays image
   - Test save/discard buttons

### Automated Testing

```typescript
describe('BLE Service', () => {
    it('should discover devices', async () => {
        const devices = await bleService.startScan()
        expect(devices.length).toBeGreaterThan(0)
    })
    
    it('should connect to device', async () => {
        await bleService.connect(TEST_DEVICE_ID)
        const isConnected = await bleService.isConnected(TEST_DEVICE_ID)
        expect(isConnected).toBe(true)
    })
    
    it('should send command', async () => {
        const response = await bleService.sendCommand('GET_STATUS')
        expect(response).toHaveProperty('battery')
    })
})
```

## Troubleshooting

### Device Not Found

**Symptoms:** Camera doesn't appear in scan results

**Solutions:**
1. Ensure camera is powered on
2. Check camera is in BLE advertising mode
3. Verify Bluetooth is enabled on phone
4. Try restarting camera
5. Check camera is in range (< 10m)

### Connection Fails

**Symptoms:** Connection timeout or error

**Solutions:**
1. Ensure camera is not connected to another device
2. Restart Bluetooth on phone
3. Restart camera
4. Clear app cache and reconnect
5. Check Metro logs for BLE errors

### Commands Not Working

**Symptoms:** Commands timeout or return errors

**Solutions:**
1. Verify camera firmware version is compatible
2. Check command parameters are correct
3. Ensure camera is not busy (e.g., recording)
4. Try disconnecting and reconnecting
5. Check Metro logs for command errors

### Image Preview Not Working

**Symptoms:** Image doesn't download or display

**Solutions:**
1. Check camera has captured image successfully
2. Verify storage permissions
3. Check file system has space
4. Try manual download command
5. Check Metro logs for download errors

## Best Practices

### Connection Management

```typescript
// ✅ GOOD: Always disconnect when done
useEffect(() => {
    return () => {
        bleService.disconnect(deviceId)
    }
}, [deviceId])

// ❌ BAD: Leaving connections open
// (drains battery, prevents other connections)
```

### Command Timeouts

```typescript
// ✅ GOOD: Set appropriate timeouts
await bleService.sendCommand('CAPTURE_PHOTO', {}, { 
    timeout: 30000  // 30s for photo capture
})

// ❌ BAD: Using default timeout for long operations
await bleService.sendCommand('CAPTURE_PHOTO')  // May timeout
```

### Error Handling

```typescript
// ✅ GOOD: User-friendly error messages
try {
    await bleService.connect(deviceId)
} catch (error) {
    Alert.alert(
        'Connection Failed',
        'Could not connect to camera. Please try again.'
    )
}

// ❌ BAD: Showing raw errors
catch (error) {
    Alert.alert('Error', error.message)  // Technical jargon
}
```

## Performance Optimization

### Reduce Scanning Time

```typescript
// ✅ GOOD: Stop scan when device found
bleService.onDeviceDiscovered((device) => {
    if (device.name === 'WildlifeWatcher') {
        bleService.stopScan()
        bleService.connect(device.id)
    }
})

// ❌ BAD: Scanning indefinitely
bleService.startScan()  // Never stops
```

### Batch Commands

```typescript
// ✅ GOOD: Send multiple commands efficiently
const [status, config, time] = await Promise.all([
    bleService.sendCommand('GET_STATUS'),
    bleService.sendCommand('GET_CONFIG'),
    bleService.sendCommand('GET_TIME')
])

// ❌ BAD: Sequential commands
const status = await bleService.sendCommand('GET_STATUS')
const config = await bleService.sendCommand('GET_CONFIG')
const time = await bleService.sendCommand('GET_TIME')
```

## Security Considerations

### Pairing

The app uses BLE pairing for secure communication:

```typescript
// Pairing is handled automatically by OS
// User may see pairing dialog on first connection
await bleService.connect(deviceId)  // Triggers pairing if needed
```

### Data Encryption

BLE communication is encrypted at the protocol level:
- Pairing establishes encryption keys
- All subsequent communication is encrypted
- No additional encryption needed in app layer

### Access Control

Only paired devices can send commands:
- Camera rejects commands from unpaired devices
- Pairing requires physical access to camera
- User must approve pairing on phone

## Resources

- [react-native-ble-manager Documentation](https://github.com/innoveit/react-native-ble-manager)
- [BLE Specification](https://www.bluetooth.com/specifications/specs/core-specification/)
- [ESP32 BLE Documentation](https://docs.espressif.com/projects/esp-idf/en/latest/esp32/api-reference/bluetooth/index.html)
