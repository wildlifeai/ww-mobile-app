import { aiBuildTime, newestReleaseFirst } from './versionUtils'

/**
 * Start Monitoring's one Update software (#529): whether the camera's software
 * is behind, and the steps that bring it level.
 *
 * People deploying see no processors and no versions. Behind means older than
 * the catalogue: a camera an engineer flashed with a newer build reads up to
 * date, and going back is the Engineer Console's job.
 */

/**
 * One step of Update software. `ai` is the AI update as it stands: both
 * images, or the rest of an update left half done. `ai_first_image` stops
 * after image 1, so the Bluetooth update can go between the two.
 */
export type SoftwareStep = 'ai_first_image' | 'ble' | 'ai'

/** What Start Monitoring shows: nothing to judge yet, nothing to do, or an update */
export type SoftwareState = 'not_checked' | 'up_to_date' | 'available' | 'unfinished'

interface Build {
    version?: string | null
    buildDate?: string | null
}

/** The parts of a processor's status the rules read (`FirmwareComponentStatus`) */
interface ProcessorStatus {
    currentVersion: string | null
    latestVersion: string | null
    isOutdated: boolean
    missingVariant?: unknown
    unfinished?: unknown
    variants?: { RP3: Build | null; HM0360: Build | null }
}

export interface SoftwareStatuses {
    ble: ProcessorStatus
    himax: ProcessorStatus
}

const known = (version: string | null): version is string => !!version && version !== 'Unknown'

/** Bluetooth older than the catalogue's latest, by release number */
export const bleIsBehind = ({ currentVersion, latestVersion, isOutdated }: ProcessorStatus): boolean =>
    isOutdated && known(currentVersion) && known(latestVersion) && newestReleaseFirst(currentVersion, latestVersion) > 0

/**
 * AI older than the catalogue's latest builds, by build time, or an update
 * this phone left half done. A build whose time cannot be read is judged by
 * `isOutdated` alone.
 */
export const aiIsBehind = (himax: ProcessorStatus): boolean => {
    if (himax.unfinished) return true
    if (!himax.isOutdated) return false
    const current = known(himax.currentVersion) ? aiBuildTime({ version: himax.currentVersion }) : null
    const latest = [himax.variants?.RP3, himax.variants?.HM0360]
        .map(build => (build ? aiBuildTime(build) : null))
        .filter((time): time is number => time !== null)
    if (current === null || latest.length === 0) return true
    return current < Math.max(...latest)
}

/**
 * The steps, in order. With both processors behind the AI update writes image
 * 1, the Bluetooth update goes next and image 2 last: across Seeed PR #284 a
 * camera with one processor new and the other old takes no file, and this
 * order never needs one (#527, `firmwareOrder.ts`). It works the same on
 * either side of that change. A half-done AI update has its image 1 in, so
 * the Bluetooth update goes first.
 */
export const softwarePlan = ({ ble, himax }: SoftwareStatuses): SoftwareStep[] => {
    const bleBehind = bleIsBehind(ble)
    if (himax.unfinished) return bleBehind ? ['ble', 'ai'] : ['ai']
    const aiBehind = aiIsBehind(himax)
    if (aiBehind && bleBehind) return ['ai_first_image', 'ble', 'ai']
    if (aiBehind) return ['ai']
    return bleBehind ? ['ble'] : []
}

/**
 * What Start Monitoring says. An update whose files are not on the phone yet
 * reads up to date, as does one waiting for a camera's build (`missingVariant`,
 * #437): neither is something the person deploying can act on.
 */
export const softwareState = (statuses: SoftwareStatuses, filesOnPhone: boolean): SoftwareState => {
    if (!statuses.ble.latestVersion && !statuses.himax.latestVersion) return 'not_checked'
    if (softwarePlan(statuses).length === 0 || !filesOnPhone) return 'up_to_date'
    return statuses.himax.unfinished ? 'unfinished' : 'available'
}
