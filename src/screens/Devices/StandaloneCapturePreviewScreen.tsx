import { useLayoutEffect, useCallback, useState } from 'react'
import { StyleSheet, Alert, View, Image } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRoute, useNavigation } from '@react-navigation/native'
import { Appbar } from 'react-native-paper'
import { useExtendedTheme } from '../../theme'

import { useAppSelector } from '../../redux'
import { WWText } from '../../components/ui/WWText'
import { CameraViewSection } from '../Deployments/components/CameraViewSection'
import { CaptureModeSelector } from './components/CaptureModeSelector'
import { DeviceHealthBanner } from '../../components/DeviceHealthBanner'
import { useDeviceSelfTest } from '../../hooks/useDeviceSelfTest'

export const StandaloneCapturePreviewScreen = () => {
    const route = useRoute<any>()
    const navigation = useNavigation<any>()
    const { colors } = useExtendedTheme()

    const deviceId = route.params?.deviceId
    const device = useAppSelector(state => state.devices[deviceId || ''])
    const { issues, isChecking, refresh: recheckHealth } = useDeviceSelfTest({ device })

    const handleBack = useCallback(() => {
        navigation.goBack()
    }, [navigation])

    const headerLeft = useCallback(() => (
        <Appbar.BackAction
            iconColor={colors.onBackground}
            onPress={handleBack}
        />
    ), [colors.onBackground, handleBack])

    // Handle Header Back Button
    useLayoutEffect(() => {
        navigation.setOptions({
            headerLeft: headerLeft,
            headerTitle: "Capture Preview",
            headerStyle: { backgroundColor: colors.background },
            headerTintColor: colors.onBackground,
        })
    }, [navigation, headerLeft, colors])

    // Handle help display
    const handleShowHelp = useCallback((title: string, content: string) => {
        Alert.alert(title, content)
    }, [])

    // Actual pixel dimensions of the last capture - the ground truth when
    // testing resolutions (the firmware notes hi-res in its console, but the
    // received file is the proof)
    const [lastDims, setLastDims] = useState<string | null>(null)
    const handleImageCaptured = useCallback((path: string) => {
        Image.getSize(
            path,
            (w, h) => setLastDims(`${w}×${h}`),
            () => setLastDims(null)
        )
    }, [])

    if (!device) {
        return (
            <SafeAreaView style={styles.centerContainer} edges={['top', 'bottom']}>
                <WWText style={styles.errorText}>Device not found</WWText>
            </SafeAreaView>
        )
    }

    return (
        <SafeAreaView style={styles.container} edges={['bottom', 'left', 'right']}>
            <View style={styles.content}>
                <DeviceHealthBanner issues={issues} onRecheck={recheckHealth} isChecking={isChecking} />
                <CaptureModeSelector
                    device={device}
                    onShowHelp={handleShowHelp}
                />
                <CameraViewSection
                    device={device}
                    onImageCaptured={handleImageCaptured}
                    onShowHelp={handleShowHelp}
                />
                {lastDims && (
                    <WWText style={styles.dimsText}>Last capture: {lastDims} px</WWText>
                )}
            </View>
        </SafeAreaView>
    )
}

const styles = StyleSheet.create({
    dimsText: {
        textAlign: 'center',
        opacity: 0.7,
        fontSize: 12,
        marginTop: 6,
    },
    container: {
        flex: 1,
    },
    content: {
        padding: 16,
    },
    centerContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 16,
    },
    errorText: {
        color: 'red',
        textAlign: 'center',
    }
})
