import * as FileSystem from 'expo-file-system/legacy'
import database from '../database'
import Deployment from '../database/models/Deployment'
import OutboxService from './OutboxService'
import { mapModelToPayload } from './DeploymentService'
import SupabaseSyncService from './SupabaseSyncService'
import { getSupabaseClient } from './supabase'
import { log, logError, logWarn } from '../utils/logger'

const PHOTOS_DIR = FileSystem.documentDirectory + 'deployment-photos/'
const BUCKET = 'deployment-photos'
const SIGNED_URL_TTL_SECONDS = 60 * 60 // 1 hour

const isLocalPath = (path: string) => path.startsWith('file://')

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

        const extension = sourceUri.split('.').pop()?.toLowerCase() || 'jpg'
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
     * failures leave the local path in place for the next attempt.
     */
    uploadPendingPhotos: async (deploymentId: string, userId: string): Promise<void> => {
        const deploymentsCollection = database.get<Deployment>('deployments')
        let deployment: Deployment
        try {
            deployment = await deploymentsCollection.find(deploymentId)
        } catch {
            logWarn('[DeploymentPhotoService] Deployment not found:', deploymentId)
            return
        }

        const rawPaths = deployment.cameraLocationImagePaths
        const paths: string[] = typeof rawPaths === 'string' ? JSON.parse(rawPaths) : (rawPaths || [])
        if (!paths.some(isLocalPath)) return

        const supabase = getSupabaseClient()
        const updatedPaths: string[] = []
        let uploadedAny = false

        for (const path of paths) {
            if (!isLocalPath(path)) {
                updatedPaths.push(path)
                continue
            }

            try {
                const fileInfo = await FileSystem.getInfoAsync(path)
                if (!fileInfo.exists) {
                    logWarn('[DeploymentPhotoService] Local photo missing, dropping:', path)
                    uploadedAny = true // path list changed
                    continue
                }

                const filename = path.split('/').pop() || `${Date.now()}.jpg`
                const storagePath = `${deployment.projectId}/${deployment.id}/${filename}`
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
                updatedPaths.push(storagePath)
                uploadedAny = true
                await DeploymentPhotoService.removeLocalPhoto(path)
            } catch (e) {
                logError('[DeploymentPhotoService] Upload failed, will retry later:', e)
                updatedPaths.push(path) // keep local path for retry
            }
        }

        if (!uploadedAny) return

        await database.write(async () => {
            const fresh = await deploymentsCollection.find(deploymentId)
            const updateOp = fresh.prepareUpdate((record) => {
                record.cameraLocationImagePaths = updatedPaths
                record.modifiedBy = userId
            })
            const outboxOp = OutboxService.recordOperation({
                operation: 'UPDATE',
                tableName: 'deployments',
                recordId: fresh.id,
                payload: mapModelToPayload(fresh),
                userId,
            })
            await database.batch(updateOp, outboxOp)
        })

        SupabaseSyncService.debouncedSync()
    },

    /**
     * Try to upload pending photos for every deployment that still has
     * local paths. Called opportunistically (e.g. after a sync).
     */
    uploadAllPending: async (userId: string): Promise<void> => {
        const deploymentsCollection = database.get<Deployment>('deployments')
        const deployments = await deploymentsCollection.query().fetch()
        for (const deployment of deployments) {
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
