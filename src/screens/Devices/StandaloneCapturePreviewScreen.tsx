import { useLayoutEffect, useCallback } from 'react'
import { StyleSheet, Alert, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRoute, useNavigation } from '@react-navigation/native'
import { Appbar } from 'react-native-paper'
import { useExtendedTheme } from '../../theme'

import { useAppSelector } from '../../redux'
import { WWText } from '../../components/ui/WWText'
import { CameraViewSection } from '../Deployments/components/CameraViewSection'
import { CameraSelector } from './components/CameraSelector'
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

    const handleImageCaptured = useCallback((_path: string) => {
        // Nothing special to do here, the component shows the image itself
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
                <CameraSelector
                    device={device}
                    onShowHelp={handleShowHelp}
                />
                <CameraViewSection
                    device={device}
                    onImageCaptured={handleImageCaptured}
                    onShowHelp={handleShowHelp}
                />
            </View>
        </SafeAreaView>
    )
}

const styles = StyleSheet.create({
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
