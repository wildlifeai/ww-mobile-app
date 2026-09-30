/**
 * OfflinePrefetchService
 *
 * Puts the files a field visit needs on the phone while it still has a
 * connection (#333): the AI model of every project on the phone, the latest
 * BLE (nRF) firmware, and the latest Himax image for each camera variant. The
 * deployment pipeline and the firmware update read the same caches they always
 * have, `AiModelService.ensureFilesDownloaded` and
 * `FirmwareService.ensureFirmwareDownloaded`, so neither needs a signal in the
 * field once this has run.
 *
 * Until this existed a model's files were fetched only during a deployment, so
 * the first deployment of a model somewhere without signal ran without it.
 *
 * Runs after a successful sync, in the background, one file at a time. It never
 * throws, never blocks its caller, does nothing offline and keeps its failures
 * to a warning: the next sync tries again. It only ever downloads; it never
 * starts a firmware update.
 */

import NetInfo from '@react-native-community/netinfo'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { Q } from '@nozbe/watermelondb'
import database from '../database'
import AiModel from '../database/models/AiModel'
import Firmware from '../database/models/Firmware'
import Project from '../database/models/Project'
import AiModelService from './AiModelService'
import FirmwareService from './FirmwareService'
import ReferenceDataService from './ReferenceDataService'
import { log, logWarn } from '../utils/logger'

/**
 * Where the Settings screen keeps its sync mode: 'auto' (the default), 'wifi'
 * ("Sync on Wi-Fi only") or 'ask'. On mobile data the pre-download runs only
 * in 'auto', since it cannot ask in the background.
 */
export const SYNC_MODE_KEY = '@settings_sync_mode'

const TAG = '[OfflineCache]'
const HIMAX_VARIANTS = ['RP3', 'HM0360'] as const

type Connection = 'ok' | 'offline' | 'metered'

interface Tally { downloaded: number; cached: number; failed: number; skipped: number }

export interface PrefetchSummary {
    connection: Connection
    models: Tally
    firmware: Tally
    removed: string[]
}

/** A firmware image the pre-download keeps on the phone. */
export interface FirmwareTarget {
    filename: string
    type: string
    variant: string | null
}

/**
 * The cached firmware files that are older versions of a target and can go.
 *
 * The firmware table keeps one active row per type and camera variant, so an
 * older image has usually lost its row by the time this runs and is known only
 * by its file name. The Himax name carries the variant (`himax_<version>_RP3_…`,
 * from the upload's storage path), so an older image is removed only once the
 * newer image of the same variant is complete. A file whose variant cannot be
 * told waits until every image of its type is complete. Files of a type with no
 * target are left alone.
 */
export function firmwareFilesToRemove(
    files: string[],
    targets: FirmwareTarget[],
    complete: Set<string>,
): string[] {
    const keep = new Set(targets.map(t => t.filename))
    const isComplete = (group: FirmwareTarget[]) => group.length > 0 && group.every(t => complete.has(t.filename))

    return files.filter(file => {
        if (keep.has(file)) return false
        const sameType = targets.filter(t => file.startsWith(`${sanitize(t.type)}_`))
        if (sameType.length === 0) return false
        const variant = HIMAX_VARIANTS.find(v => sameType.some(t => t.variant === v) && file.includes(`_${v}_`))
        const sameSlot = variant ? sameType.filter(t => t.variant === variant) : sameType
        return isComplete(sameSlot)
    })
}

/** The same sanitising `FirmwareService.getLocalFilename` applies to the type. */
function sanitize(type: string): string {
    return type.replace(/[^a-zA-Z0-9.-]/g, '_')
}

async function checkConnection(): Promise<Connection> {
    const state = await NetInfo.fetch()
    if (state.isConnected !== true || state.isInternetReachable === false) return 'offline'
    const metered = state.type === 'cellular' || (state.details as { isConnectionExpensive?: boolean } | null)?.isConnectionExpensive === true
    if (!metered) return 'ok'
    let mode: string | null = null
    try {
        mode = await AsyncStorage.getItem(SYNC_MODE_KEY)
    } catch {
        // Unreadable preference: the default applies
    }
    return (mode ?? 'auto') === 'auto' ? 'ok' : 'metered'
}

function describeFirmware(fw: Firmware): string {
    return `${fw.type}${fw.cameraVariant ? ` ${fw.cameraVariant}` : ''} firmware ${fw.version}`
}

class OfflinePrefetchService {
    private running: Promise<void> | null = null
    private pendingReason: string | null = null
    private listeners = new Set<() => void>()

    /**
     * Starts a pre-download pass in the background, or asks the one already
     * running to go round once more when it finishes. Returns at once and never
     * throws, so a caller can fire it from the end of a sync.
     */
    request(reason: string): void {
        if (this.running) {
            this.pendingReason = reason
            return
        }
        this.running = this.drain(reason)
    }

    /** Resolves when no pass is running. For tests, and for anything that has to wait. */
    whenIdle(): Promise<void> {
        return this.running ?? Promise.resolve()
    }

    /** Called after each file lands on the phone, so a screen can refresh what it shows. */
    subscribe(listener: () => void): () => void {
        this.listeners.add(listener)
        return () => { this.listeners.delete(listener) }
    }

    private notify(): void {
        for (const listener of this.listeners) {
            try {
                listener()
            } catch (e) {
                logWarn(`${TAG} A listener failed:`, e)
            }
        }
    }

    private async drain(reason: string): Promise<void> {
        let next: string | null = reason
        try {
            while (next) {
                this.pendingReason = null
                await this.runOnce(next)
                next = this.pendingReason
            }
        } finally {
            this.running = null
        }
    }

    /** One pass: models first, then firmware. Never throws. */
    async runOnce(reason: string): Promise<PrefetchSummary> {
        const summary: PrefetchSummary = {
            connection: 'offline',
            models: { downloaded: 0, cached: 0, failed: 0, skipped: 0 },
            firmware: { downloaded: 0, cached: 0, failed: 0, skipped: 0 },
            removed: [],
        }
        try {
            summary.connection = await checkConnection()
            if (summary.connection === 'offline') {
                log(`${TAG} Offline, nothing to fetch (${reason})`)
                return summary
            }
            if (summary.connection === 'metered') {
                log(`${TAG} On mobile data and Settings asks for Wi-Fi only, nothing fetched (${reason})`)
                return summary
            }

            log(`${TAG} Checking models and firmware for offline use (${reason})`)
            if (await this.prefetchModels(summary)) {
                await this.prefetchFirmware(summary)
            }

            const { models: m, firmware: f } = summary
            log(`${TAG} Done: models ${m.downloaded} downloaded, ${m.cached} already here, ${m.failed} failed, ${m.skipped} skipped; ` +
                `firmware ${f.downloaded} downloaded, ${f.cached} already here, ${f.failed} failed; ${summary.removed.length} older image(s) removed`)
        } catch (e) {
            logWarn(`${TAG} Stopped:`, e)
        }
        return summary
    }

    /**
     * The model of every active project on the phone. The local projects table
     * holds what row level security let this user sync, which is the projects
     * they have a role on or created (all of them for a WW admin). Returns false
     * when the connection went, so the firmware is left for the next sync.
     */
    private async prefetchModels(summary: PrefetchSummary): Promise<boolean> {
        const projects = await database.get<Project>('projects')
            .query(Q.where('is_active', true), Q.where('model_id', Q.notEq(null)))
            .fetch()
        const modelIds = Array.from(new Set(projects.map(p => p.modelId).filter((id): id is string => !!id)))
        if (modelIds.length === 0) return true

        const models = await database.get<AiModel>('ai_models').query(Q.where('id', Q.oneOf(modelIds))).fetch()
        const byId = new Map(models.map(m => [m.id, m]))

        for (const modelId of modelIds) {
            const model = byId.get(modelId)
            if (!model || !model.modelPath) {
                // The deployment refuses such a project on its own (#290)
                log(`${TAG} Model ${modelId.substring(0, 8)} is not in this phone's reference data, skipped`)
                summary.models.skipped++
                continue
            }
            try {
                await ReferenceDataService.getFirmwareIds(model)
            } catch {
                log(`${TAG} Model "${model.name}" has no firmware IDs to load it under, skipped`)
                summary.models.skipped++
                continue
            }
            if (await AiModelService.isDownloaded(model)) {
                summary.models.cached++
                continue
            }
            if (await checkConnection() !== 'ok') {
                log(`${TAG} Connection gone, stopping until the next sync`)
                return false
            }

            log(`${TAG} Downloading model "${model.name}" ${model.version}`)
            try {
                await AiModelService.ensureFilesDownloaded(model)
                summary.models.downloaded++
                log(`${TAG} Model "${model.name}" is on the phone`)
                this.notify()
            } catch (e) {
                summary.models.failed++
                logWarn(`${TAG} Model "${model.name}" did not download, trying again after the next sync:`, e)
            }
        }
        return true
    }

    /**
     * The latest BLE firmware and the latest Himax image of each camera variant,
     * the images the firmware update screen flashes, then the older copies of
     * each once its replacement is complete. Nothing is fetched or removed while
     * an update holds the cache.
     */
    private async prefetchFirmware(summary: PrefetchSummary): Promise<void> {
        if (FirmwareService.isCacheHeld()) {
            log(`${TAG} A firmware update is running, firmware left for the next sync`)
            return
        }

        const targets = await this.latestFirmware()
        const complete = new Set<string>()

        for (const fw of targets) {
            const filename = FirmwareService.getLocalFilename(fw)
            if (await FirmwareService.isFirmwareDownloaded(fw)) {
                complete.add(filename)
                summary.firmware.cached++
                continue
            }
            if (FirmwareService.isCacheHeld()) {
                log(`${TAG} A firmware update started, stopping until the next sync`)
                return
            }
            if (await checkConnection() !== 'ok') {
                log(`${TAG} Connection gone, stopping until the next sync`)
                return
            }

            log(`${TAG} Downloading ${describeFirmware(fw)}`)
            try {
                await FirmwareService.ensureFirmwareDownloaded(fw)
                complete.add(filename)
                summary.firmware.downloaded++
                log(`${TAG} ${describeFirmware(fw)} is on the phone`)
                this.notify()
            } catch (e) {
                summary.firmware.failed++
                logWarn(`${TAG} ${describeFirmware(fw)} did not download, trying again after the next sync:`, e)
            }
        }

        const files = await FirmwareService.listCachedFiles()
        const removable = firmwareFilesToRemove(
            files,
            targets.map(fw => ({ filename: FirmwareService.getLocalFilename(fw), type: fw.type, variant: fw.cameraVariant ?? null })),
            complete,
        )
        for (const file of removable) {
            if (await FirmwareService.deleteCachedFile(file)) {
                summary.removed.push(file)
                log(`${TAG} Removed older firmware ${file}`)
            }
        }
    }

    /**
     * What `useFirmwareUpdate` would flash: the latest BLE image, and the
     * latest Himax image per camera variant. A Himax image with no variant is
     * kept only when it is the newest of all, which is when a database from
     * before the variants makes the update use it.
     */
    private async latestFirmware(): Promise<Firmware[]> {
        const [ble, himax, ...variants] = await Promise.all([
            ReferenceDataService.getLatestFirmware('ble'),
            ReferenceDataService.getLatestFirmware('himax'),
            ...HIMAX_VARIANTS.map(v => ReferenceDataService.getLatestHimaxByVariant(v)),
        ])
        const legacyHimax = himax && !himax.cameraVariant ? himax : null
        const seen = new Set<string>()
        return [ble, ...variants, legacyHimax].filter((fw): fw is Firmware => {
            if (!fw || !fw.locationPath || seen.has(fw.id)) return false
            seen.add(fw.id)
            return true
        })
    }
}

export default new OfflinePrefetchService()
