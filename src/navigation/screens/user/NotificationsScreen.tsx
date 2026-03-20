import { View, ScrollView, RefreshControl, Alert, StyleSheet } from "react-native"
import { WWScreenView } from "../../../components/ui/WWScreenView"
import { WWText } from "../../../components/ui/WWText"
import { Card, Button, Chip, useTheme, ActivityIndicator, Text } from "react-native-paper"
import { useState, useCallback } from "react"
import { useFocusEffect } from "@react-navigation/native"
import InvitationService, { PendingInvitation } from "../../../services/InvitationService"
import { logError, log } from '../../../utils/logger'
import useSupabaseAuth from "../../../hooks/useSupabaseAuth"
import SupabaseSyncService from "../../../services/SupabaseSyncService"

export const Notifications = () => {
	const theme = useTheme()
	const [invitations, setInvitations] = useState<PendingInvitation[]>([])
	const [loading, setLoading] = useState(false)
	const [refreshing, setRefreshing] = useState(false)
	const [processingId, setProcessingId] = useState<string | null>(null)

	const loadInvitations = useCallback(async () => {
		setLoading(true)
		try {
			// Fetch directly from Cloud to access rich payload data (project_name & inviter_email)
			// Local DB mapping drops these properties. We will still sync to support backend triggers.
			await InvitationService.syncInvitations()
			const pending = await InvitationService.getMyPendingInvitations()
			setInvitations(pending)
		} catch (error) {
			logError("Failed to load invitations:", error)
		} finally {
			setLoading(false)
		}
	}, [])

	useFocusEffect(
		useCallback(() => {
			loadInvitations()
		}, [loadInvitations])
	)

	const onRefresh = useCallback(async () => {
		setRefreshing(true)
		await loadInvitations()
		setRefreshing(false)
	}, [loadInvitations])

	const { refreshSession } = useSupabaseAuth()

	const handleRespond = useCallback(async (invitationId: string, accept: boolean) => {
		setProcessingId(invitationId)
		try {
			await InvitationService.respondToInvitation(invitationId, accept)
			Alert.alert("Success", `Invitation ${accept ? "accepted" : "declined"}`)

			if (accept) {
				log("🔄 Refreshing session and syncing data after invite acceptance...")
				try {
					// 1. Refresh Redux user session to get the new project role/permissions
					await refreshSession()
					// 2. Trigger a global background sync to pull down the new Projects and Devices IMMEDIATELY
					await SupabaseSyncService.sync()
				} catch (syncError) {
					logError("Sync failed after accepting invite", syncError)
					// We don't throw here because the invitation itself was successfully accepted
				}
			}

			// Refresh list from cloud
			const pending = await InvitationService.getMyPendingInvitations()
			setInvitations(pending)
		} catch (error: any) {
			Alert.alert("Error", error.message || "Failed to respond to invitation")
		} finally {
			setProcessingId(null)
		}
	}, [refreshSession])

	const renderCardLeft = useCallback((props: any) => <Chip icon="email-outline" {...props} onPress={() => { }}><Text>Invite</Text></Chip>, [])

	return (
		<WWScreenView>
			<ScrollView
				refreshControl={
					<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
				}
				contentContainerStyle={styles.scrollContent}
			>
				<WWText variant="titleMedium" style={styles.header}>
					<Text>Pending Invitations</Text>
				</WWText>

				{loading && !refreshing && invitations.length === 0 ? (
					<ActivityIndicator style={styles.loading} />
				) : invitations.length === 0 ? (
					<View style={styles.emptyContainer}>
						<WWText><Text>No pending invitations</Text></WWText>
					</View>
				) : (
					invitations.map((invite) => (
						<Card key={invite.id} style={styles.card}>
							<Card.Title
								title={`Project Invitation: ${invite.project_name || 'Unknown Project'}`}
								titleNumberOfLines={2}
								subtitle={`Role: ${invite.role === 'project_admin' ? 'Admin' : 'Member'}`}
								left={renderCardLeft}
							/>
							<Card.Content>
								<Text variant="bodyMedium">
									Invited by: {invite.inviter_email || 'Unknown User'}
								</Text>
								<Text variant="bodySmall" style={[styles.expiryText, { color: theme.colors.outline }]}>
									Expires: {new Date(invite.expires_at).toLocaleDateString()}
								</Text>
							</Card.Content>
							<Card.Actions>
								<Button
									onPress={() => handleRespond(invite.id, false)}
									disabled={processingId === invite.id}
									textColor={theme.colors.error}
								>
									<Text>Decline</Text>
								</Button>
								<Button
									mode="contained"
									onPress={() => handleRespond(invite.id, true)}
									disabled={processingId === invite.id}
									loading={processingId === invite.id}
								>
									<Text>Accept</Text>
								</Button>
							</Card.Actions>
						</Card>
					))
				)}
			</ScrollView>
		</WWScreenView>
	)
}

const styles = StyleSheet.create({
	scrollContent: {
		padding: 16,
	},
	header: {
		marginBottom: 16,
	},
	loading: {
		marginTop: 20,
	},
	emptyContainer: {
		alignItems: "center",
		marginTop: 40,
		opacity: 0.6,
	},
	card: {
		marginBottom: 16,
	},
	expiryText: {
		marginTop: 8,
	},
})
