import React from 'react'
import { StyleSheet, View, ScrollView } from 'react-native'
import { Modal, Portal, Card, Text, ProgressBar, Button, IconButton, useTheme } from 'react-native-paper'
// import { WWIcon } from '../../../components/ui/WWIcon'

interface FinishProgressDialogProps {
    visible: boolean
    progress: number
    step: string
    logs: string[]
    isComplete: boolean
    onDismiss: () => void
    loadingTitle?: string
    successTitle?: string
    hideOkButton?: boolean
}

export const FinishProgressDialog: React.FC<FinishProgressDialogProps> = ({
    visible,
    progress,
    step,
    logs,
    isComplete,
    onDismiss,
    loadingTitle = 'Processing…',
    successTitle = 'Completed Successfully',
    hideOkButton = false
}) => {
    const theme = useTheme()
    const scrollViewRef = React.useRef<ScrollView>(null)

    // Auto-scroll logs to bottom
    React.useEffect(() => {
        let timeoutId: NodeJS.Timeout
        if (logs.length > 0) {
            timeoutId = setTimeout(() => {
                scrollViewRef.current?.scrollToEnd({ animated: true })
            }, 100)
        }
        return () => clearTimeout(timeoutId)
    }, [logs.length])

// Using an ID generator memo to avoid index as key warning while keeping keys stable for append-only logs
const logsWithStableIds = React.useMemo(() => {
    return logs.map((log, i) => ({ id: `log-entry-${i}-${log.substring(0, 10)}`, text: log }))
}, [logs])

return (
    <Portal>
        <Modal
            visible={visible}
            onDismiss={isComplete ? onDismiss : undefined}
            contentContainerStyle={styles.modalContent}
            dismissable={isComplete}
        >
            <Card style={styles.card}>
                <Card.Content style={styles.content}>
                    <View style={styles.header}>
                        {isComplete ? (
                            <View style={styles.successHeader}>
                                <IconButton
                                    icon="check-circle"
                                    iconColor={theme.colors.primary}
                                    size={48}
                                />
                                <Text variant="headlineSmall" style={styles.title}>
                                    {successTitle}
                                </Text>
                            </View>
                        ) : (
                            <Text variant="headlineSmall" style={styles.title}>
                                {loadingTitle}
                            </Text>
                        )}
                    </View>

                    <Text variant="bodyMedium" style={styles.stepText}>
                        {step}
                    </Text>

                    <ProgressBar
                        progress={progress}
                        color={theme.colors.primary}
                        style={styles.progressBar}
                    />

                    <View style={styles.logsContainer}>
                        <ScrollView
                            ref={scrollViewRef}
                            style={styles.logsScroll}
                            contentContainerStyle={styles.logsContent}
                        >
                            {logsWithStableIds.map((item) => (
                                <Text key={item.id} variant="bodySmall" style={styles.logLine}>
                                    {`> ${item.text}`}
                                </Text>
                            ))}
                        </ScrollView>
                    </View>

                        {isComplete && !hideOkButton && (
                            <Button
                                mode="contained"
                                onPress={onDismiss}
                                style={styles.button}
                            >
                                <Text>OK</Text>
                            </Button>
                        )}
                    </Card.Content>
                </Card>
            </Modal>
        </Portal>
    )
}

const styles = StyleSheet.create({
    modalContent: {
        padding: 20,
    },
    card: {
        backgroundColor: '#fff',
        borderRadius: 12,
        boxShadow: "0px 2px 4px rgba(0, 0, 0, 0.25)",
    },
    content: {
        alignItems: 'center',
        paddingVertical: 16,
    },
    header: {
        marginBottom: 16,
        alignItems: 'center',
    },
    successHeader: {
        alignItems: 'center',
    },
    title: {
        fontWeight: 'bold',
        textAlign: 'center',
        color: '#000',
    },
    stepText: {
        marginBottom: 8,
        textAlign: 'center',
        color: '#333',
    },
    progressBar: {
        width: '100%',
        height: 8,
        borderRadius: 4,
        marginBottom: 24,
    },
    logsContainer: {
        width: '100%',
        height: 150,
        backgroundColor: '#f5f5f5',
        borderRadius: 8,
        marginBottom: 24,
        borderWidth: 1,
        borderColor: '#e0e0e0',
    },
    logsScroll: {
        flex: 1,
    },
    logsContent: {
        padding: 12,
    },
    logLine: {
        fontFamily: 'monospace',
        color: '#444',
        marginBottom: 4,
    },
    button: {
        width: '100%',
        paddingVertical: 4,
    },
})
