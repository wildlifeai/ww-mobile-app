import { StyleSheet } from 'react-native'
import { Card, TextInput } from 'react-native-paper'

interface Props {
    name: string
    notes: string
    locationDescription: string
    cameraHeight: string // Stored as string in input, parsed to number later
    onNameChange: (text: string) => void
    onNotesChange: (text: string) => void
    onLocationDescriptionChange: (text: string) => void
    onCameraHeightChange: (text: string) => void
    onShowHelp: (title: string, content: string) => void
}

export const MetadataSection = ({
    name,
    notes,
    locationDescription,
    cameraHeight,
    onNameChange,
    onNotesChange,
    onLocationDescriptionChange,
    onCameraHeightChange,
    onShowHelp
}: Props) => {
    // Helper to only allow numeric input for Camera Height
    const handleCameraHeightChange = (text: string) => {
        // Allow empty string or numbers only
        if (text === '' || /^\d+$/.test(text)) {
            onCameraHeightChange(text)
        }
    }
    return (
        <Card style={styles.card}>
            <Card.Title title="Deployment Details" />
            <Card.Content style={styles.content}>
                <TextInput
                    label="Deployment Name"
                    value={name}
                    onChangeText={onNameChange}
                    mode="outlined"
                    style={styles.input}
                    right={<TextInput.Icon icon="help-circle-outline" onPress={() => onShowHelp('Deployment Name', 'A unique identifier for this specific deployment. It helps track data collected during this session.')} />}
                />

                <TextInput
                    label="Location Description"
                    placeholder="Describe the camera location..."
                    value={locationDescription}
                    onChangeText={onLocationDescriptionChange}
                    mode="outlined"
                    multiline
                    numberOfLines={4}
                    style={[styles.input, styles.textArea]}
                    right={<TextInput.Icon icon="help-circle-outline" onPress={() => onShowHelp('Location Description', "Describe the immediate surroundings (e.g., 'On oak tree, facing North'). Useful for finding the camera later.")} />}
                />

                <TextInput
                    label="Camera Height (cm)"
                    placeholder="e.g. 50"
                    value={cameraHeight}
                    onChangeText={handleCameraHeightChange}
                    mode="outlined"
                    keyboardType="numeric"
                    style={styles.input}
                    right={<TextInput.Icon icon="help-circle-outline" onPress={() => onShowHelp('Camera Height', 'The height of the camera lens from the ground in centimeters. Important for estimating animal size and perspective.')} />}
                />

                <TextInput
                    label="Notes"
                    value={notes}
                    onChangeText={onNotesChange}
                    mode="outlined"
                    multiline
                    numberOfLines={4}
                    style={[styles.input, styles.textArea]}
                    right={<TextInput.Icon icon="help-circle-outline" onPress={() => onShowHelp('Notes', 'Any additional observations, such as bait used, weather conditions, or specific features being monitored.')} />}
                />
            </Card.Content>
        </Card>
    )
}

const styles = StyleSheet.create({
    card: { marginBottom: 16 },
    content: { gap: 12 },
    input: {},
    textArea: {
        minHeight: 100
    }
})
