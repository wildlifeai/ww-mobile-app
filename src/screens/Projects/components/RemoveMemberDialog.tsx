import { useState, useCallback, useMemo } from "react"
import { Alert } from "react-native"
import { Portal, Dialog, Button, Text, useTheme } from "react-native-paper"
import { removeProjectMember, ProjectMember } from "../../../services/UserRoleService"
// Removed UserContext import
import { log, logError } from "../../../utils/logger"

interface RemoveMemberDialogProps {
	projectId: string
	visible: boolean
	member: ProjectMember | null
	members: ProjectMember[]
	user: any | null
	onDismiss: () => void
	onSuccess: () => void
}

export const RemoveMemberDialog = ({ projectId, visible, member, members, user, onDismiss, onSuccess }: RemoveMemberDialogProps) => {
	const theme = useTheme()
	const [loading, setLoading] = useState(false)

	const handleRemoveMember = useCallback(async () => {
		if (!member || !user) return

		const adminCount = members.filter((m) => m.role === "project_admin").length
		const isLastAdmin = member.role === "project_admin" && adminCount === 1
		if (isLastAdmin) {
			Alert.alert("Cannot Remove", "Cannot remove the last project admin")
			return
		}

		setLoading(true)
		try {
			log(`➖ Removing member ${member.name}...`)
			const result = await removeProjectMember({
				project_id: projectId,
				user_id: member.id,
				removed_by: user.id,
			})
			if (!result.success) {
				Alert.alert("Error", result.error || "Failed to remove member")
				return
			}
			Alert.alert("Success", "Member removed successfully")
			onSuccess()
		} catch (err) {
			logError("❌ Error removing member:", err)
			Alert.alert("Error", "Failed to remove member")
		} finally {
			setLoading(false)
		}
	}, [member, user, members, projectId, onSuccess])

	const dynamicStyles = useMemo(() => ({
		bold: { fontWeight: 'bold' as const },
		errorText: { marginTop: 16, color: theme.colors.error },
	}), [theme])

	return (
		<Portal>
			<Dialog visible={visible} onDismiss={onDismiss}>
				<Dialog.Title><Text>Remove Member</Text></Dialog.Title>
				<Dialog.Content>
					{member && (
						<>
							<Text variant="bodyLarge">
								Are you sure you want to remove <Text style={dynamicStyles.bold}>{member.name}</Text> from this project?
							</Text>
							<Text variant="bodySmall" style={dynamicStyles.errorText}>
								This action cannot be undone. They will lose access to all project resources.
							</Text>
						</>
					)}
				</Dialog.Content>
				<Dialog.Actions>
					<Button onPress={onDismiss} disabled={loading}><Text>Cancel</Text></Button>
					<Button onPress={handleRemoveMember} mode="contained" buttonColor={theme.colors.error} loading={loading} disabled={loading}>
						<Text>Remove</Text>
					</Button>
				</Dialog.Actions>
			</Dialog>
		</Portal>
	)
}
