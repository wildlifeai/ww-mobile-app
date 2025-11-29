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

import React, { useState, useEffect } from "react"
import {
	View,
	ScrollView,
	StyleSheet,
	RefreshControl,
	Alert,
	Modal,
	SafeAreaView,
} from "react-native"
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
	RadioButton,
	ActivityIndicator,
	Searchbar,
	Checkbox,
	Appbar,
	SegmentedButtons,
	useTheme,
} from "react-native-paper"
import { useRoute, RouteProp, useNavigation } from "@react-navigation/native"

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
	getOrganizationUsers,
	addProjectMember,
	updateProjectMemberRole,
	removeProjectMember,
} from "../services/UserRoleService"
import { useAppSelector } from "../redux"
import {
	selectCurrentUser,
	selectCurrentOrganisation,
} from "../redux/slices/authSlice"

import type {
	ProjectMember,
	ProjectRole,
	OrganizationUser,
} from "../services/UserRoleService"
import ProjectService from "../services/ProjectService"

type RouteParams = {
	params: {
		projectId: string
		projectName: string
	}
}

export const ProjectMembersScreen: React.FC = () => {
	const route =
		useRoute<RouteProp<{ params: RouteParams["params"] }, "params">>()
	const navigation = useNavigation()
	const theme = useTheme()

	const { projectId, projectName } = route.params || {}

	// Redux selectors
	const user = useAppSelector(selectCurrentUser)
	const currentOrg = useAppSelector(selectCurrentOrganisation)

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

	// Add member dialog state
	const [availableUsers, setAvailableUsers] = useState<OrganizationUser[]>([])
	const [selectedUserIds, setSelectedUserIds] = useState<string[]>([])
	const [selectedUserRole, setSelectedUserRole] =
		useState<ProjectRole>("project_member")
	const [searchQuery, setSearchQuery] = useState("")

	// Menu state (for individual member actions)
	const [menuVisible, setMenuVisible] = useState<{ [key: string]: boolean }>({})

	// Permission checks
	const canManageMembers =
		user && (user.role === "project_admin" || user.role === "ww_admin")

	// Load data
	useEffect(() => {
		loadMembers()
	}, [projectId])

	const loadMembers = async () => {
		if (!user) {
			console.error("❌ Missing user context")
			Alert.alert("Error", "User authentication required")
			return
		}

		setLoading(true)
		try {
			console.log("📋 Loading members for project:", projectId)

			// Load project members (with authorization handling)
			let members: ProjectMember[] = []
			try {
				members = await getProjectMembers(projectId, user.id)
				setMembers(members)
				console.log(`✅ Loaded ${members.length} project members`)
			} catch (error: any) {
				if (error?.message?.includes("Unauthorized")) {
					// User not authorized to view members - show empty list
					console.log("⚠️ User not authorized to view project members")
					setMembers([])
					setAvailableUsers([])
					return
				}
				throw error // Re-throw other errors
			}

			// Get project to find its organisation_id
			const project = await ProjectService.getProjectById(projectId)

			if (!project?.organisation_id) {
				console.error("❌ Project has no organisation_id")
				return
			}

			// Load available users from PROJECT'S organization (not current user's org!)
			const orgUsers = await getOrganizationUsers(
				project.organisation_id,
				user.id,
			)

			// Filter out users already in project
			const available = orgUsers.filter(
				(orgUser) => !members.some((m) => m.id === orgUser.id),
			)
			setAvailableUsers(available)
			console.log(`✅ Loaded ${available.length} available users`)
		} catch (error) {
			console.error("❌ Error loading members:", error)
			Alert.alert("Error", "Failed to load project members")
		} finally {
			setLoading(false)
		}
	}

	const handleRefresh = async () => {
		setRefreshing(true)
		await loadMembers()
		setRefreshing(false)
	}

	const handleAddMembers = async () => {
		if (selectedUserIds.length === 0) {
			Alert.alert("Error", "Please select at least one user to add")
			return
		}

		if (!user) {
			Alert.alert("Error", "User authentication required")
			return
		}

		setLoading(true)
		try {
			console.log(`➕ Adding ${selectedUserIds.length} members...`)

			// Add all selected users
			const results = await Promise.all(
				selectedUserIds.map((userId) =>
					addProjectMember({
						project_id: projectId,
						user_id: userId,
						role: selectedUserRole,
						granted_by: user.id,
					}),
				),
			)

			// Check for failures
			const failures = results.filter((r) => !r.success)
			if (failures.length > 0) {
				console.error("❌ Some members failed to add:", failures)
				Alert.alert("Warning", `${failures.length} members could not be added`)
			}

			// Refresh member list
			await loadMembers()

			const successCount = results.length - failures.length
			if (successCount > 0) {
				Alert.alert(
					"Success",
					`${successCount} ${successCount === 1 ? "member" : "members"
					} added successfully`,
				)
			}

			// Reset form
			setShowAddMemberDialog(false)
			setSelectedUserIds([])
			setSelectedUserRole("project_member")
			setSearchQuery("")
		} catch (error) {
			console.error("❌ Error adding members:", error)
			Alert.alert("Error", "Failed to add members")
		} finally {
			setLoading(false)
		}
	}

	const toggleUserSelection = (userId: string) => {
		setSelectedUserIds((prev) =>
			prev.includes(userId)
				? prev.filter((id) => id !== userId)
				: [...prev, userId],
		)
	}

	const toggleSelectAll = () => {
		if (selectedUserIds.length === filteredAvailableUsers.length) {
			// Deselect all
			setSelectedUserIds([])
		} else {
			// Select all filtered users
			setSelectedUserIds(filteredAvailableUsers.map((u) => u.id))
		}
	}

	const handleChangeRole = async () => {
		if (!selectedMember || !user) return

		setLoading(true)
		try {
			console.log(`🔄 Changing role for ${selectedMember.name}...`)

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
		} catch (error) {
			console.error("❌ Error changing role:", error)
			Alert.alert("Error", "Failed to update role")
		} finally {
			setLoading(false)
		}
	}

	const handleRemoveMember = async () => {
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
			console.log(`➖ Removing member ${selectedMember.name}...`)

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
		} catch (error) {
			console.error("❌ Error removing member:", error)
			Alert.alert("Error", "Failed to remove member")
		} finally {
			setLoading(false)
		}
	}

	const openMenu = (memberId: string) => {
		setMenuVisible({ [memberId]: true })
	}

	const closeMenu = (memberId: string) => {
		setMenuVisible({ [memberId]: false })
	}

	const handleMenuChangeRole = (member: ProjectMember) => {
		setSelectedMember(member)
		setSelectedRole(
			member.role === "project_admin" ? "project_member" : "project_admin",
		)
		setShowRoleChangeDialog(true)
		closeMenu(member.id)
	}

	const handleMenuRemove = (member: ProjectMember) => {
		setSelectedMember(member)
		setShowRemoveDialog(true)
		closeMenu(member.id)
	}

	// Filter available users based on search
	const filteredAvailableUsers = availableUsers.filter(
		(user) =>
			user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
			user.email.toLowerCase().includes(searchQuery.toLowerCase()),
	)

	if (loading && members.length === 0) {
		return (
			<View style={styles.loadingContainer}>
				<ActivityIndicator size="large" />
				<Text style={{ marginTop: 16 }}>Loading project members...</Text>
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
						{ color: theme.colors.onSurfaceVariant },
					]}
				>
					{projectName}
				</Text>
				<Text
					variant="bodySmall"
					style={{ color: theme.colors.onSurfaceVariant, marginTop: 4 }}
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

					return (
						<Card key={member.id} style={styles.memberCard}>
							<Card.Content>
								<View style={styles.memberRow}>
									{/* Avatar */}
									<Avatar.Text
										size={48}
										label={member.name
											.split(" ")
											.map((n) => n[0])
											.join("")
											.toUpperCase()}
										style={{ backgroundColor: getRoleBadgeColor(member.role as ProjectRole) }}
									/>

									{/* Member Info */}
									<View style={styles.memberInfo}>
										<Text
											variant="titleMedium"
											style={{ color: theme.colors.onSurface }}
										>
											{member.name}
										</Text>
										<Text
											variant="bodySmall"
											style={{ color: theme.colors.onSurfaceVariant }}
										>
											{member.email}
										</Text>
										<Chip
											mode="flat"
											textStyle={{ fontSize: 12 }}
											style={{
												marginTop: 8,
												alignSelf: "flex-start",
												backgroundColor: getRoleBadgeColor(member.role as ProjectRole) + "20",
											}}
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
						{ backgroundColor: theme.colors.background },
					]}
				>
					{/* Header with back button */}
					<Appbar.Header>
						<Appbar.BackAction onPress={() => setShowAddMemberDialog(false)} />
						<Appbar.Content title="Add Members" />
						<Button
							onPress={handleAddMembers}
							disabled={selectedUserIds.length === 0}
							mode="contained"
							style={styles.headerButton}
						>
							{selectedUserIds.length === 0
								? "Add"
								: `Add ${selectedUserIds.length}`}
						</Button>
					</Appbar.Header>

					{/* Role Selection with Segmented Buttons - GREEN THEME */}
					<View style={styles.roleSelectionSection}>
						<Text variant="titleMedium" style={styles.roleLabel}>
							Adding as:
						</Text>
						<SegmentedButtons
							value={selectedUserRole}
							onValueChange={(value) =>
								setSelectedUserRole(value as ProjectRole)
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
					</View>

					{/* Search Bar */}
					<View style={styles.searchContainer}>
						<Searchbar
							placeholder="Search members"
							placeholderTextColor="#666666"
							onChangeText={setSearchQuery}
							value={searchQuery}
							style={styles.searchBarFull}
							inputStyle={styles.searchInput}
							theme={{
								colors: { onSurfaceVariant: "#000000", onSurface: "#000000" },
							}}
							testID="member-search-bar"
						/>
					</View>

					{/* Select All Header */}
					{filteredAvailableUsers.length > 0 && (
						<View style={styles.selectAllContainer}>
							<Checkbox
								status={
									selectedUserIds.length === 0
										? "unchecked"
										: selectedUserIds.length === filteredAvailableUsers.length
											? "checked"
											: "indeterminate"
								}
								onPress={toggleSelectAll}
								color="#4CAF50"
							/>
							<Text
								variant="bodyMedium"
								style={styles.selectAllText}
								onPress={toggleSelectAll}
							>
								{selectedUserIds.length === filteredAvailableUsers.length
									? "Deselect All"
									: "Select All"}
							</Text>
						</View>
					)}

					{/* User List - NO BACKGROUND CHANGES */}
					<ScrollView style={styles.fullUserList}>
						{filteredAvailableUsers.length === 0 ? (
							<View style={styles.emptyStateFull}>
								<Text style={styles.emptyText}>
									{searchQuery ? "No users found" : "No available users to add"}
								</Text>
							</View>
						) : (
							filteredAvailableUsers.map((user) => {
								const isSelected = selectedUserIds.includes(user.id)
								return (
									<View key={user.id} style={styles.userItemFull}>
										<Checkbox
											status={isSelected ? "checked" : "unchecked"}
											onPress={() => toggleUserSelection(user.id)}
											color="#4CAF50"
										/>
										<View
											style={styles.userItemContent}
											onTouchEnd={() => toggleUserSelection(user.id)}
										>
											<Text
												variant="bodyLarge"
												style={[
													styles.userNameFull,
													{ color: theme.colors.onSurface },
												]}
											>
												{user.name}
											</Text>
											<Text
												variant="bodyMedium"
												style={[
													styles.userEmailFull,
													{ color: theme.colors.onSurfaceVariant },
												]}
											>
												{user.email}
											</Text>
										</View>
									</View>
								)
							})
						)}
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
								<Text variant="bodyLarge" style={{ marginBottom: 16 }}>
									Change role for{" "}
									<Text style={{ fontWeight: "bold" }}>
										{selectedMember.name}
									</Text>
									?
								</Text>
								<View style={styles.roleCompare}>
									<View>
										<Text
											variant="bodySmall"
											style={{ color: theme.colors.onSurfaceVariant }}
										>
											Current:
										</Text>
										<Chip style={{ marginTop: 4 }}>
											{getRoleDisplayName(selectedMember.role as ProjectRole)}
										</Chip>
									</View>
									<IconButton icon="arrow-right" />
									<View>
										<Text
											variant="bodySmall"
											style={{ color: theme.colors.onSurfaceVariant }}
										>
											New:
										</Text>
										<Chip
											style={{
												marginTop: 4,
												backgroundColor: getRoleBadgeColor(selectedRole) + "20",
											}}
										>
											{getRoleDisplayName(selectedRole)}
										</Chip>
									</View>
								</View>
								<Text
									variant="bodySmall"
									style={{
										marginTop: 16,
										color: theme.colors.onSurfaceVariant,
									}}
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
									<Text style={{ fontWeight: "bold" }}>
										{selectedMember.name}
									</Text>{" "}
									from this project?
								</Text>
								<Text
									variant="bodySmall"
									style={{ marginTop: 16, color: theme.colors.error }}
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
