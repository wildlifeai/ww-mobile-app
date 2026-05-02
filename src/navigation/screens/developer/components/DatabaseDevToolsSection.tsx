import React, { useState, useCallback } from 'react'
import { View, Alert } from 'react-native'
import { List, Button, Text } from 'react-native-paper'
import { WWText } from '../../../../components/ui/WWText'
import { resetDatabaseForDev, clearDatabaseDataForDev } from '../../../../utils/devDatabaseReset'

const ListItemIcon = (iconName: string) => (props: any) => <List.Icon {...props} icon={iconName} />

const Icons = {
    database: ListItemIcon("database"),
    cloud: ListItemIcon("cloud"),
}

interface DatabaseDevToolsSectionProps {
    dbStatus: {
        isDevelopment: boolean
        supabaseUrl: string
        adapter: string
    } | null
    dynamicStyles: any
    refreshDbStatus: () => Promise<void>
}

export const DatabaseDevToolsSection: React.FC<DatabaseDevToolsSectionProps> = ({ dbStatus, dynamicStyles, refreshDbStatus }) => {
    const [isResetting, setIsResetting] = useState(false)

    const handleDatabaseReset = useCallback(() => {
        Alert.alert(
            "Reset Database",
            "This will delete ALL local data and recreate the database schema. You'll need to re-authenticate.\n\nAre you sure?",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Reset",
                    style: "destructive",
                    onPress: async () => {
                        setIsResetting(true)
                        try {
                            await resetDatabaseForDev()
                            Alert.alert(
                                "Success",
                                "Database reset complete. Please restart the app.",
                            )
                            await refreshDbStatus()
                        } catch (error) {
                            Alert.alert(
                                "Error",
                                `Failed to reset database: ${error instanceof Error ? error.message : "Unknown error"
                                }`,
                            )
                        } finally {
                            setIsResetting(false)
                        }
                    },
                },
            ],
        )
    }, [refreshDbStatus])

    const handleDatabaseClear = useCallback(() => {
        Alert.alert(
            "Clear Database Data",
            "This will delete ALL local data but keep the database schema. You'll need to re-authenticate.\n\nAre you sure?",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Clear",
                    style: "destructive",
                    onPress: async () => {
                        setIsResetting(true)
                        try {
                            await clearDatabaseDataForDev()
                            Alert.alert(
                                "Success",
                                "Database cleared. Please restart the app.",
                            )
                        } catch (error) {
                            Alert.alert(
                                "Error",
                                `Failed to clear database: ${error instanceof Error ? error.message : "Unknown error"
                                }`,
                            )
                        } finally {
                            setIsResetting(false)
                        }
                    },
                },
            ],
        )
    }, [])

    return (
        <>
            <List.Section>
                <List.Subheader><Text>Database (Dev Tools)</Text></List.Subheader>
                <List.Item
                    title="Database Adapter"
                    description={dbStatus ? dbStatus.adapter : "Loading..."}
                    left={Icons.database}
                />
                <List.Item
                    title="Supabase Instance"
                    description={
                        dbStatus?.supabaseUrl
                            ? dbStatus.supabaseUrl.includes("localhost")
                                ? "Local"
                                : dbStatus.supabaseUrl.includes("supabase.co")
                                    ? "Cloud Dev"
                                    : "Unknown"
                            : "Loading..."
                    }
                    left={Icons.cloud}
                />
            </List.Section>

            <View style={dynamicStyles.dbActionContainer}>
                <Button
                    mode="outlined"
                    onPress={handleDatabaseClear}
                    disabled={isResetting}
                    icon="delete-sweep"
                    buttonColor="transparent"
                    textColor="#ff9800"
                >
                    <Text>Clear Database Data</Text>
                </Button>
                <Button
                    mode="outlined"
                    onPress={handleDatabaseReset}
                    disabled={isResetting}
                    icon="database-refresh"
                    buttonColor="transparent"
                    textColor="#f44336"
                >
                    <Text>Reset Database (Full)</Text>
                </Button>
                <WWText
                    variant="bodySmall"
                    style={dynamicStyles.devNotice}
                >
                    <Text>⚠️ Dev Only: These actions will delete all local data</Text>
                </WWText>
            </View>
        </>
    )
}
