import { memo } from 'react'
import {
    StyleSheet,
    View,
    Modal,
    FlatList,
    TouchableOpacity,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { WWText } from './ui/WWText'
import { InvitationCard } from './InvitationCard'
import { IconButton, Text } from 'react-native-paper'

interface Invitation {
    id: string
    projectName: string
    inviterEmail: string
    role: 'project_admin' | 'project_member'
    expiresAt: Date
}

interface NotificationPanelProps {
    visible: boolean
    onClose: () => void
    invitations: Invitation[]
    onAccept: (invitationId: string) => void
    onDecline: (invitationId: string) => void
}

const EmptyState = ({ message }: { message: string }) => (
    <View style={styles.emptyState}>
        <WWText variant="bodyLarge" style={styles.emptyText}>
            {message}
        </WWText>
    </View>
)

export const NotificationPanel = memo<NotificationPanelProps>(({
    visible,
    onClose,
    invitations,
    onAccept,
    onDecline,
}) => {
    return (
        <Modal
            visible={visible}
            transparent
            animationType="slide"
            onRequestClose={onClose}
        >
            <SafeAreaView style={styles.overlay}>
                <TouchableOpacity
                    style={styles.backdrop}
                    activeOpacity={1}
                    onPress={onClose}
                />
                <View style={styles.panel}>
                    <View style={styles.header}>
                        <WWText variant="headlineSmall" style={styles.title}>
                            <Text>Notifications</Text>
                        </WWText>
                        <IconButton
                            icon="close"
                            size={24}
                            onPress={onClose}
                            iconColor="#FFFFFF"
                        />
                    </View>

                    <FlatList
                        data={invitations}
                        renderItem={({ item }) => (
                            <InvitationCard
                                invitation={item}
                                onAccept={() => onAccept(item.id)}
                                onDecline={() => onDecline(item.id)}
                            />
                        )}
                        keyExtractor={(item) => item.id}
                        contentContainerStyle={styles.listContent}
                        ListEmptyComponent={
                            <EmptyState message="No pending invitations" />
                        }
                    />
                </View>
            </SafeAreaView>
        </Modal>
    )
})

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
    },
    backdrop: {
        flex: 1,
    },
    panel: {
        position: 'absolute',
        left: 0,
        top: 0,
        bottom: 0,
        width: '85%',
        maxWidth: 400,
        backgroundColor: '#2C2C2C',
        shadowColor: '#000',
        shadowOffset: { width: 2, height: 0 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 5,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#424242',
    },
    title: {
        color: '#FFFFFF',
        fontWeight: '600',
    },
    listContent: {
        padding: 16,
    },
    emptyState: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 48,
    },
    emptyText: {
        color: '#999999',
        textAlign: 'center',
    },
})
