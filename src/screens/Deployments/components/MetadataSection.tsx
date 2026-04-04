import { StyleSheet } from 'react-native'
import { Card, TextInput, Button, Text } from 'react-native-paper'

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

    const renderHelp = (props: any) => (
        <Button 
            {...props} 
            icon="help-circle-outline" 
            onPress={() => onShowHelp('Deployment Details', 'Deployment Name: A unique identifier for this specific deployment. It helps track data collected during this session.\n\nNotes: Any additional observations, such as location details, bait used, weather conditions, or specific features being monitored.')}
        >
            <Text>Help</Text>
        </Button>
    )

    return (
        <Card style={styles.card}>
            <Card.Title title="Deployment Details" right={renderHelp} />
            <Card.Content style={styles.content}>
                <TextInput
                    label="Deployment Name"
                    value={name}
                    onChangeText={onNameChange}
                    mode="outlined"
                    style={styles.input}
                />


                <TextInput
                    label="Notes"
                    value={notes}
                    onChangeText={onNotesChange}
                    mode="outlined"
                    multiline
                    numberOfLines={4}
                    style={[styles.input, styles.textArea]}
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
