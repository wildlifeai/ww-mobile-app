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
 * 
 * NOTE: This is NOT a React hook - useCallback should be applied at the call site.
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
    
    return async (peripheral: ExtendedPeripheral, value?: string): Promise<string> => {
        const writeOptions = timeout ? { timeout } : undefined
        const responses = await write(
            peripheral,
            [[commandName, { control, value: value ?? defaultValue }]],
            writeOptions
        )
        return responses[0] || ''
    }
}

/**
 * Shorthand for commands where we don't care about the return value.
 * 
 * NOTE: This is NOT a React hook - useCallback should be applied at the call site.
 */
export const createAction = (
    write: WriteFunction,
    commandName: CommandNames,
    options: {
        timeout?: number,
        defaultValue?: string
    } = {}
) => {
    const { timeout, defaultValue = '' } = options
    
    return async (peripheral: ExtendedPeripheral, value?: string): Promise<void> => {
        const writeOptions = timeout ? { timeout } : undefined
        await write(
            peripheral,
            [[commandName, { control: CommandControlTypes.WRITE, value: value ?? defaultValue }]],
            writeOptions
        )
    }
}
