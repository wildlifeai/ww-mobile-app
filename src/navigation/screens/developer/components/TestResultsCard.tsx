import React, { useCallback } from 'react'
import { View, StyleSheet } from 'react-native'
import { Button, Card, Text } from 'react-native-paper'

interface TestResultsCardProps {
    testResults: string[]
    onClearResults: () => void
}

export const TestResultsCard: React.FC<TestResultsCardProps> = ({ testResults, onClearResults }) => {
    const renderCardTitleRight = useCallback((props: any) => (
        <Button {...props} onPress={onClearResults} compact>
            <Text>Clear</Text>
        </Button>
    ), [onClearResults])

    return (
        <Card style={styles.resultsCard}>
            <Card.Title
                title="Test Results"
                right={renderCardTitleRight}
            />
            <Card.Content>
                {testResults.length === 0 ? (
                    <Text style={styles.resultsPlaceholder}>
                        No test results yet. Run some tests above!
                    </Text>
                ) : (
                    <View>
                        {testResults.map((result) => (
                            <Text
                                key={result}
                                style={[
                                    styles.resultItem,
                                    result.includes("❌")
                                        ? styles.resultError
                                        : result.includes("✅")
                                            ? styles.resultSuccess
                                            : styles.resultNormal,
                                ]}
                            >
                                {result}
                            </Text>
                        ))}
                    </View>
                )}
            </Card.Content>
        </Card>
    )
}

const styles = StyleSheet.create({
    resultsCard: {
        marginBottom: 32,
    },
    resultsPlaceholder: {
        fontStyle: "italic",
        color: "#666",
    },
    resultItem: {
        fontSize: 12,
        fontFamily: "monospace",
        marginBottom: 4,
    },
    resultError: {
        color: "#F44336",
    },
    resultSuccess: {
        color: "#4CAF50",
    },
    resultNormal: {
        color: "#333",
    },
})
