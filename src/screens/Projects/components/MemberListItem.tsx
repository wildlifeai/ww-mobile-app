import React from "react"
import { View, StyleSheet } from "react-native"
import { Text, Card, Avatar, Chip, IconButton, Menu, Divider, useTheme } from "react-native-paper"
import { type ProjectMember, type ProjectRole } from "../../../services/UserRoleService"
import { getDisplayName } from "../../../utils/userUtils"

export interface MemberListItemProps {
	member: ProjectMember
	user: any
	adminCount: number
	canManageMembers: boolean
	menuVisible: boolean
	openMenu: (id: string) => void
	closeMenu: (id: string) => void
	handleMenuChangeRole: (member: ProjectMember) => void
	handleMenuRemove: (member: ProjectMember) => void
	getRoleBadgeColor: (role: ProjectRole) => string
	getRoleDisplayName: (role: ProjectRole) => string
	dynamicStyles: any
}

export const MemberListItem: React.FC<MemberListItemProps> = ({
	member,
	user,
	adminCount,
	canManageMembers,
	menuVisible,
	openMenu,
	closeMenu,
	handleMenuChangeRole,
	handleMenuRemove,
	getRoleBadgeColor,
	getRoleDisplayName,
	dynamicStyles,
}) => {
	const theme = useTheme()
	const isLastAdmin = member.role === "project_admin" && adminCount === 1
	const canRemove = !isLastAdmin

	const isMe = user && String(member.id).toLowerCase() === String(user.id).toLowerCase()

	const displayName = getDisplayName(member, isMe)

	const initials = displayName
		.replace("(You)", "")
		.trim()
		.split(" ")
		.filter((n) => n.length > 0)
		.map((n) => n[0])
		.join("")
		.toUpperCase()
		.substring(0, 2)

	return (
		<Card style={styles.memberCard}>
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
						<Text variant="titleMedium" style={dynamicStyles.memberSurface}>
							{displayName}
						</Text>
						{member.email && member.email !== displayName && (
							<Text variant="bodySmall" style={dynamicStyles.memberSurfaceVariant}>
								{member.email}
							</Text>
						)}
						<Chip
							mode="flat"
							textStyle={dynamicStyles.chipText}
							style={[
								dynamicStyles.chipStyle,
								{ backgroundColor: getRoleBadgeColor(member.role as ProjectRole) + "20" },
							]}
						>
							{getRoleDisplayName(member.role as ProjectRole)}
						</Chip>
					</View>

					{/* Actions Menu (admin only) */}
					{canManageMembers && (
						<Menu
							visible={menuVisible}
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
}

const styles = StyleSheet.create({
	memberCard: {
		marginBottom: 12,
		boxShadow: "0px 1px 2px rgba(0, 0, 0, 0.15)",
	},
	memberRow: {
		flexDirection: "row",
		alignItems: "center",
	},
	memberInfo: {
		flex: 1,
		marginLeft: 16,
	},
})
