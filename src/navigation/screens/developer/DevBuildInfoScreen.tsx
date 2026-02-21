import { useState, useEffect, useCallback, useMemo } from "react"
import { ScrollView, StyleSheet, View } from "react-native"
import { Surface, Divider, Chip, Text } from "react-native-paper"
import { WWText } from "../../../components/ui/WWText"
import { useExtendedTheme } from "../../../theme"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { getDatabaseStatus } from "../../../utils/devDatabaseReset"
import { logError } from '../../../utils/logger'

import { BuildInfoSection } from './components/BuildInfoSection'
import { ExpoInfoSection } from './components/ExpoInfoSection'
import { PlatformInfoSection } from './components/PlatformInfoSection'
import { NativeModulesSection } from './components/NativeModulesSection'
import { DatabaseDevToolsSection } from './components/DatabaseDevToolsSection'
import { MigrationStatusSection } from './components/MigrationStatusSection'

export const DevBuildInfo = () => {
    const { appPadding, spacing } = useExtendedTheme()
    const { top } = useSafeAreaInsets()
    const [dbStatus, setDbStatus] = useState<{
        isDevelopment: boolean
        supabaseUrl: string
        adapter: string
    } | null>(null)

    const loadDbStatus = useCallback(async () => {
        try {
            const status = await getDatabaseStatus()
            setDbStatus(status)
        } catch (error) {
            logError("Failed to load database status:", error)
        }
    }, [])

    useEffect(() => {
        loadDbStatus()
    }, [loadDbStatus])

    const dynamicStyles = useMemo(() => ({
        surface: { padding: appPadding, paddingTop: appPadding + top },
        header: { marginBottom: spacing * 2 },
        chip: { marginTop: spacing },
        divider: { marginVertical: spacing },
        nativeModuleChip: { backgroundColor: "#4caf50" },
        nativeModuleChipText: { color: "#fff" },
        moduleList: { paddingHorizontal: spacing * 2, marginBottom: spacing },
        moduleRow: {
            flexDirection: "row" as const,
            justifyContent: "space-between" as const,
            paddingVertical: spacing / 2,
        },
        moduleStatus: (color: string) => ({ color, fontSize: 12, flex: 1, textAlign: "right" as const }),
        dbActionContainer: { paddingHorizontal: spacing * 2, gap: spacing },
        devNotice: { textAlign: "center" as const, opacity: 0.7, paddingTop: spacing },
        footer: { marginTop: spacing * 3 },
    }), [appPadding, top, spacing])

    return (
        <ScrollView style={styles.container}>
            <Surface style={[styles.surface, dynamicStyles.surface]}>
                <View style={[styles.header, dynamicStyles.header]}>
                    <WWText variant="titleLarge"><Text>Development Build Info</Text></WWText>
                    <Chip icon="developer-board" style={dynamicStyles.chip}>
                        <Text>Expo Dev Client</Text>
                    </Chip>
                </View>

                <BuildInfoSection />

                <Divider style={dynamicStyles.divider} />

                <ExpoInfoSection />

                <Divider style={dynamicStyles.divider} />

                <PlatformInfoSection />

                <Divider style={dynamicStyles.divider} />

                <NativeModulesSection dynamicStyles={dynamicStyles} />

                <Divider style={dynamicStyles.divider} />

                <DatabaseDevToolsSection 
                    dbStatus={dbStatus} 
                    dynamicStyles={dynamicStyles} 
                    refreshDbStatus={loadDbStatus} 
                />

                <Divider style={dynamicStyles.divider} />

                <MigrationStatusSection />

                <View style={[styles.footer, dynamicStyles.footer]}>
                    <WWText variant="bodySmall" style={dynamicStyles.devNotice}>
                        <Text>This screen is only visible in development builds</Text>
                    </WWText>
                </View>
            </Surface>
        </ScrollView>
    )
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    surface: {
        flex: 1,
    },
    header: {
        alignItems: "center",
    },
    footer: {
        padding: 20,
        alignItems: "center",
    },
})
