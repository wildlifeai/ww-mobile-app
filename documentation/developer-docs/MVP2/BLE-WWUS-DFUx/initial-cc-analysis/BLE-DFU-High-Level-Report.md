# BLE and DFU High-Level Report for Hardware Team

## Executive Summary

The Wildlife Watcher mobile application currently implements Bluetooth Low Energy (BLE) communication and Nordic Device Firmware Update (DFU) capabilities for wildlife camera devices. While the existing system successfully handles firmware updates, it lacks the infrastructure to support AI model file transfers—a critical requirement for next-generation wildlife monitoring capabilities.

This report provides a high-level overview of the current implementation, identifies key limitations, and presents recommendations for evolving the system to support both firmware and AI model updates.

## Current System Overview

### What the App Can Do Today

1. **Device Discovery & Connection**
   - Scan for Wildlife Watcher devices (identified by names: REWILD, WW, WILD)
   - Establish BLE connections with devices
   - Maintain connection stability with automatic ping/heartbeat mechanism

2. **Device Communication**
   - Send text-based commands to devices
   - Receive and parse device responses
   - Monitor device status (battery, version, configuration)

3. **Firmware Updates**
   - Transfer firmware files (.zip format) to devices
   - Track update progress with visual feedback
   - Automatic cleanup after successful updates

### What the App Cannot Do Today

1. **AI Model Updates**
   - No support for AI model file formats
   - No mechanism for large file transfers beyond firmware
   - No chunking or resume capability for interrupted transfers

2. **Advanced Update Management**
   - Cannot queue multiple updates
   - No version compatibility checking
   - No rollback or recovery mechanisms
   - Cannot validate files before transfer

## System Architecture Overview

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Mobile App    │────▶│   BLE Service   │────▶│ Wildlife Device │
│                 │     │                 │     │                 │
│  ┌───────────┐  │     │  ┌───────────┐ │     │  ┌───────────┐ │
│  │    UI     │  │     │  │ Commands  │ │     │  │ Firmware  │ │
│  └───────────┘  │     │  └───────────┘ │     │  └───────────┘ │
│                 │     │                 │     │                 │
│  ┌───────────┐  │     │  ┌───────────┐ │     │  ┌───────────┐ │
│  │   Redux   │  │     │  │    DFU    │ │     │  │ AI Model  │ │
│  │   State   │  │     │  │  Service  │ │     │  │  (Future) │ │
│  └───────────┘  │     │  └───────────┘ │     │  └───────────┘ │
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

## Current Implementation Details

### Communication Protocol

The app uses a simple text-based command protocol:

| Command | Purpose | Example Response |
|---------|---------|------------------|
| `battery` | Get battery level | `Battery = 85%` |
| `ver` | Get firmware version | `v1.2.3` |
| `dfu` | Enter DFU mode | `Device will enter DFU mode after disconnecting.` |
| `ping` | Keep connection alive | `pong` |

### Firmware Update Process

1. **Preparation Phase**
   - User selects firmware file from device storage
   - App validates file extension (.zip)
   - Temporary copy created for Android devices

2. **Transfer Phase**
   - Device enters DFU mode
   - Nordic DFU library handles the transfer
   - Progress updates sent to UI (0-100%)

3. **Completion Phase**
   - Device automatically reboots with new firmware
   - App disconnects and removes device from list
   - User must reconnect to continue

### Technical Specifications

- **BLE Service UUID**: `6e400001-b5a3-f393-e0a9-e50e24dcca9d`
- **Write Characteristic**: `6e400002-b5a3-f393-e0a9-e50e24dcca9d`
- **Read Characteristic**: `6e400003-b5a3-f393-e0a9-e50e24dcca9d`
- **Max Transfer Speed**: Limited by 500ms write intervals
- **File Size Limit**: Constrained by device memory and transfer time

## Key Limitations for Hardware Team Consideration

### 1. Protocol Limitations

- **Text-Only Commands**: Current protocol doesn't support binary data efficiently
- **No Packet Structure**: Lacks headers, checksums, or error correction
- **Limited Feedback**: Device can't report detailed error conditions
- **No Versioning**: Protocol changes would break compatibility

### 2. Transfer Limitations

- **Single File Only**: Cannot handle multiple files in one session
- **No Chunking**: Large files must transfer in one continuous session
- **No Resume**: Interrupted transfers must restart from beginning
- **Speed Constraints**: 500ms intervals between writes limit throughput

### 3. AI Model Specific Challenges

- **File Size**: AI models likely much larger than firmware
- **Format Support**: No handling for model-specific formats
- **Validation**: No mechanism to verify model compatibility
- **Metadata**: Cannot transfer model parameters or configuration

## Recommendations for Future State

### 1. Enhanced Protocol Design

**Recommendation**: Implement a binary packet-based protocol

```
Packet Structure:
┌────────┬──────────┬─────────┬──────────┬────────┐
│ Header │ Cmd Type │ Seq Num │ Payload  │  CRC   │
│ (2B)   │   (1B)   │  (2B)   │ (0-512B) │  (2B)  │
└────────┴──────────┴─────────┴──────────┴────────┘
```

**Benefits**:
- Efficient binary transfers
- Error detection and correction
- Support for large files
- Backwards compatibility through version field

### 2. Multi-Type File Transfer System

**Recommendation**: Create unified transfer system for both firmware and AI models

```
File Types:
- Type 0x01: Firmware (.zip)
- Type 0x02: AI Model (.tflite, .model)
- Type 0x03: Configuration (.json)
- Type 0x04: Reserved for future use
```

**Features**:
- File type identification
- Pre-transfer validation
- Progress tracking per file
- Queue management for multiple files

### 3. Robust Transfer Mechanism

**Recommendation**: Implement chunked transfer with resume capability

```
Transfer Flow:
1. START_TRANSFER(file_type, file_size, chunk_size)
2. SEND_CHUNK(chunk_id, data, checksum)
3. ACK_CHUNK(chunk_id, status)
4. RESUME_TRANSFER(last_chunk_id)
5. COMPLETE_TRANSFER(file_checksum)
```

**Benefits**:
- Resume interrupted transfers
- Verify data integrity
- Optimize chunk size for device
- Progress tracking at chunk level

### 4. Device-Side Considerations

**For Hardware Team Implementation**:

1. **Memory Management**
   - Allocate separate storage for AI models
   - Implement wear leveling for flash memory
   - Consider external storage for large models

2. **Dual-Bank System**
   - Bank A: Active firmware/model
   - Bank B: Incoming firmware/model
   - Atomic swap on successful validation

3. **Validation Requirements**
   - Firmware: Version compatibility check
   - AI Model: Architecture compatibility
   - Both: Cryptographic signature verification

4. **Status Reporting**
   - Extended status commands for storage space
   - Model performance metrics
   - Update history and rollback options

## Implementation Roadmap

### Phase 1: Protocol Enhancement (2-3 weeks)
- Design and implement binary protocol
- Maintain backward compatibility
- Test with existing firmware

### Phase 2: AI Model Support (3-4 weeks)
- Add model file type support
- Implement chunked transfers
- Create validation framework

### Phase 3: Advanced Features (4-6 weeks)
- Multi-file transfer queues
- Background transfer support
- Compression and optimization

### Phase 4: Production Readiness (2-3 weeks)
- Security implementation
- Performance optimization
- Comprehensive testing

## Hardware Requirements for Future State

### Minimum Requirements
- **Flash Storage**: 32MB (8MB firmware + 24MB AI model)
- **RAM**: 512KB for transfer buffers
- **BLE**: Version 5.0+ for improved speed
- **Bootloader**: Support for dual-bank updates

### Recommended Requirements
- **Flash Storage**: 64MB or external SD card support
- **RAM**: 1MB for optimal performance
- **BLE**: Version 5.2 with LE Coded PHY
- **Security**: Secure element for key storage

## Integration Points

### Mobile App ↔ Device
1. **Command Interface**: Extended command set for AI operations
2. **Status Interface**: Detailed progress and error reporting
3. **File Interface**: Unified transfer mechanism
4. **Security Interface**: Authentication and encryption

### Device ↔ AI Model
1. **Model Loading**: Dynamic model initialization
2. **Configuration**: Runtime parameter adjustment
3. **Monitoring**: Performance metrics collection
4. **Updates**: Hot-swapping capability

## Success Criteria

### Technical Metrics
- Transfer speed: >50KB/s for AI models
- Reliability: >99% successful transfers
- Resume capability: <5 second recovery time
- Compatibility: Support 3+ model formats

### User Experience Metrics
- Update time: <5 minutes for 10MB model
- Feedback: Real-time progress updates
- Recovery: Automatic retry on failure
- Simplicity: One-tap update process

## Conclusion

The current Wildlife Watcher app provides a solid foundation for device communication and firmware updates. However, significant enhancements are needed to support AI model deployment. The recommended improvements focus on:

1. **Protocol Evolution**: From text-based to efficient binary protocol
2. **Transfer Enhancement**: From single-file to multi-file with resume
3. **Feature Addition**: From firmware-only to firmware + AI models
4. **Reliability Improvement**: From basic to robust with error recovery

These enhancements will position the Wildlife Watcher platform as a leading solution for intelligent wildlife monitoring, enabling field deployment of advanced AI capabilities while maintaining the simplicity and reliability required for conservation work.

## Next Steps

1. **Hardware Team**: Review requirements and provide feedback on feasibility
2. **Protocol Design**: Collaborate on detailed packet specifications
3. **Proof of Concept**: Build prototype for AI model transfer
4. **Testing Plan**: Define validation criteria and test scenarios
5. **Timeline Agreement**: Align on implementation schedule

The success of this enhancement depends on close collaboration between the mobile app team and hardware team to ensure seamless integration and optimal performance in field conditions.