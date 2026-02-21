import { View, ScrollView, RefreshControl, Alert, StyleSheet } from "react-native"
import { WWScreenView } from "../../../components/ui/WWScreenView"
import { WWText } from "../../../components/ui/WWText"
import { Card, Button, Chip, useTheme, ActivityIndicator, Text } from "react-native-paper"
import { useState, useCallback } from "react"
import { useFocusEffect } from "@react-navigation/native"
import InvitationService from "../../../services/InvitationService"
import type ProjectInvitation from "../../../database/models/ProjectInvitation"
import { logError } from '../../../utils/logger'


export const Notifications = () => {
	const theme = useTheme()
	const [invitations, setInvitations] = useState<ProjectInvitation[]>([])
	const [loading, setLoading] = useState(false)
	const [refreshing, setRefreshing] = useState(false)
	const [processingId, setProcessingId] = useState<string | null>(null)

	const loadInvitations = useCallback(async () => {
		setLoading(true)
		try {
			// Sync first to get latest
			await InvitationService.syncInvitations()
			const pending = await InvitationService.getLocalPendingInvitations()
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

	const handleRespond = useCallback(async (invitationId: string, accept: boolean) => {
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
	}, [])

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
					Pending Invitations
				</WWText>

				{loading && !refreshing && invitations.length === 0 ? (
					<ActivityIndicator style={styles.loading} />
				) : invitations.length === 0 ? (
					<View style={styles.emptyContainer}>
						<WWText><Text>No pending invitations</Text></WWText>
					</View>
				) : (
					invitations.map((invite) => (
						<Card key={invite.id || invite.remoteId} style={styles.card}>
							<Card.Title
								title="Project Invitation"
								subtitle={`Role: ${invite.role === 'project_admin' ? 'Admin' : 'Member'}`}
								left={renderCardLeft}
							/>
							<Card.Content>
								<Text variant="bodyMedium">
									You have been invited to join a project.
								</Text>
								<Text variant="bodySmall" style={[styles.expiryText, { color: theme.colors.outline }]}>
									Expires: {new Date(invite.expiresAt).toLocaleDateString()}
								</Text>
							</Card.Content>
							<Card.Actions>
								<Button
									onPress={() => handleRespond(invite.remoteId, false)}
									disabled={processingId === invite.remoteId}
									textColor={theme.colors.error}
								>
									<Text>Decline</Text>
								</Button>
								<Button
									mode="contained"
									onPress={() => handleRespond(invite.remoteId, true)}
									disabled={processingId === invite.remoteId}
									loading={processingId === invite.remoteId}
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
