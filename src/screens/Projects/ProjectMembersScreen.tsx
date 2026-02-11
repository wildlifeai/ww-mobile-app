/**
 * Project Members Screen
 *
 * Displays list of project members with role management capabilities
 * - View all project members
 * - Add new members from organization user pool
 * - Change member roles (admin ↔ member)
 * - Remove members from project
 *
 * Permissions:
 * - All project members can view member list
 * - Only project admins can add/remove/change roles
 */

import { useState, useEffect, useCallback, useMemo } from "react"
import {
	View,
	ScrollView,
	StyleSheet,
	RefreshControl,
	Alert,
	Modal,
	SafeAreaView,
} from "react-native"
import { WWTextInput } from "../../components/ui/WWTextInput"
import {

	Card,
	Text,
	Button,
	Avatar,
	Chip,
	IconButton,
	Menu,
	Divider,
	Portal,
	Dialog,
	ActivityIndicator,
	Appbar,
	SegmentedButtons,
	useTheme,
} from "react-native-paper"
import { useRoute, RouteProp } from "@react-navigation/native"

// UI Helper Functions
const getRoleBadgeColor = (role: ProjectRole): string => {
	switch (role) {
		case "project_admin":
			return "#4CAF50"
		case "project_member":
			return "#2196F3"
		default:
			return "#9E9E9E"
	}
}

const getRoleDisplayName = (role: ProjectRole): string => {
	switch (role) {
		case "project_admin":
			return "Admin"
		case "project_member":
			return "Member"
		default:
			return role
	}
}

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

// Real service imports
import {
	getProjectMembers,
	updateProjectMemberRole,
	removeProjectMember,
} from "../../services/UserRoleService"
import { useAppSelector } from "../../redux"
import {
	selectCurrentUser,
} from "../../redux/slices/authSlice"

import type {
	ProjectMember,
	ProjectRole,
} from "../../services/UserRoleService"
import InvitationService from "../../services/InvitationService"
import type ProjectInvitation from "../../database/models/ProjectInvitation"
import { log, logError } from '../../utils/logger'


type RouteParams = {
	params: {
		projectId: string
		projectName: string
	}
}

export const ProjectMembersScreen = () => {
	const route =
		useRoute<RouteProp<{ params: RouteParams["params"] }, "params">>()
	const theme = useTheme()

	const { projectId, projectName } = route.params || {}

	// Redux selectors
	const user = useAppSelector(selectCurrentUser)

	// State
	const [members, setMembers] = useState<ProjectMember[]>([])
	const [loading, setLoading] = useState(false)
	const [refreshing, setRefreshing] = useState(false)

	// Dialogs
	const [showAddMemberDialog, setShowAddMemberDialog] = useState(false)
	const [showRoleChangeDialog, setShowRoleChangeDialog] = useState(false)
	const [showRemoveDialog, setShowRemoveDialog] = useState(false)
	const [selectedMember, setSelectedMember] = useState<ProjectMember | null>(
		null,
	)
	const [selectedRole, setSelectedRole] =
		useState<ProjectRole>("project_member")

	// Invite member dialog state
	const [inviteEmail, setInviteEmail] = useState("")
	const [inviteRole, setInviteRole] = useState<ProjectRole>("project_member")
	const [pendingInvitations, setPendingInvitations] = useState<ProjectInvitation[]>([])

	// Menu state (for individual member actions)
	const [menuVisible, setMenuVisible] = useState<{ [key: string]: boolean }>({})

	// Permission checks
	const currentUserProjectRole = members.find((m) => m.id === user?.id)?.role
	const canManageMembers =
		user &&
		(currentUserProjectRole === "project_admin" || user.role === "ww_admin")

	const loadMembers = useCallback(async () => {
		if (!user) {
			logError("❌ Missing user context")
			Alert.alert("Error", "User authentication required")
			return
		}

		setLoading(true)
		try {
			log("📋 Loading members for project:", projectId)

			// Load project members (with authorization handling)
			try {
				const rawMembers = await getProjectMembers(projectId, user!.id)
				
				// Enrich members with current user info if missing
				const enrichedMembers = rawMembers.map(m => {
					const isMe = String(m.id).toLowerCase() === String(user!.id).toLowerCase()
					if (isMe) {
						if (!m.name || m.name === "Unknown User" || m.name === "Me") {
							// Try various property names that might be in Redux
							const profile = user!.profile as any
							const fName = profile?.first_name || profile?.firstname || ""
							const lName = profile?.last_name || profile?.surname || ""
							const pName = `${fName} ${lName}`.trim()
							
							return {
								...m,
								name: pName ? `${pName} (You)` : "Me (You)",
								firstname: fName || m.firstname,
								surname: lName || m.surname,
								email: user!.email || m.email
							}
						}
					}
					return m
				})

				setMembers(enrichedMembers)
				log(`✅ Loaded ${enrichedMembers.length} project members`)
			} catch (error: any) {
				if (error?.message?.includes("Unauthorized")) {
					// User not authorized to view members - show empty list
					log("⚠️ User not authorized to view project members")
					setMembers([])

					return
				}
				throw error // Re-throw other errors
			}

			// Load pending invitations
			const pending = await InvitationService.getProjectPendingInvitations(projectId)
			setPendingInvitations(pending)
		} catch (error) {
			logError("❌ Error loading members:", error)
			Alert.alert("Error", "Failed to load project members")
		} finally {
			setLoading(false)
		}
	}, [projectId, user])

	// Load data
	useEffect(() => {
		loadMembers()
	}, [loadMembers])

	const handleRefresh = useCallback(async () => {
		setRefreshing(true)
		await loadMembers()
		setRefreshing(false)
	}, [loadMembers])

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

			// Send invitation
			await InvitationService.sendInvitation(
				projectId,
				inviteEmail.trim(),
				inviteRole as "project_admin" | "project_member"
			)

			Alert.alert("Success", "Invitation sent successfully")

			// Refresh lists
			await loadMembers()

			// Reset form
			setShowAddMemberDialog(false)
			setInviteEmail("")
			setInviteRole("project_member")
		} catch (err: any) {
			logError("❌ Error sending invitation:", err)
			Alert.alert("Error", err.message || "Failed to send invitation")
		} finally {
			setLoading(false)
		}
	}, [inviteEmail, user, projectId, inviteRole, loadMembers])



	const handleChangeRole = useCallback(async () => {
		if (!selectedMember || !user) return

		setLoading(true)
		try {
			log(`🔄 Changing role for ${selectedMember.name}...`)

			const result = await updateProjectMemberRole({
				project_id: projectId,
				user_id: selectedMember.id,
				new_role: selectedRole,
				updated_by: user.id,
			})

			if (!result.success) {
				Alert.alert("Error", result.error || "Failed to update role")
				return
			}

			// Refresh member list
			await loadMembers()

			Alert.alert("Success", "Role updated successfully")
			setShowRoleChangeDialog(false)
			setSelectedMember(null)
		} catch (err) {
			logError("❌ Error changing role:", err)
			Alert.alert("Error", "Failed to update role")
		} finally {
			setLoading(false)
		}
	}, [selectedMember, user, projectId, selectedRole, loadMembers])

	const handleRemoveMember = useCallback(async () => {
		if (!selectedMember || !user) return

		// Check if this is the last admin
		const adminCount = members.filter((m) => m.role === "project_admin").length
		const isLastAdmin =
			selectedMember.role === "project_admin" && adminCount === 1

		if (isLastAdmin) {
			Alert.alert("Cannot Remove", "Cannot remove the last project admin")
			return
		}

		setLoading(true)
		try {
			log(`➖ Removing member ${selectedMember.name}...`)

			const result = await removeProjectMember({
				project_id: projectId,
				user_id: selectedMember.id,
				removed_by: user.id,
			})

			if (!result.success) {
				Alert.alert("Error", result.error || "Failed to remove member")
				return
			}

			// Refresh member list
			await loadMembers()

			Alert.alert("Success", "Member removed successfully")
			setShowRemoveDialog(false)
			setSelectedMember(null)
		} catch (err) {
			logError("❌ Error removing member:", err)
			Alert.alert("Error", "Failed to remove member")
		} finally {
			setLoading(false)
		}
	}, [selectedMember, user, members, projectId, loadMembers])

	const openMenu = useCallback((memberId: string) => {
		setMenuVisible({ [memberId]: true })
	}, [])

	const closeMenu = useCallback((memberId: string) => {
		setMenuVisible({ [memberId]: false })
	}, [])

	const handleMenuChangeRole = useCallback((member: ProjectMember) => {
		setSelectedMember(member)
		setSelectedRole(
			member.role === "project_admin" ? "project_member" : "project_admin",
		)
		setShowRoleChangeDialog(true)
		closeMenu(member.id)
	}, [closeMenu])

	const handleMenuRemove = useCallback((member: ProjectMember) => {
		setSelectedMember(member)
		setShowRemoveDialog(true)
		closeMenu(member.id)
	}, [closeMenu])



	const dynamicStyles = useMemo(() => ({
		loadingText: { marginTop: 16 },
		subtitleColor: { color: theme.colors.onSurfaceVariant },
		subtitlePlus: { color: theme.colors.onSurfaceVariant, marginTop: 4 },
		inviteSection: { paddingHorizontal: 16, marginBottom: 8 },
		inviteTitle: { marginBottom: 8, color: theme.colors.onSurfaceVariant },
		inviteCard: { marginBottom: 8, backgroundColor: theme.colors.surfaceVariant },
		inviteContent: { flexDirection: 'row' as const, justifyContent: 'space-between' as const, alignItems: 'center' as const, paddingVertical: 8 },
		inviteEmail: { fontWeight: 'bold' as const },
		inviteDivider: { marginVertical: 8 },
		memberSurface: { color: theme.colors.onSurface },
		memberSurfaceVariant: { color: theme.colors.onSurfaceVariant },
		chipText: { fontSize: 12 },
		chipStyle: { marginTop: 8, alignSelf: 'flex-start' as const },
		modalBg: { backgroundColor: theme.colors.background },
		modalPadding: { flex: 1, padding: 16 },
		modalDesc: { marginBottom: 16 },
		inputMargin: { marginBottom: 24 },
		roleHint: { marginTop: 8, color: theme.colors.onSurfaceVariant },
		dialogDesc: { marginBottom: 16 },
		bold: { fontWeight: 'bold' as const },
		roleLabelSub: { color: theme.colors.onSurfaceVariant },
		roleChip: { marginTop: 4 },
		roleMarginLarge: { marginTop: 16, color: theme.colors.onSurfaceVariant },
		errorText: { marginTop: 16, color: theme.colors.error },
	}), [theme])

	if (loading && members.length === 0) {
		return (
			<View style={styles.loadingContainer}>
				<ActivityIndicator size="large" />
				<Text style={dynamicStyles.loadingText}>Loading project members...</Text>
			</View>
		)
	}

	return (
		<View style={styles.container}>
			{/* Header */}
			<View style={styles.header}>
				<Text variant="headlineSmall" style={styles.headerTitle}>
					Project Members
				</Text>
				<Text
					variant="bodyMedium"
					style={[
						styles.headerSubtitle,
						dynamicStyles.subtitleColor,
					]}
				>
					{projectName}
				</Text>
				<Text
					variant="bodySmall"
					style={dynamicStyles.subtitlePlus}
				>
					{members.length} {members.length === 1 ? "member" : "members"}
				</Text>
			</View>

			{/* Add Member Button (admin only) */}
			{canManageMembers && (
				<View style={styles.actionButtonContainer}>
					<Button
						mode="contained"
						icon="account-plus"
						onPress={() => setShowAddMemberDialog(true)}
						style={styles.addButton}
					>
						Add Member
					</Button>
				</View>
			)}

			{/* Pending Invitations List (Admin Only) */}
			{canManageMembers && pendingInvitations.length > 0 && (
				<View style={dynamicStyles.inviteSection}>
					<Text variant="titleSmall" style={dynamicStyles.inviteTitle}>
						Pending Invitations ({pendingInvitations.length})
					</Text>
					{pendingInvitations.map((invite) => (
						<Card key={invite.id || invite.remoteId} style={dynamicStyles.inviteCard}>
							<Card.Content style={dynamicStyles.inviteContent}>
								<View>
									<Text variant="bodyMedium" style={dynamicStyles.inviteEmail}>{invite.inviteeEmail}</Text>
									<Text variant="bodySmall">{getRoleDisplayName(invite.role as ProjectRole)} • Expires {new Date(invite.expiresAt).toLocaleDateString()}</Text>
								</View>
								<Chip icon="clock-outline" compact>Pending</Chip>
							</Card.Content>
						</Card>
					))}
					<Divider style={dynamicStyles.inviteDivider} />
				</View>
			)}

			{/* Member List */}
			<ScrollView
				style={styles.memberList}
				refreshControl={
					<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
				}
			>
				{members.map((member) => {
					const adminCount = members.filter(
						(m) => m.role === "project_admin",
					).length
					const isLastAdmin =
						member.role === "project_admin" && adminCount === 1
					const canRemove = !isLastAdmin

					const isMe = user && String(member.id).toLowerCase() === String(user.id).toLowerCase()

					const firstName = member.firstname || ""
					const surname = member.surname || ""
					const memberName = member.name || ""

					const displayName = (firstName || surname)
						? `${firstName} ${surname}`.trim()
						: (memberName && memberName !== "Unknown" && memberName !== "Unknown User"
							? memberName
							: (isMe ? "Me (You)" : (member.email || "Unknown User")))

					const initials = displayName
						.split(" ")
						.filter((n) => n.length > 0)
						.map((n) => n[0])
						.join("")
						.toUpperCase()
						.substring(0, 2)

					return (
						<Card key={member.id} style={styles.memberCard}>
							<Card.Content>
								<View style={styles.memberRow}>
									{/* Avatar */}
									<Avatar.Text
										size={48}
										label={initials}
										style={{ backgroundColor: getRoleBadgeColor(member.role as ProjectRole) }}
									/>

									{/* Member Info */}
									<View style={styles.memberInfo}>
										<Text
											variant="titleMedium"
											style={dynamicStyles.memberSurface}
										>
											{displayName}
										</Text>
										{member.email && member.email !== displayName && (
											<Text
												variant="bodySmall"
												style={dynamicStyles.memberSurfaceVariant}
											>
												{member.email}
											</Text>
										)}
										<Chip
											mode="flat"
											textStyle={dynamicStyles.chipText}
											style={[
												dynamicStyles.chipStyle,
												{ backgroundColor: getRoleBadgeColor(member.role as ProjectRole) + "20" }
											]}
										>
											{getRoleDisplayName(member.role as ProjectRole)}
										</Chip>
									</View>

									{/* Actions Menu (admin only) */}
									{canManageMembers && (
										<Menu
											visible={menuVisible[member.id] || false}
											onDismiss={() => closeMenu(member.id)}
											anchor={
												<IconButton
													icon="dots-vertical"
													onPress={() => openMenu(member.id)}
												/>
											}
										>
											<Menu.Item
												leadingIcon="account-convert"
												onPress={() => handleMenuChangeRole(member)}
												title={
													member.role === "project_admin"
														? "Change to Member"
														: "Promote to Admin"
												}
											/>
											{canRemove && (
												<>
													<Divider />
													<Menu.Item
														leadingIcon="account-remove"
														onPress={() => handleMenuRemove(member)}
														title="Remove from Project"
														titleStyle={{ color: theme.colors.error }}
													/>
												</>
											)}
											{!canRemove && isLastAdmin && (
												<Menu.Item
													disabled
													leadingIcon="shield-account"
													title="Last Admin (Cannot Remove)"
												/>
											)}
										</Menu>
									)}
								</View>
							</Card.Content>
						</Card>
					)
				})}
			</ScrollView>

			{/* Add Member Full-Screen Modal */}
			<Modal
				visible={showAddMemberDialog}
				animationType="slide"
				onRequestClose={() => setShowAddMemberDialog(false)}
			>
				<SafeAreaView
					style={[
						styles.modalContainer,
						dynamicStyles.modalBg,
					]}
				>
					{/* Header with back button */}
					<Appbar.Header>
						<Appbar.BackAction onPress={() => setShowAddMemberDialog(false)} />
						<Appbar.Content title="Invite Member" />
						<Button
							onPress={handleInviteMember}
							disabled={!inviteEmail.trim() || loading}
							mode="contained"
							style={styles.headerButton}
							loading={loading}
						>
							Send Invite
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

						{/* Role Selection with Segmented Buttons - GREEN THEME */}
						<View style={styles.roleSelectionSection}>
							<Text variant="titleMedium" style={styles.roleLabel}>
								Role:
							</Text>
							<SegmentedButtons
								value={inviteRole}
								onValueChange={(value) =>
									setInviteRole(value as ProjectRole)
								}
								buttons={[
									{
										value: "project_member",
										label: "Member",
										icon: "account",
										style: { borderColor: "#4CAF50" },
										labelStyle: { color: "#FFFFFF" },
										uncheckedColor: "#FFFFFF",
										checkedColor: "#FFFFFF",
									},
									{
										value: "project_admin",
										label: "Admin",
										icon: "shield-account",
										style: { borderColor: "#4CAF50" },
										labelStyle: { color: "#FFFFFF" },
										uncheckedColor: "#FFFFFF",
										checkedColor: "#FFFFFF",
									},
								]}
								theme={{
									colors: {
										secondaryContainer: "#4CAF50",
										onSecondaryContainer: "#FFFFFF",
										outline: "#4CAF50",
									},
								}}
								style={styles.segmentedButtons}
							/>
							<Text variant="bodySmall" style={dynamicStyles.roleHint}>
								{getRoleDescription(inviteRole)}
							</Text>
						</View>
					</ScrollView>
				</SafeAreaView>
			</Modal>

			{/* Change Role Dialog */}
			<Portal>
				<Dialog
					visible={showRoleChangeDialog}
					onDismiss={() => setShowRoleChangeDialog(false)}
				>
					<Dialog.Title>Change Member Role</Dialog.Title>
					<Dialog.Content>
						{selectedMember && (
							<>
								<Text variant="bodyLarge" style={dynamicStyles.dialogDesc}>
									Change role for{" "}
									<Text style={dynamicStyles.bold}>
										{selectedMember.name}
									</Text>
									?
								</Text>
								<View style={styles.roleCompare}>
									<View>
										<Text
											variant="bodySmall"
											style={dynamicStyles.roleLabelSub}
										>
											Current:
										</Text>
										<Chip style={dynamicStyles.roleChip}>
											{getRoleDisplayName(selectedMember.role as ProjectRole)}
										</Chip>
									</View>
									<IconButton icon="arrow-right" />
									<View>
										<Text
											variant="bodySmall"
											style={dynamicStyles.roleLabelSub}
										>
											New:
										</Text>
										<Chip
											style={[
												dynamicStyles.roleChip,
												{ backgroundColor: getRoleBadgeColor(selectedRole) + "20" }
											]}
										>
											{getRoleDisplayName(selectedRole)}
										</Chip>
									</View>
								</View>
								<Text
									variant="bodySmall"
									style={dynamicStyles.roleMarginLarge}
								>
									{getRoleDescription(selectedRole)}
								</Text>
							</>
						)}
					</Dialog.Content>
					<Dialog.Actions>
						<Button onPress={() => setShowRoleChangeDialog(false)}>
							Cancel
						</Button>
						<Button onPress={handleChangeRole} mode="contained">
							Change Role
						</Button>
					</Dialog.Actions>
				</Dialog>
			</Portal>

			{/* Remove Member Dialog */}
			<Portal>
				<Dialog
					visible={showRemoveDialog}
					onDismiss={() => setShowRemoveDialog(false)}
				>
					<Dialog.Title>Remove Member</Dialog.Title>
					<Dialog.Content>
						{selectedMember && (
							<>
								<Text variant="bodyLarge">
									Are you sure you want to remove{" "}
									<Text style={dynamicStyles.bold}>
										{selectedMember.name}
									</Text>{" "}
									from this project?
								</Text>
								<Text
									variant="bodySmall"
									style={dynamicStyles.errorText}
								>
									This action cannot be undone. They will lose access to all
									project resources.
								</Text>
							</>
						)}
					</Dialog.Content>
					<Dialog.Actions>
						<Button onPress={() => setShowRemoveDialog(false)}>Cancel</Button>
						<Button
							onPress={handleRemoveMember}
							mode="contained"
							buttonColor={theme.colors.error}
						>
							Remove
						</Button>
					</Dialog.Actions>
				</Dialog>
			</Portal>
		</View>
	)
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
	},
	loadingContainer: {
		flex: 1,
		justifyContent: "center",
		alignItems: "center",
	},
	header: {
		padding: 16,
	},
	headerTitle: {
		fontWeight: "bold",
	},
	headerSubtitle: {
		marginTop: 4,
	},
	actionButtonContainer: {
		paddingHorizontal: 16,
		paddingBottom: 8,
	},
	addButton: {
		borderRadius: 8,
	},
	memberList: {
		flex: 1,
		padding: 16,
	},
	memberCard: {
		marginBottom: 12,
		elevation: 2,
	},
	memberRow: {
		flexDirection: "row",
		alignItems: "center",
	},
	memberInfo: {
		flex: 1,
		marginLeft: 16,
	},
	roleCompare: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-around",
		marginTop: 8,
	},
	// Add Member Dialog Styles
	dialog: {
		maxHeight: "85%",
	},
	dialogContent: {
		paddingHorizontal: 0,
		paddingTop: 0,
	},
	searchSection: {
		backgroundColor: "#F5F5F5",
		padding: 16,
		borderRadius: 8,
		marginBottom: 16,
		marginHorizontal: 24,
	},
	searchBar: {
		elevation: 0,
		backgroundColor: "#FFFFFF",
	},
	searchInput: {
		fontSize: 14,
		color: "#000000",
		minHeight: 0,
	},
	roleSelectionTop: {
		paddingHorizontal: 24,
		paddingTop: 8,
	},
	roleTopLabel: {
		fontWeight: "600",
		marginBottom: 4,
	},
	roleOptionsHorizontal: {
		flexDirection: "row",
		gap: 0,
	},
	roleOptionCompact: {
		flex: 1,
		paddingVertical: 0,
	},
	userList: {
		maxHeight: 200,
		paddingHorizontal: 24,
	},
	emptyState: {
		paddingVertical: 32,
		alignItems: "center",
	},
	emptyText: {
		textAlign: "center",
		color: "#999",
		fontSize: 14,
	},
	userItem: {
		flexDirection: "row",
		alignItems: "center",
		paddingVertical: 12,
		paddingHorizontal: 8,
		borderRadius: 8,
		marginBottom: 4,
	},
	userItemSelected: {
		backgroundColor: "#E3F2FD",
	},
	userItemContent: {
		flex: 1,
		marginLeft: 8,
	},
	userName: {
		fontWeight: "500",
		marginBottom: 2,
	},
	userEmail: {
		color: "#666",
		fontSize: 13,
	},
	roleSection: {
		marginTop: 16,
		paddingHorizontal: 24,
	},
	roleSectionTitle: {
		fontWeight: "600",
		marginBottom: 8,
	},
	roleOptions: {
		gap: 0,
	},
	roleOption: {
		paddingVertical: 4,
	},
	// Full-Screen Modal Styles
	modalContainer: {
		flex: 1,
	},
	headerButton: {
		marginRight: 8,
	},
	roleSelectionSection: {
		paddingHorizontal: 16,
		paddingTop: 16,
		paddingBottom: 12,
	},
	roleLabel: {
		fontWeight: "600",
		marginBottom: 12,
	},
	segmentedButtons: {},
	searchContainer: {
		paddingHorizontal: 16,
		paddingVertical: 8,
	},
	searchBarFull: {
		elevation: 2,
		backgroundColor: "#FFFFFF",
	},
	selectAllContainer: {
		flexDirection: "row",
		alignItems: "center",
		paddingHorizontal: 16,
		paddingVertical: 8,
	},
	selectAllText: {
		marginLeft: 8,
		fontWeight: "600",
	},
	selectionBanner: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
		paddingHorizontal: 16,
		paddingVertical: 12,
	},
	selectionText: {
		fontWeight: "600",
	},
	fullUserList: {
		flex: 1,
	},
	emptyStateFull: {
		paddingVertical: 48,
		alignItems: "center",
	},
	userItemFull: {
		flexDirection: "row",
		alignItems: "center",
		paddingVertical: 12,
		paddingHorizontal: 16,
	},
	userNameFull: {
		fontWeight: "500",
		marginBottom: 4,
	},
	userEmailFull: {},
})
