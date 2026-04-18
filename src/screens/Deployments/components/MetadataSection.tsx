import { StyleSheet } from 'react-native'
import { Card, TextInput, Button, Text } from 'react-native-paper'

interface Props {
    notes: string
    onNotesChange: (text: string) => void
    onShowHelp: (title: string, content: string) => void
}

export const MetadataSection = ({
    notes,
    onNotesChange,
    onShowHelp
}: Props) => {

    const renderHelp = (props: any) => (
        <Button 
            {...props} 
            icon="help-circle-outline" 
            onPress={() => onShowHelp('Notes', 'Record any additional observations about this deployment, such as location details, bait used, weather conditions, or specific features being monitored.')}
        >
            <Text>Help</Text>
        </Button>
    )

    return (
        <Card style={styles.card}>
            <Card.Title title="Notes" right={renderHelp} />
            <Card.Content style={styles.content}>
                <TextInput
                    label="Notes"
                    value={notes}
                    onChangeText={onNotesChange}
                    mode="outlined"
                    multiline
                    numberOfLines={4}
                    style={styles.textArea}
                />
            </Card.Content>
        </Card>
    )
}

const styles = StyleSheet.create({
    card: {},
    content: { gap: 12 },
    textArea: {
        minHeight: 100
    }
})
