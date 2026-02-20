import React from 'react'
import { StyleSheet } from 'react-native'
import { Button, Card, Text } from 'react-native-paper'

interface ApiTestsCardProps {
    onRunTests: () => void
}

export const ApiTestsCard: React.FC<ApiTestsCardProps> = ({ onRunTests }) => {
    return (
        <Card style={styles.card}>
            <Card.Title title="API Connectivity Tests" />
            <Card.Content>
                <Button
                    mode="contained"
                    onPress={onRunTests}
                    style={styles.input}
                >
                    Run All API Tests
                </Button>

                <Text variant="bodySmall" style={styles.mutedText}>
                    Tests database connection, authentication, and real-time features
                </Text>
            </Card.Content>
        </Card>
    )
}

const styles = StyleSheet.create({
    card: {
        marginBottom: 16,
    },
    input: {
        marginBottom: 8,
    },
    mutedText: {
        color: "#666",
    },
})
