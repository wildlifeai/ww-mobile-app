import React from 'react'
import { View, StyleSheet } from 'react-native'
import { Card, Chip, Text } from 'react-native-paper'
interface AuthStatusCardProps {
    isLoggedIn: boolean
    loading: boolean
    token: string | null | undefined
    user: any
}

export const AuthStatusCard: React.FC<AuthStatusCardProps> = ({
    isLoggedIn,
    loading,
    token,
    user,
}) => {
    return (
        <Card style={styles.card}>
            <Card.Title title="Authentication Status" />
            <Card.Content>
                <View style={styles.chipContainer}>
                    <Chip
                        icon={isLoggedIn ? "check" : "close"}
                        mode={isLoggedIn ? "flat" : "outlined"}
                    >
                        {isLoggedIn ? "Logged In" : "Not Logged In"}
                    </Chip>
                    <Chip icon={loading ? "loading" : "check"} mode="outlined">
                        {loading ? "Loading" : "Ready"}
                    </Chip>
                    <Chip icon={token ? "key" : "key-outline"} mode="outlined">
                        {token ? "Has Token" : "No Token"}
                    </Chip>
                </View>

                {user && (
                    <View>
                        <Text>
                            <Text style={styles.boldText}>Email:</Text> {user.email}
                        </Text>
                        <Text>
                            <Text style={styles.boldText}>ID:</Text> {user.id}
                        </Text>
                        <Text>
                            <Text style={styles.boldText}>Role:</Text> {user.role}
                        </Text>
                    </View>
                )}
            </Card.Content>
        </Card>
    )
}

const styles = StyleSheet.create({
    card: {
        marginBottom: 16,
    },
    chipContainer: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 8,
        marginBottom: 8,
    },
    boldText: {
        fontWeight: "bold",
    },
})
