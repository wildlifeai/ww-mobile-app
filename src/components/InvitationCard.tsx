import { memo } from 'react'
import { StyleSheet, View } from 'react-native'
import { WWText } from './ui/WWText'
import { Button, Text } from 'react-native-paper'

interface Invitation {
    id: string
    projectName: string
    inviterEmail: string
    role: 'project_admin' | 'project_member'
    expiresAt: Date
}

interface InvitationCardProps {
    invitation: Invitation
    onAccept: () => void
    onDecline: () => void
}

export const InvitationCard = memo<InvitationCardProps>(({
    invitation,
    onAccept,
    onDecline,
}) => {
    const daysLeft = Math.ceil(
        (invitation.expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    )

    const getRoleDisplay = (role: string) => {
        return role === 'project_admin' ? 'Admin' : 'Member'
    }

    return (
        <View style={styles.card}>
            <View style={styles.content}>
                <WWText variant="titleMedium" style={styles.projectName}>
                    {invitation.projectName}
                </WWText>

                <WWText variant="bodyMedium" style={styles.inviter}>
                    <Text>Invited by {invitation.inviterEmail}</Text>
                </WWText>

                <View style={styles.details}>
                    <WWText variant="bodySmall" style={styles.role}>
                        <Text>Role: {getRoleDisplay(invitation.role)}</Text>
                    </WWText>
                    <WWText variant="bodySmall" style={styles.expires}>
                        <Text>Expires in {daysLeft} {daysLeft === 1 ? 'day' : 'days'}</Text>
                    </WWText>
                </View>

                <View style={styles.actions}>
                    <Button
                        mode="contained"
                        onPress={onAccept}
                        style={styles.acceptButton}
                        labelStyle={styles.buttonLabel}
                    >
                        <Text>Accept</Text>
                    </Button>
                    <Button
                        mode="outlined"
                        onPress={onDecline}
                        style={styles.declineButton}
                        labelStyle={styles.buttonLabel}
                        textColor="#F44336"
                    >
                        <Text>Decline</Text>
                    </Button>
                </View>
            </View>
        </View>
    )
})

const styles = StyleSheet.create({
    card: {
        backgroundColor: '#424242',
        borderRadius: 12,
        marginBottom: 12,
        overflow: 'hidden',
    },
    content: {
        padding: 16,
    },
    projectName: {
        marginBottom: 8,
        color: '#FFFFFF',
    },
    inviter: {
        opacity: 0.8,
        marginBottom: 12,
        color: '#CCCCCC',
    },
    details: {
        marginBottom: 16,
    },
    role: {
        opacity: 0.7,
        marginBottom: 4,
        color: '#CCCCCC',
    },
    expires: {
        opacity: 0.7,
        color: '#FFA726',
    },
    actions: {
        flexDirection: 'row',
        gap: 12,
    },
    acceptButton: {
        flex: 1,
        backgroundColor: '#4CAF50',
    },
    declineButton: {
        flex: 1,
        borderColor: '#F44336',
    },
    buttonLabel: {
        fontSize: 14,
    },
})
