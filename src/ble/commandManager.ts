/**
 * DANGEROUS - QUARANTINE FILE
 * 
 * BleCommandManager is DEPRECATED and has been fully excised during Phase C.
 * 
 * If you have reached this file, it means you are trying to use legacy queues
 * instead of the new RxRouter or BleSession architectures.
 * 
 * This file is kept as a fatal trap for one release cycle.
 * Do not attempt to bypass this.
 * 
 * - For deterministic workflows: use `createBleSession(device).execute()`
 * - For passive streams: use `bleEventBus.on('TEXT_LINE')`
 * - For arbitrary console terminal: use `writeRaw(device, chars)`
 */

class TrapCommandManager {
    public addMessageListener() {
        this.die();
    }

    public removeMessageListener() {
        this.die();
    }

    public sendCommand() {
        this.die();
    }

    public waitForMessage() {
        this.die();
    }

    public handleIncomingMessage() {
        this.die();
    }

    public clear() {
        this.die();
    }

    private die() {
        throw new Error(
            "CRITICAL: commandManager is deprecated. Use raw transport or bleSession."
        );
    }
}

export const bleCommandManager = new TrapCommandManager();
