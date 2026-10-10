import * as FileSystem from 'expo-file-system/legacy'
import database from '../database'
import Deployment from '../database/models/Deployment'
import Project from '../database/models/Project'
import { prepareDeploymentUpdate } from './DeploymentService'
import { mayChangeDeployment } from './deploymentAccess'
import { isGoneFromServer } from './goneFromServer'
import SupabaseSyncService from './SupabaseSyncService'
import { getSupabaseClient } from './supabase'
import { log, logError, logWarn } from '../utils/logger'

const PHOTOS_DIR = FileSystem.documentDirectory + 'deployment-photos/'
const BUCKET = 'deployment-photos'
const SIGNED_URL_TTL_SECONDS = 60 * 60 // 1 hour

const isLocalPath = (path: string) => path.startsWith('file://')

const readPaths = (raw: unknown): string[] =>
    typeof raw === 'string' ? JSON.parse(raw) : ((raw as string[] | undefined) || [])

/**
 * The upload pass running for each deployment. Start Monitoring starts one
 * and the sync the new deployment triggers starts another; side by side, the
 * second found the file the first had just uploaded and deleted, dropped it,
 * and wrote its path list over the first's, so the photo sat in the bucket
 * with nothing pointing at it (#347). A second call now waits for the first.
 */
const uploadsInFlight = new Map<string, Promise<void>>()

/**
 * Decode base64 to a Uint8Array without external dependencies
 * (Hermes does not reliably expose atob/Buffer).
 */
function base64ToBytes(base64: string): Uint8Array {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
    const clean = base64.replace(/[=]+$/, '')
    const bytes = new Uint8Array(Math.floor((clean.length * 3) / 4))
    let buffer = 0
    let bits = 0
    let index = 0
    for (let i = 0; i < clean.length; i++) {
        const value = alphabet.indexOf(clean[i])
        if (value === -1) continue
        buffer = (buffer << 6) | value
        bits += 6
        if (bits >= 8) {
            bits -= 8
            bytes[index++] = (buffer >> bits) & 0xff
        }
    }
    return bytes
}

/**
 * One upload pass for a deployment, run through `uploadPendingPhotos`. The
 * path list is written back merged with the record as it is at write time:
 * only the paths this pass uploaded are swapped, and only the ones it found
 * missing are dropped, so a change made meanwhile is kept.
 */
async function uploadPass(deploymentId: string, userId: string): Promise<void> {
    const deploymentsCollection = database.get<Deployment>('deployments')
    let deployment: Deployment
    try {
        deployment = await deploymentsCollection.find(deploymentId)
    } catch {
        logWarn('[DeploymentPhotoService] Deployment not found:', deploymentId)
        return
    }

    const paths = readPaths(deployment.cameraLocationImagePaths)
    if (!paths.some(isLocalPath)) return

    // Only an account whose path update the server will take uploads (#467).
    // Storage lets any member upload, but the record may be changed only by
    // its creator while a member, a project admin or a ww_admin: anyone else's
    // upload would land, delete the local file, and then have the path update
    // refused, leaving the photo in storage with no record pointing at it.
    // The photos stay on the phone for an account that may, such as their
    // creator signing in again on this phone.
    if (!(await mayChangeDeployment(userId, deployment))) {
        log(`[DeploymentPhotoService] Not uploading the photos of ${deploymentId}: this account may not change the deployment`)
        return
    }

    const supabase = getSupabaseClient()
    const uploaded = new Map<string, string>() // local path -> storage path
    const missing = new Set<string>()

    for (const path of paths) {
        if (!isLocalPath(path)) continue

        const filename = path.split('/').pop() || `${Date.now()}.jpg`
        const folder = `${deployment.projectId}/${deployment.id}`
        const storagePath = `${folder}/${filename}`

        try {
            const fileInfo = await FileSystem.getInfoAsync(path)
            if (!fileInfo.exists) {
                // The file goes only once its upload has succeeded, so a local
                // path whose file is gone is usually a photo already in the
                // bucket whose path came back with an older copy of the record
                // (a sync pull, #347). Only a photo the bucket does not have is
                // dropped; when the bucket cannot be asked, the path stays.
                const { data, error } = await supabase.storage.from(BUCKET).list(folder, { search: filename })
                if (error) throw error
                if ((data ?? []).some(entry => entry.name === filename)) {
                    log('[DeploymentPhotoService] Local photo already uploaded:', storagePath)
                    uploaded.set(path, storagePath)
                } else {
                    logWarn('[DeploymentPhotoService] Local photo missing, dropping:', path)
                    missing.add(path)
                }
                continue
            }

            const base64 = await FileSystem.readAsStringAsync(path, {
                encoding: FileSystem.EncodingType.Base64,
            })
            const contentType = filename.endsWith('.png') ? 'image/png' : 'image/jpeg'

            const { error } = await supabase.storage
                .from(BUCKET)
                .upload(storagePath, base64ToBytes(base64).buffer as ArrayBuffer, {
                    contentType,
                    upsert: true,
                })

            if (error) throw error

            log('[DeploymentPhotoService] Uploaded photo:', storagePath)
            uploaded.set(path, storagePath)
            await DeploymentPhotoService.removeLocalPhoto(path)
        } catch (e) {
            logError('[DeploymentPhotoService] Upload failed, will retry later:', e)
            // the local path stays on the record for the next attempt
        }
    }

    if (uploaded.size === 0 && missing.size === 0) return

    await database.write(async () => {
        const fresh = await deploymentsCollection.find(deploymentId)
        const updatedPaths = readPaths(fresh.cameraLocationImagePaths)
            .filter(path => !missing.has(path))
            .map(path => uploaded.get(path) ?? path)
        // Only the path list goes up, so a location edited on the website stays (#411)
        const [updateOp, outboxOp] = prepareDeploymentUpdate(fresh, userId, (record) => {
            record.cameraLocationImagePaths = updatedPaths
            record.modifiedBy = userId
        })
        await database.batch(updateOp, outboxOp)
    })

    SupabaseSyncService.debouncedSync()
}

/**
 * Handles phone photos of camera deployments:
 * - persists picked images into app storage so they survive the picker cache
 * - uploads pending local photos to the deployment-photos bucket
 *   ({project_id}/{deployment_id}/{filename}) once online
 * - swaps local paths for storage paths on the deployment record
 * - resolves display URLs (local file or signed storage URL)
 */
export const DeploymentPhotoService = {
    /**
     * Copy a freshly picked/captured image out of the picker cache into
     * app document storage. Returns the persistent local path.
     */
    persistLocalPhoto: async (sourceUri: string): Promise<string> => {
        const dirInfo = await FileSystem.getInfoAsync(PHOTOS_DIR)
        if (!dirInfo.exists) {
            await FileSystem.makeDirectoryAsync(PHOTOS_DIR, { intermediates: true })
        }

        const cleanUri = sourceUri.split('?')[0]
        const extension = (cleanUri.includes('.') && cleanUri.split('.').pop()?.toLowerCase()) || 'jpg'
        const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${extension}`
        const destination = PHOTOS_DIR + filename

        await FileSystem.copyAsync({ from: sourceUri, to: destination })
        log('[DeploymentPhotoService] Persisted photo:', destination)
        return destination
    },

    /**
     * Delete a locally persisted photo (e.g. user removed it before deploying).
     */
    removeLocalPhoto: async (path: string): Promise<void> => {
        if (!isLocalPath(path)) return
        try {
            await FileSystem.deleteAsync(path, { idempotent: true })
        } catch (e) {
            logWarn('[DeploymentPhotoService] Failed to delete local photo:', e)
        }
    },

    /**
     * Upload all still-local photos of a deployment to Supabase storage and
     * replace the local paths on the record with storage paths.
     * Safe to call repeatedly; already-uploaded photos are skipped and
     * failures leave the local path in place for the next attempt. Calls for
     * the same deployment run one after the other.
     */
    uploadPendingPhotos: (deploymentId: string, userId: string): Promise<void> => {
        const previous = uploadsInFlight.get(deploymentId) ?? Promise.resolve()
        const pass = previous.catch(() => undefined).then(() => uploadPass(deploymentId, userId))
        uploadsInFlight.set(deploymentId, pass)
        const forget = () => {
            if (uploadsInFlight.get(deploymentId) === pass) uploadsInFlight.delete(deploymentId)
        }
        pass.then(forget, forget)
        return pass
    },

    /**
     * Try to upload pending photos for every deployment that still has
     * local paths. Called opportunistically (e.g. after a sync).
     */
    uploadAllPending: async (userId: string): Promise<void> => {
        const deploymentsCollection = database.get<Deployment>('deployments')
        const deployments = await deploymentsCollection.query().fetch()
        // A deployment whose project is no longer on the phone was kept by the
        // project reconcile for its unsynced work (#330); its photos can only be
        // refused, on every sync, so they stay on the phone with it
        const projectIds = new Set((await database.get<Project>('projects').query().fetch()).map(p => p.id))
        for (const deployment of deployments) {
            if (!projectIds.has(deployment.projectId)) continue
            // Nor one the server itself no longer has for this account (#411)
            if (isGoneFromServer(deployment)) continue
            const rawPaths = deployment.cameraLocationImagePaths
            const paths: string[] = typeof rawPaths === 'string' ? JSON.parse(rawPaths) : (rawPaths || [])
            if (paths.some(isLocalPath)) {
                await DeploymentPhotoService.uploadPendingPhotos(deployment.id, userId)
            }
        }
    },

    /**
     * Resolve a stored photo path to something an <Image> can display:
     * local file URIs pass through, storage paths become signed URLs.
     * Returns null when the photo cannot be resolved (e.g. offline).
     */
    getDisplayUrl: async (path: string): Promise<string | null> => {
        if (isLocalPath(path)) return path
        try {
            const supabase = getSupabaseClient()
            const { data, error } = await supabase.storage
                .from(BUCKET)
                .createSignedUrl(path, SIGNED_URL_TTL_SECONDS)
            if (error || !data?.signedUrl) {
                logWarn('[DeploymentPhotoService] Could not sign URL for', path, error?.message)
                return null
            }
            return data.signedUrl
        } catch (e) {
            logWarn('[DeploymentPhotoService] Failed to resolve photo URL:', e)
            return null
        }
    },

    /**
     * Resolve all photo paths of a deployment to displayable URLs.
     */
    getDisplayUrls: async (deployment: Deployment): Promise<string[]> => {
        const rawPaths = deployment.cameraLocationImagePaths
        const paths: string[] = typeof rawPaths === 'string' ? JSON.parse(rawPaths) : (rawPaths || [])
        const urls = await Promise.all(paths.map((p) => DeploymentPhotoService.getDisplayUrl(p)))
        return urls.filter((u): u is string => !!u)
    },
}

export default DeploymentPhotoService
