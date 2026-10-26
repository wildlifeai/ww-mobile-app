import { useState } from 'react'
import { Alert, Image, ScrollView, StyleSheet, View } from 'react-native'
import { Button, IconButton } from 'react-native-paper'
import * as ImagePicker from 'expo-image-picker'
import { ActionRow } from '../../../components/ui/ActionRow'
import { ActionDialog } from '../../../components/ui/ActionDialog'
import { DeploymentPhotoService } from '../../../services/DeploymentPhotoService'
import { logWarn } from '../../../utils/logger'

interface Props {
    photoPaths: string[]
    onAddPhoto: (path: string) => void
    onRemovePhoto: (path: string) => void
    onShowHelp: (title: string, content: string) => void
    disabled?: boolean
}

const MAX_PHOTOS = 5

const CAMERA_OPTIONS: ImagePicker.ImagePickerOptions = {
    mediaTypes: ['images'],
    quality: 0.7,
    exif: false,
}

/**
 * Site Photo: the phone's picture of the Watcher in place, kept with the
 * deployment so anyone in the project can find the camera again. Not Camera
 * View, which is the Watcher's own picture. Tapping opens the phone camera at
 * once (no library since 26 October 2026); afterwards a popup lists the photos
 * with Take Another and a delete on each.
 */
export const SitePhotoAction = ({ photoPaths, onAddPhoto, onRemovePhoto, onShowHelp, disabled }: Props) => {
    const [busy, setBusy] = useState(false)
    const [open, setOpen] = useState(false)
    const atLimit = photoPaths.length >= MAX_PHOTOS

    /** Opens the phone camera; true when a photo was added. */
    const takePhoto = async (): Promise<boolean> => {
        setBusy(true)
        try {
            const permission = await ImagePicker.requestCameraPermissionsAsync()
            if (!permission.granted) {
                Alert.alert('Camera permission needed', 'Please allow camera access to take site photos.')
                return false
            }
            const result = await ImagePicker.launchCameraAsync(CAMERA_OPTIONS)
            if (result.canceled || !result.assets?.length) return false
            onAddPhoto(await DeploymentPhotoService.persistLocalPhoto(result.assets[0].uri))
            return true
        } catch (e) {
            logWarn('[SitePhotoAction] Failed to take photo:', e)
            return false
        } finally {
            setBusy(false)
        }
    }

    const handlePress = async () => {
        if (atLimit) {
            setOpen(true)
            return
        }
        const added = await takePhoto()
        if (added || photoPaths.length > 0) setOpen(true)
    }

    return (
        <>
            <ActionRow
                title="Site Photo"
                onPress={handlePress}
                onHelp={() => onShowHelp(
                    'Site Photo',
                    'Take a few photos of the Watcher in place with your phone. They are shared with everyone in the project, so the camera is much easier to find again.\n\nGood photos to take:\n• The Watcher mounted in position\n• The view standing a few steps back\n• A recognisable landmark nearby',
                )}
                result={photoPaths.length > 1 ? `${photoPaths.length}` : null}
                image={photoPaths[photoPaths.length - 1] ?? null}
                busy={busy}
                disabled={disabled}
            />
            <ActionDialog
                visible={open}
                title="Site Photo"
                onClose={() => setOpen(false)}
                actions={
                    <Button onPress={takePhoto} disabled={disabled || busy || atLimit}>
                        Take Another
                    </Button>
                }
            >
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    <View style={styles.thumbRow}>
                        {photoPaths.map((path) => (
                            <View key={path}>
                                <Image source={{ uri: path }} style={styles.thumb} />
                                <IconButton
                                    icon="close-circle"
                                    size={20}
                                    style={styles.remove}
                                    onPress={() => onRemovePhoto(path)}
                                    disabled={disabled || busy}
                                    accessibilityLabel="Delete this photo"
                                />
                            </View>
                        ))}
                    </View>
                </ScrollView>
            </ActionDialog>
        </>
    )
}

const styles = StyleSheet.create({
    thumbRow: {
        flexDirection: 'row',
        gap: 8,
        paddingTop: 12,
    },
    thumb: {
        width: 120,
        height: 120,
        borderRadius: 8,
    },
    remove: {
        position: 'absolute',
        top: -12,
        right: -12,
        margin: 0,
    },
})
