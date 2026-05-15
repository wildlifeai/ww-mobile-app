import { View, StyleSheet } from 'react-native'
import { useTheme, Button, Text } from 'react-native-paper'
import { useNavigation } from '@react-navigation/native'
import { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { RootStackParamList } from '../../navigation/types'
import { WWIcon } from './WWIcon'
import { WWText } from './WWText'

interface Props {
    /** Whether the BLE device is currently connected */
    connected: boolean
}

/**
 * A themed banner shown at the top of BLE-dependent screens when the
 * Bluetooth connection is lost (e.g. after the app is backgrounded).
 *
 * Renders nothing when `connected` is `true`.
 */
export const WWBleDisconnectedBanner = ({ connected }: Props) => {
    const { colors } = useTheme()
    const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()

    if (connected) return null

    return (
        <View style={[styles.container, { backgroundColor: 'rgba(176, 0, 32, 0.1)' }]}>
            <View style={styles.row}>
                <WWIcon source="bluetooth-off" size={20} color={colors.error} />
                <WWText style={[styles.text, { color: colors.error }]}>
                    Bluetooth connection lost. Actions are disabled.
                </WWText>
            </View>
            <Button
                mode="outlined"
                compact
                textColor={colors.error}
                style={styles.button}
                onPress={() => navigation.navigate('Home', { initialTab: 'scanner' })}
            >
                <Text style={{ color: colors.error }}>Go to Scanner</Text>
            </Button>
        </View>
    )
}

const styles = StyleSheet.create({
    container: {
        padding: 12,
        borderRadius: 8,
        marginBottom: 12,
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    text: {
        flex: 1,
        fontWeight: '600',
    },
    button: {
        marginTop: 8,
        alignSelf: 'flex-start',
    },
})
