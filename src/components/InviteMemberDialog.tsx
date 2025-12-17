import { memo, useState } from 'react'
import { StyleSheet, View, Alert } from 'react-native'
import {
    Dialog,
    Portal,
    Button,
    TextInput,
    RadioButton,
    HelperText,
} from 'react-native-paper'
import { WWText } from './ui/WWText'
import InvitationService from '../services/InvitationService'

interface InviteMemberDialogProps {
    visible: boolean
    onDismiss: () => void
    projectId: string
    onInviteSent: () => void
}

export const InviteMemberDialog = memo<InviteMemberDialogProps>(({
    visible,
    onDismiss,
    projectId,
    onInviteSent,
}) => {
    const [email, setEmail] = useState('')
    const [role, setRole] = useState<'project_admin' | 'project_member'>('project_member')
    const [loading, setLoading] = useState(false)

    const handleSend = async () => {
        if (!email.trim()) {
            Alert.alert('Error', 'Please enter an email address')
            return
        }

        // Basic email validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
        if (!emailRegex.test(email)) {
            Alert.alert('Error', 'Please enter a valid email address')
            return
        }

        setLoading(true)
        try {
            await InvitationService.sendInvitation(projectId, email.trim(), role)

            Alert.alert(
                'Invitation Sent',
                'The user will receive a notification in their app when they log in.'
            )

            setEmail('')
            setRole('project_member')
            onInviteSent()
            onDismiss()
        } catch (error: any) {
            Alert.alert(
                'Error',
                error.message || 'Failed to send invitation'
            )
        } finally {
            setLoading(false)
        }
    }

    const handleDismiss = () => {
        setEmail('')
        setRole('project_member')
        onDismiss()
    }

    return (
        <Portal>
            <Dialog visible={visible} onDismiss={handleDismiss} style={styles.dialog}>
                <Dialog.Title style={styles.title}>Invite Member</Dialog.Title>
                <Dialog.Content>
                    <HelperText type="info" visible style={styles.helperText}>
                        Enter the user's email address. They will be notified in the app.
                    </HelperText>

                    <TextInput
                        label="Email Address"
                        value={email}
                        onChangeText={setEmail}
                        keyboardType="email-address"
                        autoCapitalize="none"
                        autoCorrect={false}
                        mode="outlined"
                        style={styles.input}
                        disabled={loading}
                    />

                    <View style={styles.roleSection}>
                        <WWText variant="bodyMedium" style={styles.roleLabel}>
                            Role
                        </WWText>
                        <RadioButton.Group
                            onValueChange={(value) =>
                                setRole(value as 'project_admin' | 'project_member')
                            }
                            value={role}
                        >
                            <RadioButton.Item
                                label="Member"
                                value="project_member"
                                disabled={loading}
                            />
                            <RadioButton.Item
                                label="Admin"
                                value="project_admin"
                                disabled={loading}
                            />
                        </RadioButton.Group>
                    </View>
                </Dialog.Content>
                <Dialog.Actions>
                    <Button onPress={handleDismiss} disabled={loading}>
                        Cancel
                    </Button>
                    <Button
                        onPress={handleSend}
                        loading={loading}
                        disabled={loading}
                        mode="contained"
                    >
                        Send
                    </Button>
                </Dialog.Actions>
            </Dialog>
        </Portal>
    )
})

const styles = StyleSheet.create({
    dialog: {
        backgroundColor: '#2C2C2C',
    },
    title: {
        color: '#FFFFFF',
    },
    helperText: {
        marginBottom: 16,
    },
    input: {
        marginBottom: 16,
    },
    roleSection: {
        marginTop: 8,
    },
    roleLabel: {
        marginBottom: 8,
        color: '#FFFFFF',
    },
})
