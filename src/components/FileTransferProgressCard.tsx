import React from 'react'
import { View, StyleSheet } from 'react-native'
import { ProgressBar, ActivityIndicator, IconButton, Button } from 'react-native-paper'
import { useExtendedTheme } from '../theme'
import { WWText } from './ui/WWText'

export interface FileTransferProgressCardProps {
    title: string
    filename?: string
    statusLabel?: string
    isIndeterminate?: boolean
    progress?: number // 0 to 1
    speedBytesPerSec?: number
    estimatedRemainingMs?: number
    bytesTransferred?: number
    totalBytes?: number
    onCancel?: () => void
    onRetry?: () => void
    isFailed?: boolean
    isPaused?: boolean
    isComplete?: boolean
}

function formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}

function formatTime(ms: number): string {
    if (!ms || ms < 0) return '--:--'
    const totalSeconds = Math.floor(ms / 1000)
    const minutes = Math.floor(totalSeconds / 60)
    const seconds = totalSeconds % 60
    if (minutes > 59) {
        const hours = Math.floor(minutes / 60)
        const mins = minutes % 60
        return `${hours}h ${mins}m`
    }
    return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

export const FileTransferProgressCard: React.FC<FileTransferProgressCardProps> = ({
    title,
    filename,
    statusLabel,
    isIndeterminate = false,
    progress = 0,
    speedBytesPerSec = 0,
    estimatedRemainingMs = 0,
    bytesTransferred,
    totalBytes,
    onCancel,
    onRetry,
    isFailed,
    isPaused,
    isComplete,
}) => {
    const { colors, spacing } = useExtendedTheme()

    const showStats = !isIndeterminate && !isComplete && !isFailed && !isPaused && (speedBytesPerSec > 0 || estimatedRemainingMs > 0)

    return (
        <View style={[styles.container, { backgroundColor: colors.surface, padding: spacing }]}>
            <View style={styles.header}>
                <View style={styles.titleContainer}>
                    <WWText variant="titleMedium" style={{ color: colors.onSurface }}>{title}</WWText>
                    {filename && (
                        <WWText variant="bodySmall" style={{ color: colors.onSurfaceVariant, marginTop: 2 }}>
                            {filename}
                        </WWText>
                    )}
                </View>
                {onCancel && !isComplete && !isFailed && (
                    <IconButton
                        icon="close"
                        size={20}
                        iconColor={colors.onSurfaceVariant}
                        onPress={onCancel}
                        style={styles.cancelButton}
                    />
                )}
            </View>

            <View style={[styles.progressContainer, { marginTop: spacing }]}>
                {isIndeterminate ? (
                    <View style={styles.indeterminateContainer}>
                        <ActivityIndicator animating color={colors.primary} size={24} />
                    </View>
                ) : (
                    <ProgressBar
                        progress={progress}
                        color={isFailed ? colors.error : isComplete ? colors.primary : colors.primary}
                        style={styles.progressBar}
                    />
                )}
            </View>

            <View style={[styles.statusRow, { marginTop: spacing / 2 }]}>
                <WWText variant="bodySmall" style={{ color: isFailed ? colors.error : colors.onSurfaceVariant, flex: 1 }}>
                    {statusLabel || (isComplete ? 'Complete' : isFailed ? 'Failed' : isPaused ? 'Paused' : `${Math.round(progress * 100)}%`)}
                </WWText>
                
                {showStats && (
                    <WWText variant="bodySmall" style={{ color: colors.onSurfaceVariant, textAlign: 'right' }}>
                        {formatBytes(speedBytesPerSec)}/s • ETA {formatTime(estimatedRemainingMs)}
                    </WWText>
                )}
                
                {bytesTransferred !== undefined && totalBytes !== undefined && !showStats && !isComplete && !isFailed && (
                    <WWText variant="bodySmall" style={{ color: colors.onSurfaceVariant, textAlign: 'right' }}>
                        {formatBytes(bytesTransferred)} / {formatBytes(totalBytes)}
                    </WWText>
                )}
            </View>

            {(isFailed || isPaused) && onRetry && (
                <View style={[styles.actionRow, { marginTop: spacing }]}>
                    <Button mode="contained" onPress={onRetry} buttonColor={colors.primary}>
                        {isPaused ? 'Resume' : 'Retry'}
                    </Button>
                </View>
            )}
        </View>
    )
}

const styles = StyleSheet.create({
    container: {
        borderRadius: 12,
        overflow: 'hidden',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
    },
    titleContainer: {
        flex: 1,
    },
    cancelButton: {
        margin: 0,
        marginRight: -8,
        marginTop: -8,
    },
    progressContainer: {
        height: 12,
        justifyContent: 'center',
    },
    progressBar: {
        height: 6,
        borderRadius: 3,
    },
    indeterminateContainer: {
        alignItems: 'flex-start',
    },
    statusRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    actionRow: {
        alignItems: 'flex-end',
    }
})
