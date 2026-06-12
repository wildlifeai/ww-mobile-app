import { useState } from 'react'
import { Alert, Image, ScrollView, StyleSheet, View } from 'react-native'
import { Card, Button, Text, IconButton } from 'react-native-paper'
import * as ImagePicker from 'expo-image-picker'
import { DeploymentPhotoService } from '../../../services/DeploymentPhotoService'
import { logWarn } from '../../../utils/logger'

interface Props {
    photoPaths: string[]
    onAddPhoto: (path: string) => void
    onRemovePhoto: (path: string) => void
    onShowHelp: (title: string, content: string) => void
    disabled?: boolean
}

const PICKER_OPTIONS: ImagePicker.ImagePickerOptions = {
    mediaTypes: ['images'],
    quality: 0.7,
    exif: false,
}

export const DeploymentPhotosSection = ({
    photoPaths,
    onAddPhoto,
    onRemovePhoto,
    onShowHelp,
    disabled
}: Props) => {
    const [busy, setBusy] = useState(false)

    const handleResult = async (result: ImagePicker.ImagePickerResult) => {
        if (result.canceled || !result.assets?.length) return
        for (const asset of result.assets) {
            const persisted = await DeploymentPhotoService.persistLocalPhoto(asset.uri)
            onAddPhoto(persisted)
        }
    }

    const takePhoto = async () => {
        setBusy(true)
        try {
            const permission = await ImagePicker.requestCameraPermissionsAsync()
            if (!permission.granted) {
                Alert.alert('Camera permission needed', 'Please allow camera access to take deployment photos.')
                return
            }
            const result = await ImagePicker.launchCameraAsync(PICKER_OPTIONS)
            await handleResult(result)
        } catch (e) {
            logWarn('[DeploymentPhotosSection] Failed to take photo:', e)
        } finally {
            setBusy(false)
        }
    }

    const pickFromLibrary = async () => {
        setBusy(true)
        try {
            const result = await ImagePicker.launchImageLibraryAsync({
                ...PICKER_OPTIONS,
                allowsMultipleSelection: true,
                selectionLimit: 5,
            })
            await handleResult(result)
        } catch (e) {
            logWarn('[DeploymentPhotosSection] Failed to pick photo:', e)
        } finally {
            setBusy(false)
        }
    }

    const renderHelp = (props: any) => (
        <Button
            {...props}
            icon="help-circle-outline"
            onPress={() => onShowHelp(
                'Deployment Photos',
                'Take a few photos of the camera in place and its surroundings. They are shared with everyone in the project, making the camera much easier to find again in the field.\n\nGood photos to take:\n• The camera mounted in position\n• The view standing a few steps back\n• A recognisable landmark nearby'
            )}
        >
            <Text>Help</Text>
        </Button>
    )

    return (
        <Card style={styles.card}>
            <Card.Title title="Deployment Photos" right={renderHelp} />
            <Card.Content style={styles.content}>
                <Text variant="bodySmall" style={styles.hint}>
                    Photos of the camera in the field help anyone in the project find it later.
                </Text>

                {photoPaths.length > 0 && (
                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                        <View style={styles.thumbRow}>
                            {photoPaths.map((path) => (
                                <View key={path} style={styles.thumbContainer}>
                                    <Image source={{ uri: path }} style={styles.thumb} />
                                    <IconButton
                                        icon="close-circle"
                                        size={20}
                                        style={styles.removeButton}
                                        onPress={() => onRemovePhoto(path)}
                                        disabled={disabled || busy}
                                    />
                                </View>
                            ))}
                        </View>
                    </ScrollView>
                )}

                <View style={styles.buttonRow}>
                    <Button
                        mode="outlined"
                        icon="camera"
                        onPress={takePhoto}
                        disabled={disabled || busy}
                        style={styles.button}
                    >
                        <Text>Take Photo</Text>
                    </Button>
                    <Button
                        mode="outlined"
                        icon="image-multiple"
                        onPress={pickFromLibrary}
                        disabled={disabled || busy}
                        style={styles.button}
                    >
                        <Text>From Library</Text>
                    </Button>
                </View>
            </Card.Content>
        </Card>
    )
}

const styles = StyleSheet.create({
    card: {},
    content: { gap: 12 },
    hint: { opacity: 0.7 },
    thumbRow: {
        flexDirection: 'row',
        gap: 8,
    },
    thumbContainer: {
        position: 'relative',
    },
    thumb: {
        width: 96,
        height: 96,
        borderRadius: 8,
    },
    removeButton: {
        position: 'absolute',
        top: -12,
        right: -12,
        margin: 0,
    },
    buttonRow: {
        flexDirection: 'row',
        gap: 8,
    },
    button: {
        flex: 1,
    },
})
