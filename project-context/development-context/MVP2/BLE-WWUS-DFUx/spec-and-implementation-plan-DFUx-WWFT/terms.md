# What is UART

● UART stands for Universal Asynchronous Receiver-Transmitter.

  What is UART?

  UART is a hardware communication protocol used for serial communication between devices. It's one of the most common methods for devices to send data to each other.

  Key Characteristics

  Asynchronous Communication

  - No shared clock signal between devices
  - Each device uses its own internal clock
  - Data timing is coordinated through agreed-upon baud rates

  Serial Data Transfer

  - Sends data one bit at a time over a single wire
  - Much simpler than parallel communication (which sends multiple bits simultaneously)

  Point-to-Point

  - Direct communication between two devices
  - One transmitter (TX) talks to one receiver (RX)

  How UART Works

  Device A                    Device B
  
    TX ────────────────────────→ RX
    RX ←──────────────────────── TX

  Data flows in both directions (full duplex)

  Data Frame Structure

  [Start Bit][Data Bits (5-9)][Parity Bit (optional)][Stop Bit(s)]
      0      01101010        1                1

  UART vs Other Protocols

  | Protocol | Clock           | Wires       | Speed       | Complexity |
  |----------|-----------------|-------------|-------------|------------|
  | UART     | No shared clock | 2 (TX/RX)   | Moderate    | Simple     |
  | SPI      | Shared clock    | 4+          | Fast        | Medium     |
  | I2C      | Shared clock    | 2 (SDA/SCL) | Slow-Medium | Medium     |

  In the Wildlife Watcher Context

  Why "UART Service"?

  In the Wildlife Watcher documentation, we use "WWUS (Wildlife Watcher UART Service)" because:

  1. Nordic UART Service: The Bluetooth service UUID 6e400001-b5a3-f393-e0a9-e50e24dcca9d is Nordic Semiconductor's standard UART-over-BLE service
  2. Serial-like Communication: Even though it's over Bluetooth, it behaves like UART:
    - Text-based commands sent one at a time
    - Asynchronous request/response pattern
    - Serial data stream over wireless
  3. Distinguishes from BLE: Calling it "WWUS" instead of just "BLE" clarifies that it's a specific service running on top of the broader BLE protocol

  UART in Hardware Context

  Mobile App → BLE → WWUS → nRF52832 → UART-like → AI Processor
                                      (over I2C)

  The Wildlife Watcher device essentially extends UART communication:
  - Mobile app sends UART-style commands via Bluetooth
  - nRF52832 receives them and forwards via I2C to AI processor
  - Response comes back the same way

  Common UART Applications

  - Debugging: Serial console output from microcontrollers
  - GPS Modules: Sending location data to main processor
  - Bluetooth Modules: AT command interface
  - Arduino: Serial communication between boards
  - Embedded Systems: Communication between processors

  UART Parameters

  - Baud Rate: Speed (9600, 115200, etc. bits per second)
  - Data Bits: Usually 8 bits per character
  - Parity: Error checking (none, even, odd)
  - Stop Bits: End-of-frame marker (1 or 2 bits)
  - Flow Control: Optional (RTS/CTS, XON/XOFF)

  Why UART is Popular

  ✅ Simple: Easy to implement and understand✅ Reliable: Well-established protocol✅ Universal: Supported by virtually all microcontrollers✅ Flexible: Works over various physical
  layers (RS-232, TTL, Bluetooth)✅ Bidirectional: Full duplex communication

  So when we say "Wildlife Watcher UART Service (WWUS)", we're describing a Bluetooth service that provides UART-like serial communication between the mobile app and the device,
  following Nordic's standard approach for wireless serial communication.
