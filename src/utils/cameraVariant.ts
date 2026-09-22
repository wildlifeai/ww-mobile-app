/**
 * The camera variant a firmware slot holds, and how to read one off the device.
 *
 * These were private to `useCameraSwitch` until #321 needed them somewhere a
 * React hook cannot go: a pure check that a project's flash LED suits the
 * camera that is actually running. The hook re-exports all three, so every
 * existing import site is unchanged.
 */

/**
 * Camera variants held in the device's two firmware slots.
 * - RP3:    Raspberry Pi Camera Module 3 (IMX708) - colour, daylight
 * - HM0360: Himax HM0360 - mono, sees IR, used in the dark with the IR flash
 */
export type CameraVariant = 'RP3' | 'HM0360' | 'unknown'

/**
 * What each camera is called in the UI, named by the picture it produces rather
 * than by its part number: an operator picking a camera is choosing between a
 * colour image and a black and white one.
 *
 * Centralised because four screens had written their own version of this and all
 * four disagreed ("Colour" / "Colour (day)" / "RP3 · day" / "Colour (RP3)").
 * Screens that are genuinely choosing a *firmware image* rather than a picture,
 * such as the firmware updater, legitimately want the part number and should say
 * so explicitly rather than reusing these.
 */
export const CAMERA_VARIANT_LABELS: Record<Exclude<CameraVariant, 'unknown'>, string> = {
    RP3: 'Colour',
    HM0360: 'Black & White',
}

/** Map a firmware variant description (e.g. "RP3 (day/colour)") to a CameraVariant */
export const parseVariant = (s: string | undefined): CameraVariant => {
    if (!s) return 'unknown'
    if (/RP3/i.test(s)) return 'RP3'
    if (/HM0360/i.test(s)) return 'HM0360'
    return 'unknown'
}
