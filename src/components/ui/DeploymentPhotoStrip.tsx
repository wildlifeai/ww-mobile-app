import { useEffect, useState } from 'react'
import { ScrollView, StyleSheet, View } from 'react-native'
import { Image } from 'expo-image'
import type Deployment from '../../database/models/Deployment'
import { DeploymentPhotoService } from '../../services/DeploymentPhotoService'

interface Props {
    deployment: Deployment | undefined | null
    size?: number
}

/**
 * Horizontal strip of the phone photos taken at a deployment site.
 * Resolves local paths or signed storage URLs; disk-cached by storage path
 * so photos viewed once stay visible offline. Renders nothing if the
 * deployment has no photos (or none can be resolved yet).
 */
export const DeploymentPhotoStrip = ({ deployment, size = 72 }: Props) => {
    const [photos, setPhotos] = useState<{ url: string; cacheKey: string }[]>([])
    const [prevPathsKey, setPrevPathsKey] = useState('')

    // @json fields return a fresh array on every access, so depend on a
    // stable string form to avoid re-signing URLs on every render.
    const rawPaths = deployment?.cameraLocationImagePaths
    const pathsKey = typeof rawPaths === 'string' ? rawPaths : JSON.stringify(rawPaths || [])

    // Clear stale thumbnails synchronously during render when paths change,
    // so the UI never briefly shows the previous deployment's photos.
    if (pathsKey !== prevPathsKey) {
        setPrevPathsKey(pathsKey)
        const nextPaths: string[] = JSON.parse(pathsKey)
        if (nextPaths.length === 0) setPhotos([])
    }

    useEffect(() => {
        const paths: string[] = JSON.parse(pathsKey)
        if (paths.length === 0) return

        let cancelled = false
        ;(async () => {
            let nextPhotos: { url: string; cacheKey: string }[] = []
            try {
                const resolved = await Promise.all(
                    paths.map(async (path) => {
                        const url = await DeploymentPhotoService.getDisplayUrl(path)
                        return url ? { url, cacheKey: path } : null
                    })
                )
                nextPhotos = resolved.filter((p): p is { url: string; cacheKey: string } => !!p)
            } catch {
                // nextPhotos stays [] — failed resolution is not fatal
            }
            if (!cancelled) setPhotos(nextPhotos)
        })()

        return () => {
            cancelled = true
        }
    }, [pathsKey])

    if (photos.length === 0) return null

    return (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.strip}>
            <View style={styles.row}>
                {photos.map((photo) => (
                    <Image
                        key={photo.cacheKey}
                        source={{ uri: photo.url, cacheKey: photo.cacheKey }}
                        style={[styles.photo, { width: size, height: size }]}
                        contentFit="cover"
                        cachePolicy="disk"
                        transition={150}
                    />
                ))}
            </View>
        </ScrollView>
    )
}

const styles = StyleSheet.create({
    strip: {
        marginBottom: 12,
    },
    row: {
        flexDirection: 'row',
        gap: 8,
    },
    photo: {
        borderRadius: 8,
        backgroundColor: 'rgba(0,0,0,0.05)',
    },
})
