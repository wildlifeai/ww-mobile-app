import { StyleSheet } from 'react-native'
import { Card, TextInput } from 'react-native-paper'

interface Props {
    name: string
    notes: string
    onNameChange: (text: string) => void
    onNotesChange: (text: string) => void
    onShowHelp: (title: string, content: string) => void
}

export const MetadataSection = ({
    name,
    notes,
    onNameChange,
    onNotesChange,
    onShowHelp
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
                    right={<TextInput.Icon icon="help-circle-outline" onPress={() => onShowHelp('Deployment Name', 'A unique identifier for this specific deployment. It helps track data collected during this session.')} />}
                />


                <TextInput
                    label="Notes"
                    value={notes}
                    onChangeText={onNotesChange}
                    mode="outlined"
                    multiline
                    numberOfLines={4}
                    style={[styles.input, styles.textArea]}
                    right={<TextInput.Icon icon="help-circle-outline" onPress={() => onShowHelp('Notes', 'Any additional observations, such as location details, bait used, weather conditions, or specific features being monitored.')} />}
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
