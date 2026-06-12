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

    const rawPaths = deployment?.cameraLocationImagePaths
    useEffect(() => {
        let cancelled = false
        if (!deployment) {
            setPhotos([])
            return
        }
        const paths: string[] = typeof rawPaths === 'string' ? JSON.parse(rawPaths) : (rawPaths || [])
        Promise.all(
            paths.map(async (path) => {
                const url = await DeploymentPhotoService.getDisplayUrl(path)
                return url ? { url, cacheKey: path } : null
            })
        )
            .then((resolved) => {
                if (!cancelled) setPhotos(resolved.filter((p): p is { url: string; cacheKey: string } => !!p))
            })
            .catch(() => {
                if (!cancelled) setPhotos([])
            })
        return () => {
            cancelled = true
        }
    }, [deployment, rawPaths])

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
