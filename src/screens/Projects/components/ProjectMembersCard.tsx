import React from 'react'
import { View, StyleSheet } from 'react-native'
import { Card, Text, IconButton, Divider, ActivityIndicator, Button, Avatar, useTheme } from 'react-native-paper'
import { useAppNavigation } from '../../../hooks/useAppNavigation'
import { ProjectWithDetails, ProjectMember } from '../../../types/project'
import { getDisplayName } from '../../../utils/userUtils'

interface Props {
    project: ProjectWithDetails
    members?: ProjectMember[]
    membersLoading: boolean
    isProjectAdmin: boolean
    currentUser: any
    handleRemoveMember: (userId: string) => void
}

export const ProjectMembersCard: React.FC<Props> = ({
    project,
    members,
    membersLoading,
    isProjectAdmin,
    currentUser,
    handleRemoveMember
}) => {
    const navigation = useAppNavigation()
    const theme = useTheme()

    const dynamicStyles = {
        membersTitle: { color: theme.colors.onSurface },
        memberInitialBg: { backgroundColor: theme.colors.primaryContainer },
        memberInitialLabel: { color: theme.colors.onPrimaryContainer, fontSize: 12 },
        memberNameAdmin: { color: theme.colors.onSurface, fontWeight: 'bold' as const },
        memberNameMember: { color: theme.colors.onSurface, fontWeight: 'normal' as const },
        memberRoleText: { color: theme.colors.onSurfaceVariant },
        membersEmpty: { color: theme.colors.onSurfaceVariant },
    }

    return (
        <Card mode="outlined" style={styles.card}>
            <Card.Content>
                <View style={styles.sectionHeader}>
                    <Text
                        variant="titleMedium"
                        style={dynamicStyles.membersTitle}
                    >
                        Members ({members?.length || 0})
                    </Text>
                    <IconButton
                        icon={isProjectAdmin ? "account-cog" : "eye"}
                        size={24}
                        onPress={() => {
                            navigation.navigate("ProjectMembersScreen", {
                                projectId: project.id,
                                projectName: project.name,
                            })
                        }}
                        testID={isProjectAdmin ? "manage-members-button" : "view-members-button"}
                    />
                </View>

                <Divider style={styles.divider} />

                {membersLoading ? (
                    <ActivityIndicator size="small" />
                ) : members && members.length > 0 ? (
                    <View style={styles.membersList}>
                        {members.slice(0, 5).map((member, index) => {
                            const isMe = member.user_id === currentUser?.id
                            const displayName = isMe
                                ? ((currentUser as any)?.profile?.first_name
                                    ? `${(currentUser as any).profile.first_name} ${(currentUser as any).profile.last_name || ""}`.trim()
                                    : "Me")
                                : getDisplayName(member.user_profile || (member.user_profile as any)?.profile, false)

                            const initials = (displayName || "")
                                .split(" ")
                                .map(n => n[0])
                                .join("")
                                .toUpperCase()
                                .substring(0, 2)

                            return (
                                <View
                                    key={member.user_id || `member-${index}`}
                                    style={styles.memberListItem}
                                >
                                    <View style={styles.memberInfo}>
                                        <Avatar.Text
                                            size={32}
                                            label={initials}
                                            style={dynamicStyles.memberInitialBg}
                                            labelStyle={dynamicStyles.memberInitialLabel}
                                        />
                                        <View style={styles.memberDetails}>
                                            <Text
                                                variant="bodyMedium"
                                                style={isMe ? dynamicStyles.memberNameAdmin : dynamicStyles.memberNameMember}
                                            >
                                                {displayName} {isMe && "(You)"}
                                            </Text>
                                            {!isMe && member.user_profile?.email && member.user_profile.email !== displayName && (
                                                <Text
                                                    variant="bodySmall"
                                                    style={dynamicStyles.memberRoleText}
                                                >
                                                    {member.user_profile.email}
                                                </Text>
                                            )}
                                            {member.role && (
                                                <Text
                                                    variant="bodySmall"
                                                    style={dynamicStyles.memberRoleText}
                                                >
                                                    {member.role === 'project_admin' ? 'Admin' : 'Member'}
                                                </Text>
                                            )}
                                        </View>
                                    </View>
                                    {isProjectAdmin && !isMe && (
                                        <IconButton
                                            icon="close"
                                            size={20}
                                            iconColor={theme.colors.error}
                                            onPress={() => handleRemoveMember(member.user_id)}
                                            testID={`remove-member-${member.user_id}`}
                                        />
                                    )}
                                </View>
                            )
                        })}
                    </View>
                ) : (
                    <Text
                        variant="bodyMedium"
                        style={dynamicStyles.membersEmpty}
                    >
                        No members found
                    </Text>
                )}
            </Card.Content>
        </Card>
    )
}

const styles = StyleSheet.create({
    card: {
        marginBottom: 16,
    },
    sectionHeader: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        flexWrap: "wrap",
        minHeight: 40,
        marginBottom: 8,
    },
    divider: {
        marginBottom: 16,
    },
    membersList: {
        gap: 16,
    },
    memberListItem: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
    },
    memberInfo: {
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        flex: 1,
    },
    memberDetails: {
        flex: 1,
    },
})
