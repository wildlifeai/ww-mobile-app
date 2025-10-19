/**
 * ProjectDetailsScreen
 * View and edit project details with member management
 *
 * Features:
 * - View mode: Display project details, stats, and members
 * - Edit mode: Toggle to edit project information
 * - Delete: Confirmation dialog before deletion
 * - Member management: Add/remove project members
 * - Offline-first: All operations work offline with background sync
 * - Loading states: Proper skeleton/spinner for data fetching
 */

import React, { useState, useCallback } from 'react';
import { StyleSheet, View, ScrollView, Alert } from 'react-native';
import { useForm, Controller } from 'react-hook-form';
import {
  Text,
  useTheme,
  ActivityIndicator,
  Card,
  Divider,
  IconButton,
  Chip,
  Portal,
  Dialog,
  Button
} from 'react-native-paper';
import { useRoute } from '@react-navigation/native';
import {
  useGetProjectByIdQuery,
  useUpdateProjectMutation,
  useDeleteProjectMutation,
  useGetProjectMembersQuery,
  useRemoveProjectMemberMutation
} from '../../redux/api/projectsApi';
import { WWScreenView } from '../../components/ui/WWScreenView';
import { WWTextInput } from '../../components/ui/WWTextInput';
import { WWButton } from '../../components/ui/WWButton';
import { WWCheckbox } from '../../components/ui/WWCheckbox';
import { WWIcon } from '../../components/ui/WWIcon';
import { OfflineIndicator } from '../../components/ui/OfflineIndicator';
import { Field } from '../../components/form/Field';
import { useAppNavigation } from '../../hooks/useAppNavigation';
import type { AppParams } from '../index';
import type { ProjectWithDetails } from '../../types/project';

interface ProjectFormData {
  name: string;
  description: string;
  sampling_design: string;
  privacy_level: 'public' | 'internal' | 'private';
  is_baited: boolean;
  is_monitoring_marked_individual: boolean;
  website: string;
}

export const ProjectDetailsScreen = () => {
  const navigation = useAppNavigation();
  const theme = useTheme();
  const route = useRoute<AppParams<'ProjectDetailsScreen'>>();
  const { projectId } = route.params;

  // State
  const [isEditMode, setIsEditMode] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  // Queries and mutations
  const { data: project, isLoading, error, refetch } = useGetProjectByIdQuery(projectId);
  const { data: members, isLoading: membersLoading } = useGetProjectMembersQuery(projectId);
  const [updateProject, { isLoading: isUpdating }] = useUpdateProjectMutation();
  const [deleteProject, { isLoading: isDeleting }] = useDeleteProjectMutation();
  const [removeMember] = useRemoveProjectMemberMutation();

  // Form
  const {
    control,
    handleSubmit,
    reset,
    formState: { errors, isDirty }
  } = useForm<ProjectFormData>({
    defaultValues: {
      name: project?.name || '',
      description: project?.description || '',
      sampling_design: project?.sampling_design || '',
      privacy_level: project?.privacy_level || 'private',
      is_baited: project?.is_baited || false,
      is_monitoring_marked_individual: project?.is_monitoring_marked_individual || false,
      website: project?.website || '',
    }
  });

  // Reset form when project data loads
  React.useEffect(() => {
    if (project) {
      reset({
        name: project.name,
        description: project.description || '',
        sampling_design: project.sampling_design || '',
        privacy_level: project.privacy_level || 'private',
        is_baited: project.is_baited || false,
        is_monitoring_marked_individual: project.is_monitoring_marked_individual || false,
        website: project.website || '',
      });
    }
  }, [project, reset]);

  // Handlers
  const handleEdit = useCallback(() => {
    setIsEditMode(true);
  }, []);

  const handleCancelEdit = useCallback(() => {
    reset();
    setIsEditMode(false);
  }, [reset]);

  const handleSave = useCallback(async (data: ProjectFormData) => {
    try {
      await updateProject({
        id: projectId,
        updates: {
          name: data.name.trim(),
          description: data.description.trim() || null,
          sampling_design: data.sampling_design.trim() || null,
          privacy_level: data.privacy_level,
          is_baited: data.is_baited,
          is_monitoring_marked_individual: data.is_monitoring_marked_individual,
          website: data.website.trim() || null,
        }
      }).unwrap();

      setIsEditMode(false);
      refetch();
    } catch (error) {
      console.error('Failed to update project:', error);
      Alert.alert(
        'Update Failed',
        'Failed to update project. Please try again.',
        [{ text: 'OK' }]
      );
    }
  }, [projectId, updateProject, refetch]);

  const handleDelete = useCallback(async () => {
    try {
      await deleteProject(projectId).unwrap();
      setShowDeleteDialog(false);
      navigation.goBack();
    } catch (error) {
      console.error('Failed to delete project:', error);
      Alert.alert(
        'Delete Failed',
        'Failed to delete project. Please try again.',
        [{ text: 'OK' }]
      );
    }
  }, [projectId, deleteProject, navigation]);

  const handleRemoveMember = useCallback(async (userId: string) => {
    Alert.alert(
      'Remove Member',
      'Are you sure you want to remove this member from the project?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              await removeMember({ projectId, userId }).unwrap();
            } catch (error) {
              console.error('Failed to remove member:', error);
              Alert.alert('Error', 'Failed to remove member');
            }
          }
        }
      ]
    );
  }, [projectId, removeMember]);

  // Loading state
  if (isLoading) {
    return (
      <WWScreenView scrollable={false}>
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" testID="loading-indicator" />
          <Text variant="bodyMedium" style={[styles.loadingText, { color: theme.colors.onSurfaceVariant }]}>
            Loading project...
          </Text>
        </View>
      </WWScreenView>
    );
  }

  // Error state
  if (error || !project) {
    return (
      <WWScreenView scrollable={false}>
        <View style={styles.centerContainer}>
          <Text variant="headlineSmall" style={[styles.errorTitle, { color: theme.colors.error }]}>
            Failed to load project
          </Text>
          <Text variant="bodyMedium" style={[styles.errorMessage, { color: theme.colors.onSurfaceVariant }]}>
            {error && typeof error === 'object' && 'error' in error
              ? String(error.error)
              : 'Project not found'}
          </Text>
          <Button mode="contained" onPress={() => refetch()} style={styles.retryButton}>
            Retry
          </Button>
        </View>
      </WWScreenView>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <OfflineIndicator />

      <View style={styles.content}>
        {/* Header Card */}
        <Card mode="outlined" style={styles.card}>
          <Card.Content>
            <View style={styles.headerRow}>
              {isEditMode ? (
                <View style={styles.flex1}>
                  <Field
                    control={control}
                    name="name"
                    label="Project Name"
                    required
                    rules={{
                      required: 'Project name is required',
                      minLength: { value: 3, message: 'At least 3 characters' },
                      maxLength: { value: 100, message: 'Max 100 characters' }
                    }}
                  >
                    {(field) => (
                      <WWTextInput
                        {...field}
                        mode="outlined"
                        error={!!errors.name}
                        testID="project-name-input"
                      />
                    )}
                  </Field>
                </View>
              ) : (
                <View style={styles.flex1}>
                  <Text variant="headlineMedium" style={{ color: theme.colors.onSurface }}>
                    {project.name}
                  </Text>
                  {project.organisation?.name && (
                    <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant, marginTop: 4 }}>
                      {project.organisation.name}
                    </Text>
                  )}
                </View>
              )}

              {!isEditMode && (
                <View style={styles.actionButtons}>
                  <IconButton
                    icon="pencil"
                    size={24}
                    onPress={handleEdit}
                    testID="edit-button"
                  />
                  <IconButton
                    icon="delete"
                    size={24}
                    iconColor={theme.colors.error}
                    onPress={() => setShowDeleteDialog(true)}
                    testID="delete-button"
                  />
                </View>
              )}
            </View>

            {/* Description */}
            {isEditMode ? (
              <Field
                control={control}
                name="description"
                label="Description"
                rules={{
                  maxLength: { value: 500, message: 'Max 500 characters' }
                }}
              >
                {(field) => (
                  <WWTextInput
                    {...field}
                    mode="outlined"
                    multiline
                    numberOfLines={4}
                    error={!!errors.description}
                    testID="project-description-input"
                  />
                )}
              </Field>
            ) : project.description ? (
              <Text
                variant="bodyMedium"
                style={[styles.description, { color: theme.colors.onSurfaceVariant }]}
              >
                {project.description}
              </Text>
            ) : (
              <Text
                variant="bodyMedium"
                style={[styles.description, { color: theme.colors.onSurfaceDisabled }]}
              >
                No description
              </Text>
            )}
          </Card.Content>
        </Card>

        {/* Stats Cards */}
        {!isEditMode && (
          <View style={styles.statsContainer}>
            <Card mode="outlined" style={styles.statCard}>
              <Card.Content style={styles.statContent}>
                <WWIcon source="account-group" size={32} color={theme.colors.primary} />
                <Text variant="headlineSmall" style={{ color: theme.colors.onSurface }}>
                  {project.member_count || 0}
                </Text>
                <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                  Members
                </Text>
              </Card.Content>
            </Card>

            <Card mode="outlined" style={styles.statCard}>
              <Card.Content style={styles.statContent}>
                <WWIcon source="map-marker-multiple" size={32} color={theme.colors.primary} />
                <Text variant="headlineSmall" style={{ color: theme.colors.onSurface }}>
                  {project.deployment_count || 0}
                </Text>
                <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                  Deployments
                </Text>
              </Card.Content>
            </Card>

            <Card mode="outlined" style={styles.statCard}>
              <Card.Content style={styles.statContent}>
                <WWIcon source="access-point" size={32} color={theme.colors.primary} />
                <Text variant="headlineSmall" style={{ color: theme.colors.onSurface }}>
                  {project.lorawan_device_count || 0}
                </Text>
                <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                  Devices
                </Text>
              </Card.Content>
            </Card>
          </View>
        )}

        {/* Settings Section */}
        <Card mode="outlined" style={styles.card}>
          <Card.Content>
            <Text variant="titleMedium" style={[styles.sectionTitle, { color: theme.colors.onSurface }]}>
              Settings
            </Text>

            {isEditMode ? (
              <View>
                <Field control={control} name="sampling_design" label="Sampling Design">
                  {(field) => (
                    <WWTextInput
                      {...field}
                      mode="outlined"
                      placeholder="e.g., Random, Systematic, Stratified"
                      testID="sampling-design-input"
                    />
                  )}
                </Field>

                <Field control={control} name="website" label="Website">
                  {(field) => (
                    <WWTextInput
                      {...field}
                      mode="outlined"
                      placeholder="https://example.com"
                      keyboardType="url"
                      autoCapitalize="none"
                      testID="website-input"
                    />
                  )}
                </Field>

                <View style={styles.privacyGroup}>
                  <Text variant="bodyMedium" style={[styles.label, { color: theme.colors.onSurface }]}>
                    Privacy Level
                  </Text>
                  <Controller
                    control={control}
                    name="privacy_level"
                    render={({ field: { value, onChange } }) => (
                      <View style={styles.radioOptions}>
                        <WWCheckbox
                          label="Private"
                          value={value === 'private'}
                          onChange={() => onChange('private')}
                          testID="privacy-private"
                        />
                        <WWCheckbox
                          label="Internal"
                          value={value === 'internal'}
                          onChange={() => onChange('internal')}
                          testID="privacy-internal"
                        />
                        <WWCheckbox
                          label="Public"
                          value={value === 'public'}
                          onChange={() => onChange('public')}
                          testID="privacy-public"
                        />
                      </View>
                    )}
                  />
                </View>

                <Controller
                  control={control}
                  name="is_baited"
                  render={({ field: { value, onChange } }) => (
                    <WWCheckbox
                      label="Using Bait"
                      value={value}
                      onChange={onChange}
                      testID="is-baited-checkbox"
                    />
                  )}
                />

                <Controller
                  control={control}
                  name="is_monitoring_marked_individual"
                  render={({ field: { value, onChange } }) => (
                    <WWCheckbox
                      label="Monitoring Marked Individuals"
                      value={value}
                      onChange={onChange}
                      testID="is-monitoring-marked-checkbox"
                    />
                  )}
                />
              </View>
            ) : (
              <View>
                {project.sampling_design && (
                  <View style={styles.settingRow}>
                    <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
                      Sampling Design:
                    </Text>
                    <Text variant="bodyMedium" style={{ color: theme.colors.onSurface }}>
                      {project.sampling_design}
                    </Text>
                  </View>
                )}

                {project.website && (
                  <View style={styles.settingRow}>
                    <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
                      Website:
                    </Text>
                    <Text variant="bodyMedium" style={{ color: theme.colors.primary }}>
                      {project.website}
                    </Text>
                  </View>
                )}

                <View style={styles.settingRow}>
                  <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
                    Privacy:
                  </Text>
                  <Chip mode="outlined">{project.privacy_level || 'private'}</Chip>
                </View>

                {project.is_baited && (
                  <View style={styles.settingRow}>
                    <WWIcon source="checkbox-marked" size={20} color={theme.colors.primary} />
                    <Text variant="bodyMedium" style={{ color: theme.colors.onSurface }}>
                      Using Bait
                    </Text>
                  </View>
                )}

                {project.is_monitoring_marked_individual && (
                  <View style={styles.settingRow}>
                    <WWIcon source="checkbox-marked" size={20} color={theme.colors.primary} />
                    <Text variant="bodyMedium" style={{ color: theme.colors.onSurface }}>
                      Monitoring Marked Individuals
                    </Text>
                  </View>
                )}
              </View>
            )}
          </Card.Content>
        </Card>

        {/* Members Section */}
        {!isEditMode && (
          <Card mode="outlined" style={styles.card}>
            <Card.Content>
              <View style={styles.sectionHeader}>
                <Text variant="titleMedium" style={{ color: theme.colors.onSurface }}>
                  Members
                </Text>
                <Button
                  mode="text"
                  icon="account-multiple"
                  onPress={() => {
                    navigation.navigate('ProjectMembersScreen', {
                      projectId: project.id,
                      projectName: project.name,
                    });
                  }}
                  testID="manage-members-button"
                >
                  Manage
                </Button>
              </View>

              <Divider style={styles.divider} />

              {membersLoading ? (
                <ActivityIndicator size="small" />
              ) : members && members.length > 0 ? (
                <View style={styles.membersList}>
                  {members.map((member) => (
                    <View key={member.user_id} style={styles.memberRow}>
                      <View style={styles.memberInfo}>
                        <WWIcon source="account-circle" size={40} color={theme.colors.onSurfaceVariant} />
                        <View style={styles.memberDetails}>
                          <Text variant="bodyMedium" style={{ color: theme.colors.onSurface }}>
                            {member.user_profile?.name || 'Unknown User'}
                          </Text>
                          {member.role?.value && (
                            <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                              {member.role.value}
                            </Text>
                          )}
                        </View>
                      </View>
                      <IconButton
                        icon="close"
                        size={20}
                        iconColor={theme.colors.error}
                        onPress={() => handleRemoveMember(member.user_id)}
                        testID={`remove-member-${member.user_id}`}
                      />
                    </View>
                  ))}
                </View>
              ) : (
                <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
                  No members yet
                </Text>
              )}
            </Card.Content>
          </Card>
        )}

        {/* Edit Mode Actions */}
        {isEditMode && (
          <View style={styles.editActions}>
            <WWButton
              mode="outlined"
              onPress={handleCancelEdit}
              disabled={isUpdating}
              style={styles.actionButton}
              testID="cancel-button"
            >
              Cancel
            </WWButton>
            <WWButton
              mode="contained"
              onPress={handleSubmit(handleSave)}
              loading={isUpdating}
              disabled={isUpdating || !isDirty}
              style={styles.actionButton}
              testID="save-button"
            >
              Save Changes
            </WWButton>
          </View>
        )}
      </View>

      {/* Delete Confirmation Dialog */}
      <Portal>
        <Dialog visible={showDeleteDialog} onDismiss={() => setShowDeleteDialog(false)}>
          <Dialog.Title>Delete Project</Dialog.Title>
          <Dialog.Content>
            <Text variant="bodyMedium">
              Are you sure you want to delete "{project.name}"? This action cannot be undone.
            </Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setShowDeleteDialog(false)} disabled={isDeleting}>
              Cancel
            </Button>
            <Button
              onPress={handleDelete}
              loading={isDeleting}
              disabled={isDeleting}
              textColor={theme.colors.error}
              testID="confirm-delete-button"
            >
              Delete
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingBottom: 32,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  loadingText: {
    marginTop: 16,
  },
  errorTitle: {
    marginBottom: 8,
    textAlign: 'center',
  },
  errorMessage: {
    marginBottom: 24,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 8,
  },
  card: {
    marginBottom: 16,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  flex1: {
    flex: 1,
  },
  actionButtons: {
    flexDirection: 'row',
    marginLeft: 8,
  },
  description: {
    marginTop: 8,
    lineHeight: 20,
  },
  statsContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  statCard: {
    flex: 1,
  },
  statContent: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  sectionTitle: {
    fontWeight: '600',
    marginBottom: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  privacyGroup: {
    marginBottom: 16,
  },
  label: {
    marginBottom: 8,
    fontWeight: '500',
  },
  radioOptions: {
    gap: 8,
  },
  divider: {
    marginVertical: 12,
  },
  membersList: {
    gap: 12,
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  memberInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  memberDetails: {
    marginLeft: 12,
    flex: 1,
  },
  editActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  actionButton: {
    flex: 1,
  },
});
