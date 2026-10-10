import Firmware from '../database/models/Firmware'
import ReferenceDataService from './ReferenceDataService'
import { himaxUpdateRecord } from './himaxUpdateRecord'
import { classifyHimax, HimaxVariant, SlotsReply } from '../utils/himaxFirmwareState'

/**
 * Whether a camera's AI firmware is current, one judgement for every screen
 * that asks (#464): Firmware Status, and the checks Start Monitoring runs on
 * connect. Before it was shared, the connect check compared the camera with
 * the newest build of either camera and warned of newer AI firmware whenever
 * the other camera's build was newer.
 */

/** Each camera's latest active AI build, and the latest of either (the fallback for a catalogue without camera labels) */
export interface LatestHimaxBuilds {
    RP3: Firmware | null
    HM0360: Firmware | null
    any: Firmware | null
}

export const latestHimaxBuilds = async (): Promise<LatestHimaxBuilds> => ({
    RP3: await ReferenceDataService.getLatestHimaxByVariant('RP3'),
    HM0360: await ReferenceDataService.getLatestHimaxByVariant('HM0360'),
    any: await ReferenceDataService.getLatestFirmware('himax'),
})

/**
 * The camera's `AI ver` reply as it is compared with the catalogue: a release
 * number when the reply carries one ("AI ver: 1.0.0" reads v1.0.0), otherwise
 * the reply itself, which is the build stamp the catalogue holds.
 */
export const himaxVersionOf = (raw: string): string => {
    const match = raw.match(/(?:V|v)?(\d+\.\d+\.\d+)/)
    return match ? `v${match[1]}` : raw
}

export interface HimaxStatus {
    isOutdated: boolean
    /** The camera whose build the catalogue lacks (#437) */
    missingVariant: HimaxVariant | null
    /** An update this phone ran stopped part way (#374). Counts as outdated */
    unfinished: { endVariant: HimaxVariant; done: number; total: number } | null
}

/**
 * The AI processor's status: `classifyHimax` on what the camera said, weighed
 * against this phone's record of an update it left unfinished, which is
 * dropped once the camera shows it finished or never reached. `slots` is null
 * when the caller sends no command for it (#268), and on firmware without it;
 * the camera's version then counts as current when it is either camera's latest.
 */
export const himaxStatus = async (
    deviceId: string,
    current: string | null,
    slots: SlotsReply | null,
    latest: LatestHimaxBuilds,
): Promise<HimaxStatus> => {
    const record = await himaxUpdateRecord.load(deviceId)
    const result = classifyHimax({ current, slots, record, latest })
    if (result.recordStatus === 'finished' || result.recordStatus === 'stale') await himaxUpdateRecord.clear(deviceId)
    return {
        isOutdated: result.state === 'outdated' || result.state === 'unfinished',
        missingVariant: result.state === 'missing_variant' ? result.missingVariant : null,
        unfinished: result.state === 'unfinished'
            ? { endVariant: result.endVariant, done: result.done, total: result.total }
            : null,
    }
}
