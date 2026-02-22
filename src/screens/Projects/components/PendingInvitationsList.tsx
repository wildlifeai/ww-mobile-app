import React from "react"
import { View } from "react-native"
import { Text, Card, Chip, Divider } from "react-native-paper"
import type ProjectInvitation from "../../../database/models/ProjectInvitation"
import type { ProjectRole } from "../../../services/UserRoleService"

export interface PendingInvitationsListProps {
	pendingInvitations: ProjectInvitation[]
	getRoleDisplayName: (role: ProjectRole) => string
	dynamicStyles: any
}

export const PendingInvitationsList: React.FC<PendingInvitationsListProps> = ({
	pendingInvitations,
	getRoleDisplayName,
	dynamicStyles,
}) => {
	if (pendingInvitations.length === 0) return null

	return (
		<View style={dynamicStyles.inviteSection}>
			<Text variant="titleSmall" style={dynamicStyles.inviteTitle}>
				Pending Invitations ({pendingInvitations.length})
			</Text>
			{pendingInvitations.map((invite) => (
				<Card key={invite.id || invite.remoteId} style={dynamicStyles.inviteCard}>
					<Card.Content style={dynamicStyles.inviteContent}>
						<View>
							<Text variant="bodyMedium" style={dynamicStyles.inviteEmail}>
								{invite.inviteeEmail}
							</Text>
							<Text variant="bodySmall">
								{getRoleDisplayName(invite.role as ProjectRole)} • Expires{" "}
								{new Date(invite.expiresAt).toLocaleDateString()}
							</Text>
						</View>
						<Chip icon="clock-outline" compact>
							<Text>Pending</Text>
						</Chip>
					</Card.Content>
				</Card>
			))}
			<Divider style={dynamicStyles.inviteDivider} />
		</View>
	)
}
