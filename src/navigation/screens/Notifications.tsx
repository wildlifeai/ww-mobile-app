import { View, ScrollView, RefreshControl, Alert } from "react-native"
import { WWScreenView } from "../../components/ui/WWScreenView"
import { WWText } from "../../components/ui/WWText"
import { Card, Button, Chip, useTheme, ActivityIndicator, Text } from "react-native-paper"
import { useState, useCallback } from "react"
import { useFocusEffect } from "@react-navigation/native"
import InvitationService from "../../services/InvitationService"
import type ProjectInvitation from "../../database/models/ProjectInvitation"

export const Notifications = () => {
	const theme = useTheme()
	const [invitations, setInvitations] = useState<ProjectInvitation[]>([])
	const [loading, setLoading] = useState(false)
	const [refreshing, setRefreshing] = useState(false)
	const [processingId, setProcessingId] = useState<string | null>(null)

	const loadInvitations = async () => {
		setLoading(true)
		try {
			// Sync first to get latest
			await InvitationService.syncInvitations()
			const pending = await InvitationService.getLocalPendingInvitations()
			setInvitations(pending)
		} catch (error) {
			console.error("Failed to load invitations:", error)
		} finally {
			setLoading(false)
		}
	}

	useFocusEffect(
		useCallback(() => {
			loadInvitations()
		}, [])
	)

	const onRefresh = async () => {
		setRefreshing(true)
		await loadInvitations()
		setRefreshing(false)
	}

	const handleRespond = async (invitationId: string, accept: boolean) => {
		setProcessingId(invitationId)
		try {
			await InvitationService.respondToInvitation(invitationId, accept)
			Alert.alert("Success", `Invitation ${accept ? "accepted" : "declined"}`)
			// Refresh list
			const pending = await InvitationService.getLocalPendingInvitations()
			setInvitations(pending)
		} catch (error: any) {
			Alert.alert("Error", error.message || "Failed to respond to invitation")
		} finally {
			setProcessingId(null)
		}
	}

	return (
		<WWScreenView>
			<ScrollView
				refreshControl={
					<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
				}
				contentContainerStyle={{ padding: 16 }}
			>
				<WWText variant="titleMedium" style={{ marginBottom: 16 }}>
					Pending Invitations
				</WWText>

				{loading && !refreshing && invitations.length === 0 ? (
					<ActivityIndicator style={{ marginTop: 20 }} />
				) : invitations.length === 0 ? (
					<View style={{ alignItems: "center", marginTop: 40, opacity: 0.6 }}>
						<WWText>No pending invitations</WWText>
					</View>
				) : (
					invitations.map((invite) => (
						<Card key={invite.id || invite.remoteId} style={{ marginBottom: 16 }}>
							<Card.Title
								title="Project Invitation"
								subtitle={`Role: ${invite.role === 'project_admin' ? 'Admin' : 'Member'}`}
								left={(props) => <Chip icon="email-outline" {...props} onPress={() => { }}>Invite</Chip>}
							/>
							<Card.Content>
								<Text variant="bodyMedium">
									You have been invited to join a project.
								</Text>
								<Text variant="bodySmall" style={{ marginTop: 8, color: theme.colors.outline }}>
									Expires: {new Date(invite.expiresAt).toLocaleDateString()}
								</Text>
							</Card.Content>
							<Card.Actions>
								<Button
									onPress={() => handleRespond(invite.remoteId, false)}
									disabled={processingId === invite.remoteId}
									textColor={theme.colors.error}
								>
									Decline
								</Button>
								<Button
									mode="contained"
									onPress={() => handleRespond(invite.remoteId, true)}
									disabled={processingId === invite.remoteId}
									loading={processingId === invite.remoteId}
								>
									Accept
								</Button>
							</Card.Actions>
						</Card>
					))
				)}
			</ScrollView>
		</WWScreenView>
	)
}
