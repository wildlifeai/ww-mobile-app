import { useState, useCallback, useMemo, useEffect } from "react"
import { Alert, View, StyleSheet } from "react-native"
import { Portal, Dialog, Button, Text, Chip, IconButton, useTheme } from "react-native-paper"
import { updateProjectMemberRole, ProjectMember, ProjectRole } from "../../../services/UserRoleService"
// Removed UserContext import
import { log, logError } from "../../../utils/logger"

const getRoleBadgeColor = (role: ProjectRole): string => {
	switch (role) {
		case "project_admin": return "#4CAF50"
		case "project_member": return "#2196F3"
		default: return "#9E9E9E"
	}
}

const getRoleDisplayName = (role: ProjectRole): string => {
	switch (role) {
		case "project_admin": return "Admin"
		case "project_member": return "Member"
		default: return role
	}
}

const getRoleDescription = (role: ProjectRole): string => {
	switch (role) {
		case "project_admin": return "Can manage project, members, and deployments"
		case "project_member": return "Can create and manage deployments"
		default: return ""
	}
}

interface ChangeRoleDialogProps {
	projectId: string
	visible: boolean
	member: ProjectMember | null
	user: any | null
	onDismiss: () => void
	onSuccess: () => void
}

export const ChangeRoleDialog = ({ projectId, visible, member, user, onDismiss, onSuccess }: ChangeRoleDialogProps) => {
	const theme = useTheme()
	const [selectedRole, setSelectedRole] = useState<ProjectRole>("project_member")
	const [loading, setLoading] = useState(false)

	useEffect(() => {
		if (member && visible) {
			setSelectedRole(member.role === "project_admin" ? "project_member" : "project_admin")
		}
	}, [member, visible])

	const handleChangeRole = useCallback(async () => {
		if (!member || !user) return
		setLoading(true)
		try {
			log(`🔄 Changing role for ${member.name}...`)
			const result = await updateProjectMemberRole({
				project_id: projectId,
				user_id: member.id,
				new_role: selectedRole,
				updated_by: user.id,
			})
			if (!result.success) {
				Alert.alert("Error", result.error || "Failed to update role")
				return
			}
			Alert.alert("Success", "Role updated successfully")
			onSuccess()
		} catch (err) {
			logError("❌ Error changing role:", err)
			Alert.alert("Error", "Failed to update role")
		} finally {
			setLoading(false)
		}
	}, [member, user, projectId, selectedRole, onSuccess])

	const dynamicStyles = useMemo(() => ({
		dialogDesc: { marginBottom: 16 },
		bold: { fontWeight: 'bold' as const },
		roleLabelSub: { color: theme.colors.onSurfaceVariant },
		roleChip: { marginTop: 4 },
		roleMarginLarge: { marginTop: 16, color: theme.colors.onSurfaceVariant },
	}), [theme])

	return (
		<Portal>
			<Dialog visible={visible} onDismiss={onDismiss}>
				<Dialog.Title><Text>Change Member Role</Text></Dialog.Title>
				<Dialog.Content>
					{member && (
						<>
							<Text variant="bodyLarge" style={dynamicStyles.dialogDesc}>
								Change role for <Text style={dynamicStyles.bold}>{member.name}</Text>?
							</Text>
							<View style={styles.roleCompare}>
								<View>
									<Text variant="bodySmall" style={dynamicStyles.roleLabelSub}>Current:</Text>
									<Chip style={dynamicStyles.roleChip}>{getRoleDisplayName(member.role as ProjectRole)}</Chip>
								</View>
								<IconButton icon="arrow-right" />
								<View>
									<Text variant="bodySmall" style={dynamicStyles.roleLabelSub}>New:</Text>
									<Chip style={[dynamicStyles.roleChip, { backgroundColor: getRoleBadgeColor(selectedRole) + "20" }]}>
										{getRoleDisplayName(selectedRole)}
									</Chip>
								</View>
							</View>
							<Text variant="bodySmall" style={dynamicStyles.roleMarginLarge}>
								{getRoleDescription(selectedRole)}
							</Text>
						</>
					)}
				</Dialog.Content>
				<Dialog.Actions>
					<Button onPress={onDismiss} disabled={loading}><Text>Cancel</Text></Button>
					<Button onPress={handleChangeRole} mode="contained" loading={loading} disabled={loading}>
						<Text>Change Role</Text>
					</Button>
				</Dialog.Actions>
			</Dialog>
		</Portal>
	)
}

const styles = StyleSheet.create({
	roleCompare: { flexDirection: "row", alignItems: "center", justifyContent: "center", marginTop: 8 },
})
