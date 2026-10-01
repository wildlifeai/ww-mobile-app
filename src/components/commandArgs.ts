import type { CommandParam } from '../ble/types'
import { OP_PARAMETER } from '../hooks/useDeviceSettings'

/**
 * The firmware's names for the two ops the app names differently, so a name
 * copied from OP_PARAMETERS_E or config_file.md in the Seeed repo works too.
 * The indices are the firmware's; never renumber.
 */
const FIRMWARE_OP_NAMES: Record<string, number> = {
    LED_BRIGHTNESS_PERCENT: OP_PARAMETER.LED_BRIGHTNESS,
    FLASH_EVALUATE_INTERVAL: OP_PARAMETER.AE_CHECK_INTERVAL,
}

const has = (o: object, key: string) => Object.prototype.hasOwnProperty.call(o, key)

/**
 * An op index as an operator types it: a number, or an `OP_PARAMETER` name in
 * any case, with or without the firmware's `OP_PARAMETER_` prefix. So "11",
 * "MD_INTERVAL" and "op_parameter_md_interval" all give 11.
 *
 * @returns the index, or null when the text is neither.
 */
export function resolveOpIndex(text: string): number | null {
    const t = text.trim()
    if (/^-?\d+$/.test(t)) return parseInt(t, 10)
    const name = t.toUpperCase().replace(/^OP_PARAMETER_/, '')
    if (has(OP_PARAMETER, name)) return OP_PARAMETER[name as keyof typeof OP_PARAMETER]
    if (has(FIRMWARE_OP_NAMES, name)) return FIRMWARE_OP_NAMES[name]
    return null
}

/** The `OP_PARAMETER` name for an index, to show what a typed value resolved to. */
export function opName(index: number): string | undefined {
    return (Object.keys(OP_PARAMETER) as Array<keyof typeof OP_PARAMETER>)
        .find(name => OP_PARAMETER[name] === index)
}

export type CommandArgCheck = { value: string } | { error: string }

/**
 * Check one typed value against what the command needs, and turn it into what
 * goes on the wire (an op name becomes its index). Bounds on an op index are
 * left to the firmware, which knows how many it has: the app runs ahead of it
 * on op indices by design.
 */
export function checkCommandArg(param: CommandParam, text: string): CommandArgCheck {
    const t = text.trim()
    if (!t) return { error: 'Required' }

    if (param.kind === 'op') {
        const index = resolveOpIndex(t)
        if (index === null) return { error: 'Not an op index or name' }
        if (index < (param.min ?? 0)) return { error: `Index from ${param.min ?? 0}` }
        return { value: String(index) }
    }

    if (param.kind === 'int') {
        if (!/^-?\d+$/.test(t)) return { error: 'Whole number' }
        const n = parseInt(t, 10)
        const { min, max } = param
        if ((min !== undefined && n < min) || (max !== undefined && n > max)) {
            if (min !== undefined && max !== undefined) return { error: `${min} to ${max}` }
            return { error: min !== undefined ? `At least ${min}` : `At most ${max}` }
        }
        return { value: String(n) }
    }

    if (/\s/.test(t)) return { error: 'One word, no spaces' }
    return { value: t }
}
