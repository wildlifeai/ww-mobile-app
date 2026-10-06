/**
 * photoStats: is a photo a real picture, not a dead or covered sensor?
 *
 * The app does not decode JPEGs (no decoder is shipped), so the check uses
 * what the camera reports: the file's size, and for the HM0360 the mean
 * brightness its own auto exposure measured for the frame (`AE Mean` in the
 * register block it sends after every capture). The limits are the ones
 * `_Tools/ww500_ship_check.py` in the firmware repo uses on the PCB line: a
 * JPEG of at least 3000 bytes, and a mean between 8 and 248 (not all black,
 * not all white). The operator also sees both photos, which is where the
 * framing is judged.
 */

export const MIN_JPEG_BYTES = 3000
export const MEAN_RANGE: [number, number] = [8, 248]

/** Null when the photo passes; otherwise what is wrong with it, for the operator. */
export const photoProblem = (bytes: number, aeMean?: number | null): string | null => {
    if (bytes < MIN_JPEG_BYTES) return `The photo is only ${bytes} bytes: the camera sent almost nothing.`
    if (aeMean !== undefined && aeMean !== null) {
        if (aeMean < MEAN_RANGE[0]) return 'The photo is black. Is the lens covered?'
        if (aeMean > MEAN_RANGE[1]) return 'The photo is white. Is the light too strong, or the sensor saturated?'
    }
    return null
}
