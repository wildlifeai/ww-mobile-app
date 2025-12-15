import React from 'react'
import { View, StyleSheet } from 'react-native'
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
}

export const MetadataSection = ({
    name,
    notes,
    locationDescription,
    cameraHeight,
    onNameChange,
    onNotesChange,
    onLocationDescriptionChange,
    onCameraHeightChange
}: Props) => {
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
                />

                <TextInput
                    label="Location Description"
                    placeholder="Describe the camera location..."
                    value={locationDescription}
                    onChangeText={onLocationDescriptionChange}
                    mode="outlined"
                    multiline
                    numberOfLines={2}
                    style={styles.input}
                />

                <TextInput
                    label="Camera Height (cm)"
                    placeholder="e.g. 50"
                    value={cameraHeight}
                    onChangeText={onCameraHeightChange}
                    mode="outlined"
                    keyboardType="numeric"
                    style={styles.input}
                />

                <TextInput
                    label="Notes"
                    value={notes}
                    onChangeText={onNotesChange}
                    mode="outlined"
                    multiline
                    numberOfLines={3}
                    style={styles.input}
                />
            </Card.Content>
        </Card>
    )
}

const styles = StyleSheet.create({
    card: { marginBottom: 16 },
    content: { gap: 12 },
    input: {}
})
