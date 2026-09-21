/**
 * Does the project's flash LED suit the camera that is actually running?
 *
 * The two are chosen in different places and never compared. The flash comes
 * from the `projects` row (#282); the camera is whichever of the two firmware
 * images is in the active slot. Since #304 the device no longer switches slots
 * on the light verdict, so a deployment keeps the camera it started on for its
 * whole life, and a mismatch chosen at deployment time lasts the deployment.
 *
 * The physics, and why one case is worse than the other:
 *
 * - **IR flash, RP3 colour camera.** The RP3 has an IR-cut filter. The LED
 *   fires, the sensor cannot see it, the night frames are black and the battery
 *   drains for nothing. This is the one that silently ruins a deployment.
 * - **White flash, HM0360 mono camera.** The mono sensor does see white light,
 *   so the capture works. It is wasteful rather than broken: a white LED at
 *   night startles wildlife, and the colour camera that white light was for
 *   sat unused in the other slot.
 *
 * This module only reports. It never switches the slot: #304 deliberately
 * stopped the app moving the camera on its own, and a switch costs a reboot at
 * the next sleep. The operator decides.
 *
 * Raised by Charles Palmer, 9 September 2026 (#321).
 */

import { CameraVariant } from './cameraVariant'
import { ProjectFlashColumns, resolveProjectFlash } from './projectFlash'

export type FlashCameraVerdict =
    /** The flash suits the camera, or there is no flash to suit it. */
    | { kind: 'ok' }
    /** Not enough information: the camera could not be read, or the slot is unlabelled. */
    | { kind: 'unknown' }
    /** The flash and the camera disagree. `severity` says how much. */
    | { kind: 'mismatch'; severity: 'broken' | 'wasteful'; message: string }

/**
 * Compare a project's flash against the running camera.
 *
 * `camera` is the variant in the **active** slot, as `AI slots` reports it.
 * Pass `'unknown'` when it could not be read; the verdict is then `unknown` and
 * the caller should say so rather than claim agreement.
 */
export const checkFlashAgainstCamera = (
    project: ProjectFlashColumns | null | undefined,
    camera: CameraVariant,
): FlashCameraVerdict => {
    const { mode, led } = resolveProjectFlash(project)

    // No flash means nothing to match. The camera choice is still the
    // operator's, but it is not this check's business.
    if (mode === 'off') return { kind: 'ok' }

    if (camera === 'unknown') return { kind: 'unknown' }

    if (led === 'ir' && camera === 'RP3') {
        return {
            kind: 'mismatch',
            severity: 'broken',
            message:
                'This project uses the IR flash, but the colour camera is active. ' +
                'The colour camera has an IR-cut filter and cannot see IR light, so night ' +
                'captures will be black. Switch to the black & white camera on the device ' +
                'screen, or change the project to the white flash.',
        }
    }

    if (led === 'white' && camera === 'HM0360') {
        return {
            kind: 'mismatch',
            severity: 'wasteful',
            message:
                'This project uses the white flash, but the black & white camera is active. ' +
                'Captures will work, though a white flash is what the colour camera is for, ' +
                'and it is more likely to disturb wildlife.',
        }
    }

    return { kind: 'ok' }
}
