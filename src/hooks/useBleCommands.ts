import { useCallback } from "react"
import { useBle } from "./useBle"
import { CommandControlTypes, CommandNames } from "../ble/types"
import { ExtendedPeripheral } from "../redux/slices/devicesSlice"

export const useBleCommands = () => {
    const { write } = useBle()

    const getBatteryLevel = useCallback(async (peripheral: ExtendedPeripheral) => {
        await write(peripheral, [
            [CommandNames.BATTERY, { control: CommandControlTypes.READ }]
        ])
    }, [write])

    const checkSdCard = useCallback(async (peripheral: ExtendedPeripheral) => {
        await write(peripheral, [
            [CommandNames.AI_INFO, { control: CommandControlTypes.READ }]
        ])
    }, [write])

    const captureTestImage = useCallback(async (peripheral: ExtendedPeripheral) => {
        await write(peripheral, [
            [CommandNames.AI_CAPTURE, { control: CommandControlTypes.WRITE, value: "1 0" }]
        ])
    }, [write])

    const pingNetwork = useCallback(async (peripheral: ExtendedPeripheral) => {
        await write(peripheral, [
            [CommandNames.PING, { control: CommandControlTypes.WRITE }]
        ])
    }, [write])

    const runSelfTest = useCallback(async (peripheral: ExtendedPeripheral) => {
        await write(peripheral, [
            [CommandNames.SELFTEST, { control: CommandControlTypes.WRITE }]
        ])
    }, [write])

    const flashLed = useCallback(async (peripheral: ExtendedPeripheral, color: 'red' | 'green' | 'blue', durationMs: number = 100, count: number = 5) => {
        const value = `${durationMs} ${count}`
        let commandName = CommandNames.FLASH_R

        switch (color) {
            case 'green':
                commandName = CommandNames.FLASH_G
                break
            case 'blue':
                commandName = CommandNames.FLASH_B
                break
        }

        await write(peripheral, [
            [commandName, { control: CommandControlTypes.WRITE, value }]
        ])
    }, [write])

    return {
        getBatteryLevel,
        checkSdCard,
        captureTestImage,
        pingNetwork,
        runSelfTest,
        flashLed
    }
}
