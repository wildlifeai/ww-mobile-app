import React, { useState, useCallback } from 'react'
import { Alert } from 'react-native'
import { Card, Text, SegmentedButtons, Button } from 'react-native-paper'
import { WWTextInput } from '../../../components/ui/WWTextInput'
import InvitationService from '../../../services/InvitationService'
import { isKnownOffline } from '../../../services/connectivityWatch'
import { log, logError } from '../../../utils/logger'
import { ProjectRole } from '../../../services/UserRoleService'
import { useAppSelector } from '../../../redux'
import { selectCurrentUser } from '../../../redux/slices/authSlice'

interface Props {
	projectId: string
	onInviteSent: () => void
	styles: any
}

export const InviteMemberCard: React.FC<Props> = ({ projectId, onInviteSent, styles }) => {
	const user = useAppSelector(selectCurrentUser)
	const [inviteEmail, setInviteEmail] = useState("")
	const [inviteRole, setInviteRole] = useState<ProjectRole>("project_member")
	const [inviteLoading, setInviteLoading] = useState(false)

	const handleInviteMember = useCallback(async () => {
		if (!inviteEmail.trim()) {
			Alert.alert("Error", "Please enter an email address")
			return
		}
		if (!user) {
			Alert.alert("Error", "User authentication required")
			return
		}
		// An invitation is made on the server (send_project_invitation), so it
		// is not queued for later: say so rather than send a call that must fail.
		// Asked at the tap rather than followed, because the banner is the one
		// thing that subscribes to the connection.
		if (await isKnownOffline()) {
			Alert.alert(
				"No connection",
				"Inviting someone needs a connection. Try again when you are online."
			)
			return
		}

		setInviteLoading(true)
		try {
			log(`📧 Inviting ${inviteEmail}...`)
			await InvitationService.sendInvitation(
				projectId,
				inviteEmail.trim(),
				inviteRole as "project_admin" | "project_member"
			)
			// The same words whether or not the address has an account, so the
			// screen cannot be used to find out who has one (#308)
			Alert.alert(
				"Invitation sent",
				"If they have a Wildlife Watcher account, they will see it in Notifications. If not, they will see it once they create an account with this email address."
			)
			setInviteEmail("")
			setInviteRole("project_member")
			onInviteSent()
		} catch (err: any) {
			logError("❌ Error sending invitation:", err)
			// 23505 is the one-pending-invitation-per-email index, not an account lookup
			const message = err?.code === "23505"
				? "This email address already has a pending invitation to this project."
				: err.message || "Failed to send invitation"
			Alert.alert("Error", message)
		} finally {
			setInviteLoading(false)
		}
	}, [inviteEmail, user, projectId, inviteRole, onInviteSent])

	return (
		<Card style={styles.inviteCard} mode="contained">
			<Card.Title title="Invite Member" />
			<Card.Content>
				<Text variant="bodyMedium" style={styles.inviteDesc}>
					Enter the email address of the user you want to invite to this project.
				</Text>
				<WWTextInput
					label="Email Address"
					value={inviteEmail}
					onChange={setInviteEmail}
					keyboardType="email-address"
					autoCapitalize="none"
					autoCorrect={false}
					// Someone else's address, not a sign-in: without these Android
					// offers the phone's saved logins here (#363)
					autoComplete="off"
					importantForAutofill="no"
					textContentType="none"
					style={styles.inviteInput}
				/>
				<Text variant="titleSmall" style={styles.roleLabel}>Role:</Text>
				<SegmentedButtons
					value={inviteRole}
					onValueChange={(value) => setInviteRole(value as ProjectRole)}
					buttons={[
						{ value: "project_member", label: "Member", icon: "account" },
						{ value: "project_admin", label: "Admin", icon: "shield-account" },
					]}
					style={styles.segmentedButtons}
				/>
				<Button
					onPress={handleInviteMember}
					disabled={!inviteEmail.trim() || inviteLoading}
					mode="contained"
					style={styles.sendInviteButton}
					loading={inviteLoading}
				>
					<Text>Send Invite</Text>
				</Button>
			</Card.Content>
		</Card>
	)
}
