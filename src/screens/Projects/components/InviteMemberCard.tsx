import React, { useState, useCallback } from 'react'
import { Alert } from 'react-native'
import { Card, Text, SegmentedButtons, Button } from 'react-native-paper'
import { WWTextInput } from '../../../components/ui/WWTextInput'
import InvitationService from '../../../services/InvitationService'
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

		setInviteLoading(true)
		try {
			log(`📧 Inviting ${inviteEmail}...`)
			await InvitationService.sendInvitation(
				projectId,
				inviteEmail.trim(),
				inviteRole as "project_admin" | "project_member"
			)
			Alert.alert("Success", "Invitation sent successfully")
			setInviteEmail("")
			setInviteRole("project_member")
			onInviteSent()
		} catch (err: any) {
			logError("❌ Error sending invitation:", err)
			Alert.alert("Error", err.message || "Failed to send invitation")
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
