/**
 * A motion sensitivity's word on screen. The `activity_sensitivity` reference
 * rows hold lowercase values ("low", "medium", "high"), which the screens showed
 * as stored (#575). Only the display changes: compare and store the value itself.
 */
export const motionSensitivityLabel = (value: string | null | undefined): string =>
    value ? value.charAt(0).toUpperCase() + value.slice(1) : ''
