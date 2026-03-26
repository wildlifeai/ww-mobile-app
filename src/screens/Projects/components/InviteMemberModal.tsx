import { useState, useCallback, useMemo } from "react"
import { Alert, StyleSheet, ScrollView, View } from "react-native"
import { Modal, Appbar, Button, Text, SegmentedButtons, useTheme, Portal } from "react-native-paper"
import { WWTextInput } from "../../../components/ui/WWTextInput"
import InvitationService from "../../../services/InvitationService"
import { ProjectRole } from "../../../services/UserRoleService"
// Removed UserContext import
import { log, logError } from "../../../utils/logger"

// Reused UI Helper Functions
const getRoleDescription = (role: ProjectRole): string => {
	switch (role) {
		case "project_admin":
			return "Can manage project, members, and deployments"
		case "project_member":
			return "Can create and manage deployments"
		default:
			return ""
	}
}

interface InviteMemberModalProps {
	projectId: string
	visible: boolean
	onDismiss: () => void
	onSuccess: () => void
	user: any | null
}

export const InviteMemberModal = ({ projectId, visible, onDismiss, onSuccess, user }: InviteMemberModalProps) => {
	const theme = useTheme()
	const [inviteEmail, setInviteEmail] = useState("")
	const [inviteRole, setInviteRole] = useState<ProjectRole>("project_member")
	const [loading, setLoading] = useState(false)

	const handleInviteMember = useCallback(async () => {
		if (!inviteEmail.trim()) {
			Alert.alert("Error", "Please enter an email address")
			return
		}
		if (!user) {
			Alert.alert("Error", "User authentication required")
			return
		}

		setLoading(true)
		try {
			log(`📧 Inviting ${inviteEmail}...`)
			await InvitationService.sendInvitation(
				projectId,
				inviteEmail.trim(),
				inviteRole as "project_admin" | "project_member"
			)
			Alert.alert("Success", "Invitation sent successfully")
			onSuccess()
			setInviteEmail("")
			setInviteRole("project_member")
		} catch (err: any) {
			logError("❌ Error sending invitation:", err)
			Alert.alert("Error", err.message || "Failed to send invitation")
		} finally {
			setLoading(false)
		}
	}, [inviteEmail, user, projectId, inviteRole, onSuccess])

	const dynamicStyles = useMemo(() => ({
		modalBg: { backgroundColor: theme.colors.background },
		modalPadding: { flex: 1, padding: 16 },
		modalDesc: { marginBottom: 16 },
		inputMargin: { marginBottom: 24 },
		roleHint: { marginTop: 8, color: theme.colors.onSurfaceVariant },
	}), [theme])

	return (
		<Portal>
			<Modal visible={visible} onDismiss={onDismiss} contentContainerStyle={[styles.modalContainer, dynamicStyles.modalBg]}>
				<Appbar.Header>
					<Appbar.BackAction onPress={onDismiss} />
					<Appbar.Content title="Invite Member" />
					<Button
						onPress={handleInviteMember}
						disabled={!inviteEmail.trim() || loading}
						mode="contained"
						style={styles.headerButton}
						loading={loading}
					>
						<Text>Send Invite</Text>
					</Button>
				</Appbar.Header>

				<ScrollView style={dynamicStyles.modalPadding}>
					<Text variant="bodyMedium" style={dynamicStyles.modalDesc}>
						Enter the email address of the user you want to invite to this project.
					</Text>
					<WWTextInput
						label="Email Address"
						value={inviteEmail}
						onChange={setInviteEmail}
						keyboardType="email-address"
						autoCapitalize="none"
						autoCorrect={false}
						style={dynamicStyles.inputMargin}
					/>
					<View style={styles.roleSelectionSection}>
						<Text variant="titleMedium" style={styles.roleLabel}>Role:</Text>
						<SegmentedButtons
							value={inviteRole}
							onValueChange={(value) => setInviteRole(value as ProjectRole)}
							buttons={[
								{
									value: "project_member", label: "Member", icon: "account",
									labelStyle: { color: "#FFFFFF" },
									uncheckedColor: "#FFFFFF", checkedColor: "#FFFFFF",
								},
								{
									value: "project_admin", label: "Admin", icon: "shield-account",
									labelStyle: { color: "#FFFFFF" },
									uncheckedColor: "#FFFFFF", checkedColor: "#FFFFFF",
								},
							]}
							style={styles.segmentedButtons}
						/>
						<Text variant="bodySmall" style={dynamicStyles.roleHint}>{getRoleDescription(inviteRole)}</Text>
					</View>
				</ScrollView>
			</Modal>
		</Portal>
	)
}

const styles = StyleSheet.create({
	modalContainer: { flex: 1 },
	headerButton: { marginRight: 8, borderRadius: 8 },
	roleSelectionSection: { marginTop: 8 },
	roleLabel: { marginBottom: 16 },
	segmentedButtons: {},
})
