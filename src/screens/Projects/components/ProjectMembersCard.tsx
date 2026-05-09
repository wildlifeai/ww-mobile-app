import React from 'react'
import { View, StyleSheet } from 'react-native'
import { Card, Text, IconButton, Divider, ActivityIndicator, useTheme, TouchableRipple } from 'react-native-paper'
import { useAppNavigation } from '../../../hooks/useAppNavigation'
import { ProjectWithDetails, ProjectMember } from '../../../types/project'
import { getDisplayName } from '../../../utils/userUtils'

interface Props {
    project: ProjectWithDetails
    members?: ProjectMember[]
    membersLoading: boolean
    isProjectAdmin: boolean
    currentUser: any
}

export const ProjectMembersCard: React.FC<Props> = ({
    project,
    members,
    membersLoading,
    isProjectAdmin,
    currentUser,
}) => {
    const navigation = useAppNavigation()
    const theme = useTheme()

    const dynamicStyles = {
        membersTitle: { color: theme.colors.onSurface },
        memberName: { color: theme.colors.onSurface },
        memberRole: { color: theme.colors.onSurfaceVariant },
        membersEmpty: { color: theme.colors.onSurfaceVariant },
    }

    const handleSectionPress = () => {
        navigation.navigate('ProjectMembersScreen', {
            projectId: project.id,
            projectName: project.name,
        })
    }

    return (
        <Card mode="outlined" style={styles.card}>
            <Card.Content>
                <View style={styles.sectionHeader}>
                    <TouchableRipple onPress={handleSectionPress} borderless style={styles.headerTitleTouchable}>
                        <Text
                            variant="titleMedium"
                            style={dynamicStyles.membersTitle}
                        >
                            Members ({members?.length || 0})
                        </Text>
                    </TouchableRipple>
                    <IconButton
                        icon={isProjectAdmin ? "account-cog" : "eye"}
                        size={24}
                        onPress={handleSectionPress}
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

                            return (
                                <View
                                    key={member.user_id || `member-${index}`}
                                    style={styles.memberListItem}
                                >
                                    <View style={styles.memberInfo}>
                                        <Text
                                            variant="bodyMedium"
                                            style={[
                                                dynamicStyles.memberName,
                                                isMe && styles.memberNameBold,
                                            ]}
                                        >
                                            {displayName} {isMe && "(You)"}
                                        </Text>
                                        {member.role && (
                                            <Text
                                                variant="bodySmall"
                                                style={dynamicStyles.memberRole}
                                            >
                                                {member.role === 'project_admin' ? 'Admin' : 'Member'}
                                            </Text>
                                        )}
                                    </View>
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
    headerTitleTouchable: {
        flex: 1,
        borderRadius: 8,
        justifyContent: 'center',
    },
    sectionHeader: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        flexWrap: "wrap",
        minHeight: 40,
    },
    divider: {
        marginBottom: 16,
    },
    membersList: {
        gap: 12,
    },
    memberListItem: {
        flexDirection: "row",
        alignItems: "center",
    },
    memberInfo: {
        flex: 1,
    },
    memberNameBold: {
        fontWeight: 'bold',
    },
})
