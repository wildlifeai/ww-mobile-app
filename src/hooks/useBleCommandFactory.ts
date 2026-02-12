import { useCallback } from 'react'
import { CommandNames, CommandControlTypes } from '../ble/types'
import { ExtendedPeripheral } from '../redux/slices/devicesSlice'

export type WriteFunction = (
    peripheral: ExtendedPeripheral,
    data: (string | [CommandNames, any])[],
    options?: any
) => Promise<string[]>

/**
 * Factory for simple commands that return their first response string.
 * Default control is READ.
 */
export const createCommand = (
    write: WriteFunction,
    commandName: CommandNames,
    options: {
        control?: CommandControlTypes,
        timeout?: number,
        defaultValue?: string
    } = {}
) => {
    const { control = CommandControlTypes.READ, timeout, defaultValue = '' } = options
    
    // eslint-disable-next-line react-hooks/rules-of-hooks
    return useCallback(async (peripheral: ExtendedPeripheral, value?: string): Promise<string> => {
        const writeOptions = timeout ? { timeout } : undefined
        const responses = await write(
            peripheral,
            [[commandName, { control, value: value ?? defaultValue }]],
            writeOptions
        )
        return responses[0] || ''
    }, [write, commandName, control, timeout, defaultValue])
}

/**
 * Shorthand for commands where we don't care about the return value.
 */
export const createAction = (
    write: WriteFunction,
    commandName: CommandNames,
    options: {
        timeout?: number,
        defaultValue?: string
    } = {}
) => {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    return useCallback(async (peripheral: ExtendedPeripheral, value?: string): Promise<void> => {
        const { timeout, defaultValue = '' } = options
        const writeOptions = timeout ? { timeout } : undefined
        await write(
            peripheral,
            [[commandName, { control: CommandControlTypes.WRITE, value: value ?? defaultValue }]],
            writeOptions
        )
    }, [write, commandName, options])
}
