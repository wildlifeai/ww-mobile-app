/**
 * tfliteModel: whether a file is a TFLite model the camera can load (#428).
 *
 * A TFLite model is a FlatBuffer whose file identifier, bytes 4 to 7, reads
 * `TFL3`. Vela's output for the Himax keeps it. The Himax copies whatever
 * `loadmodel` names to flash before it looks inside, and a file it cannot
 * parse halts it (Seeed #241): it answers commands but never captures or
 * sleeps again until it is restarted. On the bench on 8 October 2026 the dev
 * backend's model file was a ZIP archive, and the deployment started on a
 * camera that recorded nothing.
 */

/** The FlatBuffer file identifier of a TFLite model, `TFL3`, at bytes 4 to 7. */
const TFLITE_IDENTIFIER = [0x54, 0x46, 0x4c, 0x33]
const TFLITE_IDENTIFIER_OFFSET = 4

/** A ZIP archive's local file header, `PK\x03\x04`: the wrong file seen so far. */
const ZIP_SIGNATURE = [0x50, 0x4b, 0x03, 0x04]

const hasBytesAt = (bytes: Uint8Array, expected: number[], offset: number): boolean =>
    bytes.length >= offset + expected.length && expected.every((b, i) => bytes[offset + i] === b)

/** True when `bytes`, a whole file or at least its first 8 bytes, are a TFLite model. */
export const isTfliteModel = (bytes: Uint8Array): boolean =>
    hasBytesAt(bytes, TFLITE_IDENTIFIER, TFLITE_IDENTIFIER_OFFSET)

/**
 * What the file is, worded to follow "the file": a ZIP archive by name,
 * anything else unrecognised by its first bytes in hex, so the person
 * replacing it can see what was stored.
 */
export const describeModelFile = (bytes: Uint8Array): string => {
    if (isTfliteModel(bytes)) return 'is a TFLite model'
    if (hasBytesAt(bytes, ZIP_SIGNATURE, 0)) return 'is a ZIP archive'
    if (bytes.length === 0) return 'is empty'
    const head = Array.from(bytes.subarray(0, 8), b => b.toString(16).toUpperCase().padStart(2, '0'))
    return `starts ${head.join(' ')}`
}
