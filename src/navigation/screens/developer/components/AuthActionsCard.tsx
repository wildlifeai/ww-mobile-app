import React from 'react'
import { View, StyleSheet } from 'react-native'
import { Button, Card, TextInput, Text } from 'react-native-paper'

interface AuthActionsCardProps {
    email: string
    setEmail: (email: string) => void
    password: string
    setPassword: (password: string) => void
    username: string
    setUsername: (username: string) => void
    isSubmitting: boolean
    isLoggedIn: boolean
    loading: boolean
    onRegister: () => void
    onLogin: () => void
    onLogout: () => void
    onCheckAuthStatus: () => void
    onRefreshSession: () => void
    onResetPassword: () => void
}

export const AuthActionsCard: React.FC<AuthActionsCardProps> = ({
    email,
    setEmail,
    password,
    setPassword,
    username,
    setUsername,
    isSubmitting,
    isLoggedIn,
    loading,
    onRegister,
    onLogin,
    onLogout,
    onCheckAuthStatus,
    onRefreshSession,
    onResetPassword,
}) => {
    return (
        <Card style={styles.card}>
            <Card.Title title="Authentication Actions" />
            <Card.Content>
                <TextInput
                    label="Email"
                    value={email}
                    onChangeText={setEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    style={styles.input}
                />

                <TextInput
                    label="Password"
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry
                    style={styles.input}
                />

                <TextInput
                    label="Username (for registration)"
                    value={username}
                    onChangeText={setUsername}
                    autoCapitalize="none"
                    style={styles.inputLargeMargin}
                />

                <View style={styles.buttonRow}>
                    <Button
                        mode="contained"
                        onPress={onRegister}
                        disabled={isSubmitting || loading}
                        style={styles.flex1}
                    >
                        <Text>{isSubmitting ? "Registering..." : "Register"}</Text>
                    </Button>

                    <Button
                        mode="outlined"
                        onPress={onLogin}
                        disabled={isSubmitting || loading}
                        style={styles.flex1}
                    >
                        <Text>{isSubmitting ? "Logging in..." : "Login"}</Text>
                    </Button>
                </View>

                {isLoggedIn && (
                    <Button
                        mode="contained-tonal"
                        onPress={onLogout}
                        style={styles.input}
                    >
                        <Text>Logout</Text>
                    </Button>
                )}

                <View style={styles.gapRow}>
                    <Button
                        mode="outlined"
                        onPress={onCheckAuthStatus}
                        style={styles.flex1}
                        compact
                    >
                        <Text>Check Status</Text>
                    </Button>

                    <Button
                        mode="outlined"
                        onPress={onRefreshSession}
                        style={styles.flex1}
                        compact
                    >
                        <Text>Refresh Session</Text>
                    </Button>
                </View>

                <Button
                    mode="text"
                    onPress={onResetPassword}
                    style={styles.textButton}
                >
                    <Text>Reset Password</Text>
                </Button>
            </Card.Content>
        </Card>
    )
}

const styles = StyleSheet.create({
    card: {
        marginBottom: 16,
    },
    input: {
        marginBottom: 8,
    },
    inputLargeMargin: {
        marginBottom: 16,
    },
    buttonRow: {
        flexDirection: "row",
        gap: 8,
        marginBottom: 16,
    },
    gapRow: {
        flexDirection: "row",
        gap: 8,
    },
    flex1: {
        flex: 1,
    },
    textButton: {
        marginTop: 8,
    },
})
