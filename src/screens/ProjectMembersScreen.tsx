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

import React, { useState, useEffect } from 'react';
import { View, ScrollView, StyleSheet, RefreshControl, Alert, Modal, SafeAreaView } from 'react-native';
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
} from 'react-native-paper';
import { useRoute, RouteProp, useNavigation } from '@react-navigation/native';

// Mock data (will be replaced with real service calls)
import {
  mockProjectMembers,
  mockOrganizationUsers,
  mockCurrentUser,
  getRoleBadgeColor,
  getRoleDisplayName,
  getRoleDescription,
  canAddMembers,
  canRemoveMembers,
  canChangeRoles,
  canRemoveSpecificMember,
  getAvailableUsers,
  mockApiResponses,
} from '../mocks/projectMembers';

import type { ProjectMember, ProjectRole, OrganizationUser } from '../services/ProjectMemberService';

type RouteParams = {
  params: {
    projectId: string;
    projectName: string;
  };
};

export const ProjectMembersScreen: React.FC = () => {
  const route = useRoute<RouteProp<{ params: RouteParams['params'] }, 'params'>>();
  const navigation = useNavigation();

  const { projectId, projectName } = route.params || {};

  // State
  const [members, setMembers] = useState<ProjectMember[]>(mockProjectMembers);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Dialogs
  const [showAddMemberDialog, setShowAddMemberDialog] = useState(false);
  const [showRoleChangeDialog, setShowRoleChangeDialog] = useState(false);
  const [showRemoveDialog, setShowRemoveDialog] = useState(false);
  const [selectedMember, setSelectedMember] = useState<ProjectMember | null>(null);
  const [selectedRole, setSelectedRole] = useState<ProjectRole>('project_member');

  // Add member dialog state
  const [availableUsers, setAvailableUsers] = useState<OrganizationUser[]>([]);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [selectedUserRole, setSelectedUserRole] = useState<ProjectRole>('project_member');
  const [searchQuery, setSearchQuery] = useState('');

  // Menu state (for individual member actions)
  const [menuVisible, setMenuVisible] = useState<{ [key: string]: boolean }>({});

  // Permission checks
  const currentUserRole = mockCurrentUser.role;
  const canManageMembers = canAddMembers(currentUserRole);

  // Load data
  useEffect(() => {
    loadMembers();
  }, [projectId]);

  const loadMembers = async () => {
    setLoading(true);
    try {
      // TODO: Replace with actual API call
      // const members = await getProjectMembers(projectId, mockCurrentUser.id);
      await new Promise((resolve) => setTimeout(resolve, 500)); // Simulate API delay
      setMembers(mockProjectMembers);

      // Load available users for adding
      const allUsers = mockOrganizationUsers;
      const available = getAvailableUsers(allUsers, mockProjectMembers);
      setAvailableUsers(available);
    } catch (error) {
      console.error('Error loading members:', error);
      Alert.alert('Error', 'Failed to load project members');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadMembers();
    setRefreshing(false);
  };

  const handleAddMembers = async () => {
    if (selectedUserIds.length === 0) {
      Alert.alert('Error', 'Please select at least one user to add');
      return;
    }

    setLoading(true);
    try {
      // Add all selected users with the chosen role
      const newMembers: ProjectMember[] = [];

      for (const userId of selectedUserIds) {
        await mockApiResponses.addMember(userId, selectedUserRole);

        const userToAdd = availableUsers.find(u => u.id === userId);
        if (userToAdd) {
          newMembers.push({
            id: userToAdd.id,
            name: userToAdd.name,
            email: userToAdd.email,
            role: selectedUserRole,
            granted_at: new Date().toISOString(),
            granted_by: mockCurrentUser.id,
            granted_by_name: mockCurrentUser.name,
          });
        }
      }

      // Update members list
      setMembers(prevMembers => [...prevMembers, ...newMembers]);

      // Remove from available users
      setAvailableUsers(prevUsers =>
        prevUsers.filter(u => !selectedUserIds.includes(u.id))
      );

      const count = selectedUserIds.length;
      Alert.alert('Success', `${count} ${count === 1 ? 'member' : 'members'} added successfully`);
      setShowAddMemberDialog(false);
      setSelectedUserIds([]);
      setSelectedUserRole('project_member');
      setSearchQuery('');
    } catch (error) {
      console.error('Error adding members:', error);
      Alert.alert('Error', 'Failed to add members');
    } finally {
      setLoading(false);
    }
  };

  const toggleUserSelection = (userId: string) => {
    setSelectedUserIds(prev =>
      prev.includes(userId)
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  const handleChangeRole = async () => {
    if (!selectedMember) return;

    setLoading(true);
    try {
      // TODO: Replace with actual API call
      // const result = await updateProjectMemberRole({
      //   project_id: projectId,
      //   user_id: selectedMember.id,
      //   new_role: selectedRole,
      //   updated_by: mockCurrentUser.id,
      // });

      await mockApiResponses.updateRole(selectedMember.id, selectedRole);

      // Update member's role in local state
      setMembers(prevMembers =>
        prevMembers.map(m =>
          m.id === selectedMember.id
            ? { ...m, role: selectedRole }
            : m
        )
      );

      Alert.alert('Success', 'Role updated successfully');
      setShowRoleChangeDialog(false);
      setSelectedMember(null);
    } catch (error) {
      console.error('Error changing role:', error);
      Alert.alert('Error', 'Failed to update role');
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveMember = async () => {
    if (!selectedMember) return;

    // Check if this is the last admin
    const adminCount = members.filter((m) => m.role === 'project_admin').length;
    const isLastAdmin = selectedMember.role === 'project_admin' && adminCount === 1;

    if (isLastAdmin) {
      Alert.alert('Cannot Remove', 'Cannot remove the last project admin');
      return;
    }

    setLoading(true);
    try {
      // TODO: Replace with actual API call
      // const result = await removeProjectMember({
      //   project_id: projectId,
      //   user_id: selectedMember.id,
      //   removed_by: mockCurrentUser.id,
      // });

      await mockApiResponses.removeMember(selectedMember.id);

      // Remove member from local state
      setMembers(prevMembers => prevMembers.filter(m => m.id !== selectedMember.id));

      // Add back to available users (convert from ProjectMember to OrganizationUser)
      const removedUser: OrganizationUser = {
        id: selectedMember.id,
        name: selectedMember.name,
        email: selectedMember.email,
        roles: [], // Empty roles for removed user
        is_in_project: false,
      };
      setAvailableUsers(prevUsers => [...prevUsers, removedUser]);

      Alert.alert('Success', 'Member removed successfully');
      setShowRemoveDialog(false);
      setSelectedMember(null);
    } catch (error) {
      console.error('Error removing member:', error);
      Alert.alert('Error', 'Failed to remove member');
    } finally {
      setLoading(false);
    }
  };

  const openMenu = (memberId: string) => {
    setMenuVisible({ [memberId]: true });
  };

  const closeMenu = (memberId: string) => {
    setMenuVisible({ [memberId]: false });
  };

  const handleMenuChangeRole = (member: ProjectMember) => {
    setSelectedMember(member);
    setSelectedRole(member.role === 'project_admin' ? 'project_member' : 'project_admin');
    setShowRoleChangeDialog(true);
    closeMenu(member.id);
  };

  const handleMenuRemove = (member: ProjectMember) => {
    setSelectedMember(member);
    setShowRemoveDialog(true);
    closeMenu(member.id);
  };

  // Filter available users based on search
  const filteredAvailableUsers = availableUsers.filter(
    (user) =>
      user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading && members.length === 0) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" />
        <Text style={{ marginTop: 16 }}>Loading project members...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text variant="headlineSmall" style={styles.headerTitle}>
          Project Members
        </Text>
        <Text variant="bodyMedium" style={styles.headerSubtitle}>
          {projectName}
        </Text>
        <Text variant="bodySmall" style={{ color: '#666', marginTop: 4 }}>
          {members.length} {members.length === 1 ? 'member' : 'members'}
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
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
      >
        {members.map((member) => {
          const adminCount = members.filter((m) => m.role === 'project_admin').length;
          const isLastAdmin = member.role === 'project_admin' && adminCount === 1;
          const canRemove = canRemoveSpecificMember(currentUserRole, member.role, isLastAdmin);

          return (
            <Card key={member.id} style={styles.memberCard}>
              <Card.Content>
                <View style={styles.memberRow}>
                  {/* Avatar */}
                  <Avatar.Text
                    size={48}
                    label={member.name
                      .split(' ')
                      .map((n) => n[0])
                      .join('')
                      .toUpperCase()}
                    style={{ backgroundColor: getRoleBadgeColor(member.role) }}
                  />

                  {/* Member Info */}
                  <View style={styles.memberInfo}>
                    <Text variant="titleMedium">{member.name}</Text>
                    <Text variant="bodySmall" style={{ color: '#666' }}>
                      {member.email}
                    </Text>
                    <Chip
                      mode="flat"
                      textStyle={{ fontSize: 12 }}
                      style={{
                        marginTop: 8,
                        alignSelf: 'flex-start',
                        backgroundColor: getRoleBadgeColor(member.role) + '20',
                      }}
                    >
                      {getRoleDisplayName(member.role)}
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
                      {canChangeRoles(currentUserRole) && (
                        <Menu.Item
                          leadingIcon="account-convert"
                          onPress={() => handleMenuChangeRole(member)}
                          title={
                            member.role === 'project_admin'
                              ? 'Change to Member'
                              : 'Promote to Admin'
                          }
                        />
                      )}
                      {canRemove && (
                        <>
                          <Divider />
                          <Menu.Item
                            leadingIcon="account-remove"
                            onPress={() => handleMenuRemove(member)}
                            title="Remove from Project"
                            titleStyle={{ color: '#F44336' }}
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
          );
        })}
      </ScrollView>

      {/* Add Member Full-Screen Modal */}
      <Modal
        visible={showAddMemberDialog}
        animationType="slide"
        onRequestClose={() => setShowAddMemberDialog(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
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
                ? 'Add'
                : `Add ${selectedUserIds.length}`}
            </Button>
          </Appbar.Header>

          {/* Role Selection with Segmented Buttons */}
          <View style={styles.roleSelectionSection}>
            <Text variant="titleMedium" style={styles.roleLabel}>
              Adding as:
            </Text>
            <SegmentedButtons
              value={selectedUserRole}
              onValueChange={(value) => setSelectedUserRole(value as ProjectRole)}
              buttons={[
                {
                  value: 'project_member',
                  label: 'Member',
                  icon: 'account',
                },
                {
                  value: 'project_admin',
                  label: 'Admin',
                  icon: 'shield-account',
                },
              ]}
              style={styles.segmentedButtons}
            />
          </View>

          {/* Search Bar */}
          <View style={styles.searchContainer}>
            <Searchbar
              placeholder="Search members"
              onChangeText={setSearchQuery}
              value={searchQuery}
              style={styles.searchBarFull}
              inputStyle={styles.searchInput}
              placeholderTextColor="#999"
              testID="member-search-bar"
            />
          </View>

          {/* Selected Count */}
          {selectedUserIds.length > 0 && (
            <View style={styles.selectionBanner}>
              <Text variant="bodyMedium" style={styles.selectionText}>
                {selectedUserIds.length} {selectedUserIds.length === 1 ? 'user' : 'users'} selected
              </Text>
              <Button
                mode="text"
                onPress={() => setSelectedUserIds([])}
                compact
              >
                Clear
              </Button>
            </View>
          )}

          {/* User List */}
          <ScrollView style={styles.fullUserList}>
            {filteredAvailableUsers.length === 0 ? (
              <View style={styles.emptyStateFull}>
                <Text style={styles.emptyText}>
                  {searchQuery ? 'No users found' : 'No available users to add'}
                </Text>
              </View>
            ) : (
              filteredAvailableUsers.map((user) => {
                const isSelected = selectedUserIds.includes(user.id);
                return (
                  <View
                    key={user.id}
                    style={[
                      styles.userItemFull,
                      isSelected && styles.userItemSelected,
                    ]}
                  >
                    <Checkbox
                      status={isSelected ? 'checked' : 'unchecked'}
                      onPress={() => toggleUserSelection(user.id)}
                    />
                    <View
                      style={styles.userItemContent}
                      onTouchEnd={() => toggleUserSelection(user.id)}
                    >
                      <Text variant="bodyLarge" style={styles.userNameFull}>{user.name}</Text>
                      <Text variant="bodyMedium" style={styles.userEmailFull}>{user.email}</Text>
                    </View>
                  </View>
                );
              })
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Change Role Dialog */}
      <Portal>
        <Dialog visible={showRoleChangeDialog} onDismiss={() => setShowRoleChangeDialog(false)}>
          <Dialog.Title>Change Member Role</Dialog.Title>
          <Dialog.Content>
            {selectedMember && (
              <>
                <Text variant="bodyLarge" style={{ marginBottom: 16 }}>
                  Change role for <Text style={{ fontWeight: 'bold' }}>{selectedMember.name}</Text>?
                </Text>
                <View style={styles.roleCompare}>
                  <View>
                    <Text variant="bodySmall" style={{ color: '#666' }}>
                      Current:
                    </Text>
                    <Chip style={{ marginTop: 4 }}>
                      {getRoleDisplayName(selectedMember.role)}
                    </Chip>
                  </View>
                  <IconButton icon="arrow-right" />
                  <View>
                    <Text variant="bodySmall" style={{ color: '#666' }}>
                      New:
                    </Text>
                    <Chip
                      style={{
                        marginTop: 4,
                        backgroundColor: getRoleBadgeColor(selectedRole) + '20',
                      }}
                    >
                      {getRoleDisplayName(selectedRole)}
                    </Chip>
                  </View>
                </View>
                <Text variant="bodySmall" style={{ marginTop: 16, color: '#666' }}>
                  {getRoleDescription(selectedRole)}
                </Text>
              </>
            )}
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setShowRoleChangeDialog(false)}>Cancel</Button>
            <Button onPress={handleChangeRole} mode="contained">
              Change Role
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      {/* Remove Member Dialog */}
      <Portal>
        <Dialog visible={showRemoveDialog} onDismiss={() => setShowRemoveDialog(false)}>
          <Dialog.Title>Remove Member</Dialog.Title>
          <Dialog.Content>
            {selectedMember && (
              <>
                <Text variant="bodyLarge">
                  Are you sure you want to remove{' '}
                  <Text style={{ fontWeight: 'bold' }}>{selectedMember.name}</Text> from this
                  project?
                </Text>
                <Text variant="bodySmall" style={{ marginTop: 16, color: '#F44336' }}>
                  This action cannot be undone. They will lose access to all project resources.
                </Text>
              </>
            )}
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setShowRemoveDialog(false)}>Cancel</Button>
            <Button onPress={handleRemoveMember} mode="contained" buttonColor="#F44336">
              Remove
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  headerTitle: {
    fontWeight: 'bold',
  },
  headerSubtitle: {
    color: '#666',
    marginTop: 4,
  },
  actionButtonContainer: {
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
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
    flexDirection: 'row',
    alignItems: 'center',
  },
  memberInfo: {
    flex: 1,
    marginLeft: 16,
  },
  roleCompare: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    marginTop: 8,
  },
  // Add Member Dialog Styles
  dialog: {
    maxHeight: '85%',
  },
  dialogContent: {
    paddingHorizontal: 0,
    paddingTop: 0,
  },
  searchSection: {
    backgroundColor: '#F5F5F5',
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
    marginHorizontal: 24,
  },
  searchBar: {
    elevation: 0,
    backgroundColor: '#FFFFFF',
  },
  searchInput: {
    fontSize: 14,
    color: '#000000',
  },
  roleSelectionTop: {
    paddingHorizontal: 24,
    paddingTop: 8,
  },
  roleTopLabel: {
    fontWeight: '600',
    marginBottom: 4,
  },
  roleOptionsHorizontal: {
    flexDirection: 'row',
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
    alignItems: 'center',
  },
  emptyText: {
    textAlign: 'center',
    color: '#999',
    fontSize: 14,
  },
  userItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 8,
    marginBottom: 4,
  },
  userItemSelected: {
    backgroundColor: '#E3F2FD',
  },
  userItemContent: {
    flex: 1,
    marginLeft: 8,
  },
  userName: {
    fontWeight: '500',
    marginBottom: 2,
  },
  userEmail: {
    color: '#666',
    fontSize: 13,
  },
  roleSection: {
    marginTop: 16,
    paddingHorizontal: 24,
  },
  roleSectionTitle: {
    fontWeight: '600',
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
    backgroundColor: '#FFFFFF',
  },
  headerButton: {
    marginRight: 8,
  },
  roleSelectionSection: {
    padding: 16,
    backgroundColor: '#F5F5F5',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  roleLabel: {
    fontWeight: '600',
    marginBottom: 12,
    color: '#000',
  },
  segmentedButtons: {
    backgroundColor: '#FFFFFF',
  },
  searchContainer: {
    padding: 16,
    backgroundColor: '#FFFFFF',
  },
  searchBarFull: {
    elevation: 2,
    backgroundColor: '#FFFFFF',
  },
  selectionBanner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#E3F2FD',
    borderBottomWidth: 1,
    borderBottomColor: '#90CAF9',
  },
  selectionText: {
    fontWeight: '600',
    color: '#1976D2',
  },
  fullUserList: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  emptyStateFull: {
    paddingVertical: 48,
    alignItems: 'center',
  },
  userItemFull: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  userNameFull: {
    fontWeight: '500',
    marginBottom: 4,
    color: '#000',
  },
  userEmailFull: {
    color: '#666',
  },
});
