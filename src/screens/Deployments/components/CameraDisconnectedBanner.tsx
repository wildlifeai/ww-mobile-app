import { StyleSheet, View } from 'react-native'
import { Text, useTheme } from 'react-native-paper'
import { WWButton } from '../../../components/ui/WWButton'
import { WWIcon } from '../../../components/ui/WWIcon'

interface Props {
    isReconnecting: boolean
    reconnectFailed: boolean
    onReconnect: () => void
}

/**
 * Start Monitoring's own word that the camera dropped the link during setup,
 * with Reconnect in place, so what was entered stays (#571). The camera
 * advertises again only after its middle button, hence the instruction first.
 */
export const CameraDisconnectedBanner = ({ isReconnecting, reconnectFailed, onReconnect }: Props) => {
    const { colors } = useTheme()
    return (
        <View style={[styles.container, { backgroundColor: colors.errorContainer, borderColor: colors.error }]} testID="camera-disconnected-banner">
            <View style={styles.row}>
                <WWIcon source="bluetooth-off" size={20} color={colors.error} />
                <Text variant="titleSmall" style={[styles.title, { color: colors.onErrorContainer }]}>
                    The camera disconnected
                </Text>
            </View>
            <Text variant="bodyMedium" style={{ color: colors.onErrorContainer }}>
                {reconnectFailed
                    ? 'The camera did not answer. Press its middle button, then try again.'
                    : 'Press its middle button, then tap Reconnect. What you entered is kept.'}
            </Text>
            <WWButton mode="contained" onPress={onReconnect} loading={isReconnecting} disabled={isReconnecting} style={styles.button}>
                <Text style={{ color: colors.onPrimary }}>{isReconnecting ? 'Reconnecting…' : 'Reconnect'}</Text>
            </WWButton>
        </View>
    )
}

const styles = StyleSheet.create({
    container: {
        padding: 12,
        borderRadius: 8,
        borderWidth: 1,
        marginBottom: 16,
        gap: 8,
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    title: {
        flex: 1,
        fontWeight: '600',
    },
    button: {
        alignSelf: 'flex-start',
    },
})
