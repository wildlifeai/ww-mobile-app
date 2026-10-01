import { useEffect, useState } from 'react'
import { ScrollView, StyleProp, StyleSheet, TouchableOpacity, View, ViewStyle } from 'react-native'
import { Image } from 'expo-image'
import type Deployment from '../../database/models/Deployment'
import { DeploymentPhotoService } from '../../services/DeploymentPhotoService'
import { ImagePreviewModal } from '../ImagePreviewModal'

interface Props {
    deployment: Deployment | undefined | null
    size?: number
    /** Spacing around the strip; it renders nothing when there are no photos */
    style?: StyleProp<ViewStyle>
}

/**
 * Horizontal strip of the phone photos taken at a deployment site.
 * Resolves local paths or signed storage URLs; disk-cached by storage path
 * so photos viewed once stay visible offline. Renders nothing if the
 * deployment has no photos (or none can be resolved yet). Tapping a photo
 * opens it full size (#234).
 */
export const DeploymentPhotoStrip = ({ deployment, size = 72, style }: Props) => {
    const [photos, setPhotos] = useState<{ url: string; cacheKey: string }[]>([])
    const [prevPathsKey, setPrevPathsKey] = useState('')
    const [openUrl, setOpenUrl] = useState<string | null>(null)

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
        <>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={[styles.strip, style]}>
                <View style={styles.row}>
                    {photos.map((photo, index) => (
                        <TouchableOpacity
                            key={photo.cacheKey}
                            onPress={() => setOpenUrl(photo.url)}
                            accessibilityRole="imagebutton"
                            accessibilityLabel={`Open site photo ${index + 1} of ${photos.length}`}
                            testID={`deployment-photo-${index}`}
                        >
                            <Image
                                source={{ uri: photo.url, cacheKey: photo.cacheKey }}
                                style={[styles.photo, { width: size, height: size }]}
                                contentFit="cover"
                                cachePolicy="disk"
                                transition={150}
                            />
                        </TouchableOpacity>
                    ))}
                </View>
            </ScrollView>
            <ImagePreviewModal
                visible={openUrl !== null}
                imageUri={openUrl}
                onDismiss={() => setOpenUrl(null)}
            />
        </>
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
