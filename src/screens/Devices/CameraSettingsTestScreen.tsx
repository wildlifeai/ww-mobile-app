import { View, StyleSheet } from 'react-native'
import { ActivityIndicator } from 'react-native-paper'
import { useAppSelector } from '../../redux'
import { AppParams } from '../../navigation/types'
import { WWText } from '../../components/ui/WWText'
import { CameraSettingsTestSection } from './components/CameraSettingsTestSection'

export const CameraSettingsTestScreen = ({ route }: { route: AppParams<'CameraSettingsTestScreen'> }) => {
    const { deviceId } = route.params
    const device = useAppSelector(state => state.devices[deviceId || ''])

    if (!device) {
        return (
            <View style={styles.center}>
                <ActivityIndicator size="large" />
                <WWText style={{ marginTop: 16 }}>Locating device…</WWText>
            </View>
        )
    }

    return (
        <View style={styles.container}>
            <CameraSettingsTestSection device={device} />
        </View>
    )
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    center: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    }
})
