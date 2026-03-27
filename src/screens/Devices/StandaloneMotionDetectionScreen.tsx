import React, { useLayoutEffect, useCallback } from 'react'
import { StyleSheet, Alert } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRoute, useNavigation } from '@react-navigation/native'
import { Appbar } from 'react-native-paper'
import { useExtendedTheme } from '../../theme'

import { useAppSelector } from '../../redux'
import { WWText } from '../../components/ui/WWText'
import { MotionDetectionSection } from './components/MotionDetectionSection'

export const StandaloneMotionDetectionScreen = () => {
    const route = useRoute<any>()
    const navigation = useNavigation<any>()
    const { colors } = useExtendedTheme()

    const deviceId = route.params?.deviceId
    const device = useAppSelector(state => state.devices[deviceId || ''])

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
            headerTitle: "Motion Detection",
            headerStyle: { backgroundColor: colors.background },
            headerTintColor: colors.onBackground,
        })
    }, [navigation, headerLeft, colors])

    // Handle help display
    const handleShowHelp = useCallback((title: string, content: string) => {
        Alert.alert(title, content)
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
            <MotionDetectionSection
                bleDevice={device}
                isInitializing={false}
                bleDeviceConnected={device.connected}
                onShowHelp={handleShowHelp}
            />
        </SafeAreaView>
    )
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
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
