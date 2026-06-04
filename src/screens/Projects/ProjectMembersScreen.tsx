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

import { useEffect, useCallback, useMemo, useReducer } from "react"
import {
	View,
	ScrollView,
	StyleSheet,
	RefreshControl,
	Alert,
} from "react-native"
import {
	Text,
	ActivityIndicator,
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

// Real service imports
import {
	getProjectMembers,
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
import { UserProfile } from "../../types/UserProfile"
import { getDisplayName } from "../../utils/userUtils"
import { ChangeRoleDialog } from "./components/ChangeRoleDialog"
import { RemoveMemberDialog } from "./components/RemoveMemberDialog"
import { MemberListItem } from "./components/MemberListItem"
import { PendingInvitationsList } from "./components/PendingInvitationsList"
import { InviteMemberCard } from "./components/InviteMemberCard"


type RouteParams = {
	params: {
		projectId: string
		projectName: string
	}
}

interface MembersState {
	members: ProjectMember[]
	loading: boolean
	refreshing: boolean
	dialogState: { type: 'none' | 'role' | 'remove', member?: ProjectMember }
	pendingInvitations: ProjectInvitation[]
	menuVisible: { [key: string]: boolean }
}

const membersReducer = (state: MembersState, action: Partial<MembersState> | { type: 'TOGGLE_MENU'; memberId: string; visible: boolean }): MembersState => {
	if ('type' in action && action.type === 'TOGGLE_MENU') {
		return { ...state, menuVisible: { ...state.menuVisible, [action.memberId]: action.visible } }
	}
	return { ...state, ...action as Partial<MembersState> }
}

export const ProjectMembersScreen = () => {
	const route =
		useRoute<RouteProp<{ params: RouteParams["params"] }, "params">>()
	const theme = useTheme()

	const { projectId, projectName } = route.params || {}

	// Redux selectors
	const user = useAppSelector(selectCurrentUser)

	// State
	const [state, dispatch] = useReducer(membersReducer, {
		members: [],
		loading: false,
		refreshing: false,
		dialogState: { type: 'none' },
		pendingInvitations: [],
		menuVisible: {}
	})

	const { members, loading, refreshing, dialogState, pendingInvitations, menuVisible } = state

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

		dispatch({ loading: true })
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
							// Try various property names that might be in Redux
							const profile = user!.profile as UserProfile
							const pName = getDisplayName(profile)
							
							return {
								...m,
								name: pName ? `${pName} (You)` : "Me (You)",
								firstname: profile.firstName || profile.firstname || m.firstname,
								surname: profile.lastName || profile.surname || m.surname,
								email: user!.email || m.email
							}
						}
					}
					return m
				})

				dispatch({ members: enrichedMembers })
				log(`✅ Loaded ${enrichedMembers.length} project members`)
				// Load pending invitations only if user is an admin
				const currentUserRole = enrichedMembers.find((m) => m.id === user!.id)?.role
				const isAdmin = currentUserRole === "project_admin" || user!.role === "ww_admin"
				
				if (isAdmin) {
					const pending = await InvitationService.getProjectPendingInvitations(projectId)
					dispatch({ pendingInvitations: pending })
				} else {
					dispatch({ pendingInvitations: [] })
				}
			} catch (error: any) {
				if (error?.message?.includes("Unauthorized")) {
					// User not authorized to view members - show empty list
					log("⚠️ User not authorized to view project members")
					dispatch({ members: [] })

					return
				}
				throw error // Re-throw other errors
			}
		} catch (error) {
			logError("❌ Error loading members:", error)
			Alert.alert("Error", "Failed to load project members")
		} finally {
			dispatch({ loading: false })
		}
	}, [projectId, user])

	const handleInviteSent = useCallback(async () => {
		dispatch({ refreshing: true })
		await loadMembers()
		dispatch({ refreshing: false })
	}, [loadMembers])

	// Load data
	useEffect(() => {
		loadMembers()
	}, [loadMembers])

	const handleRefresh = useCallback(async () => {
		dispatch({ refreshing: true })
		await loadMembers()
		dispatch({ refreshing: false })
	}, [loadMembers])

	const openMenu = useCallback((memberId: string) => {
		dispatch({ type: 'TOGGLE_MENU', memberId, visible: true })
	}, [])

	const closeMenu = useCallback((memberId: string) => {
		dispatch({ type: 'TOGGLE_MENU', memberId, visible: false })
	}, [])

	const handleMenuChangeRole = useCallback((member: ProjectMember) => {
		dispatch({ dialogState: { type: 'role', member } })
		closeMenu(member.id)
	}, [closeMenu])

	const handleMenuRemove = useCallback((member: ProjectMember) => {
		dispatch({ dialogState: { type: 'remove', member } })
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
				<Text style={dynamicStyles.loadingText}>Loading project members…</Text>
			</View>
		)
	}

	return (
		<View style={styles.container}>
			{/* Header */}
			<View style={styles.header}>
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

			{/* Inline Add Member (admin only) */}
			{canManageMembers && (
				<InviteMemberCard
					projectId={projectId!}
					onInviteSent={handleInviteSent}
					styles={styles}
				/>
			)}

			{/* Pending Invitations List (Admin Only) */}
			{canManageMembers && pendingInvitations.length > 0 && (
				<PendingInvitationsList
					pendingInvitations={pendingInvitations}
					getRoleDisplayName={getRoleDisplayName}
					dynamicStyles={dynamicStyles}
				/>
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
					
					return (
						<MemberListItem
							key={member.id}
							member={member}
							user={user}
							adminCount={adminCount}
							canManageMembers={!!canManageMembers}
							menuVisible={menuVisible[member.id] || false}
							openMenu={openMenu}
							closeMenu={closeMenu}
							handleMenuChangeRole={handleMenuChangeRole}
							handleMenuRemove={handleMenuRemove}
							getRoleBadgeColor={getRoleBadgeColor}
							getRoleDisplayName={getRoleDisplayName}
							dynamicStyles={dynamicStyles}
						/>
					)
				})}
			</ScrollView>

			<ChangeRoleDialog
				projectId={projectId!}
				visible={dialogState.type === 'role'}
				member={dialogState.member || null}
				user={user}
				onDismiss={() => dispatch({ dialogState: { type: 'none' } })}
				onSuccess={handleRefresh}
			/>

			<RemoveMemberDialog
				projectId={projectId!}
				visible={dialogState.type === 'remove'}
				member={dialogState.member || null}
				members={members}
				user={user}
				onDismiss={() => dispatch({ dialogState: { type: 'none' } })}
				onSuccess={handleRefresh}
			/>
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
	},
	memberRow: {
		flexDirection: "row",
		alignItems: "center",
	},
	inviteCard: {
		marginHorizontal: 16,
		marginBottom: 16,
	},
	inviteDesc: {
		marginBottom: 16,
	},
	inviteInput: {
		marginBottom: 16,
	},
	roleLabel: {
		marginBottom: 8,
	},
	segmentedButtons: {
		marginBottom: 16,
	},
	sendInviteButton: {
		marginTop: 8,
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
	searchContainer: {
		paddingHorizontal: 16,
		paddingVertical: 8,
	},
	searchBarFull: {
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
