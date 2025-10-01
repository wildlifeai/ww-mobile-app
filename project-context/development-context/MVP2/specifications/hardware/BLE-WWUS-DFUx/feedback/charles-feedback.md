### Email

from: Charles Palmer 31/07/2025 10:11 
to: me, Tobyn
subject: "BLE and DFU" documents

Regarding the 3 "BLE and DFU" documents - I am guessing these are Claude's doing, mainly?

I am not sure they are super clear or helpful. Not urgent until we need to consider this, but I would say:

1    The terminology is confusing to me. The docs seem to use "BLE" to mean the normal app-device comms and "DFU" to mean the device firmware update (of the BLE processor). Rather than "BLE" I would use something like "NUS" (Nordic UART Service) or better "WWUS" (Wildlife Watcher UART Service) for the "normal" comms. To me "BLE" is the higher-level set of protocols that implement either DFU or WWUS.

1b    The docs don't recognise that there are 2 processors on the WW500 and that most extended functionality is performed in the AI processor.

1c    The docs mix descriptions of the DFU operations and WWUS operations. In my mind they are completely orthogonal and should be the subject of separate docs. The docs include service and characteristic UUIDs - not recognising that there are different sets for DFU and NUS (and we should make our own for WWUS).

2    DFU is implemented on the nRF52832 (the processor in the "BLE processor" module - the MKL62BA) in the bootloader. The main app can enter the bootloader, and hence DFU mode, programmatically. When the firmware update is complete the processor does a reset, execute first the bootloader, then jumps to the new app firmware. I have a good deal of control over how the DFU behaves as much of the code is available as source (some is hidden by Nordic in their "SoftDevice" library). I can provide more on the detailed implementation of the DFU protocol when required.

3    So there is a reasonable chance that the DFU protocol could be enhanced ("DFUX") to transfer data other than the nRF52832 firmware image. But that would require corresponding changes in the phone app's DFU library. Possible enhancements to the DFU protocol include:

(a) file download (to the AI processor which has the SD card interface) - particularly of configuration files but it should be general-purpose.

(b) file upload (from the AI processor) - particularly of JPEG files but it should be general-purpose.


(c) transfer of NN models to the AI processor  (though this might be a special case of file download)


(d) transfer of a new firmware image - i.e. DFU - to the AI processor  (though this might be a special case of file download)

4    Extending the DFU protocol would involve 3 parts:

(a) Extensions of the the phone app's DFU library. 

(b) Extensions of the nRF52832 DFU code - involving recognising different payload types and redirecting these to the AI processor.

(c) Establishing a comms protocol between the BLE processor and the AI processor. This is performed over the I2C bus that connects the two chips. At present (almost) only text messages are exchanged, and these are pretty much the same payload as is sent and received in the NUS packets. This could probably be done without breaking the existing message protocol.

5    Tobyn will be looking at the existing protocol that appears to allow the AI processor to stream live video through its serial port, and to receive NN models through the serial port. It might be that this protocol could be extended so that data transfer is through the I2C bus to the BLE processor instead of the serial port.

Enough already!

Regard - Charels

------

### Analysis of Above Feedback

Yes, I have access to the three documents Charles is referring to in his email. These are:

1. **BLE-DFU-Dependencies-and-Relationships_CC.md** - A detailed analysis of the dependencies and relationships between BLE and DFU components
2. **BLE-DFU-High-Level-Report_CC.md** - A high-level report for the hardware team about the current BLE and DFU implementation
3. **BLE-DFU-Technical-Analysis_CC.md** - A comprehensive technical analysis of the BLE management system and Nordic DFU implementation

Based on Charles's email, these documents appear to have been created by Claude (hence the "_CC" suffix) and contain analysis of the mobile app's Bluetooth communication and firmware update capabilities. Charles has provided feedback pointing out several issues with terminology and understanding of the Wildlife Watcher hardware architecture, particularly:

- The confusion between "BLE" (used to mean normal communications) vs "DFU" (firmware updates)
- Not recognizing there are two processors (BLE processor and AI processor)
- Mixing descriptions of DFU and normal communication operations
- Not understanding the different UUIDs for different services

His feedback suggests these documents need revision to better reflect the actual hardware architecture and communication protocols of the Wildlife Watcher device.