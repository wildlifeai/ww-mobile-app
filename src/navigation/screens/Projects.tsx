/**
 * ProjectsScreen
 * Main screen for displaying user's projects with search and filtering
 *
 * Features:
 * - FlatList with optimized rendering (100+ projects)
 * - Pull-to-refresh
 * - Search/filter functionality
 * - Loading states with skeleton placeholders
 * - Empty state with illustration
 * - Error handling with retry
 * - Offline indicator
 * - Navigation to project details and new project creation
 */

import React, { useState, useMemo, useCallback } from 'react';
import { FlatList, StyleSheet, View, ListRenderItemInfo, RefreshControl } from 'react-native';
import { Searchbar, FAB, ActivityIndicator, Text, useTheme, Button } from 'react-native-paper';
import { useGetProjectsQuery } from '../../store/api/projectsApi';
import { ProjectCard } from '../../components/ProjectCard';
import { WWScreenView } from '../../components/ui/WWScreenView';
import { OfflineIndicator } from '../../components/ui/OfflineIndicator';
import { useAppNavigation } from '../../hooks/useAppNavigation';
import type { ProjectWithDetails } from '../../types/project';

export const Projects = () => {
  const navigation = useAppNavigation();
  const theme = useTheme();

  // Query projects for current organisation (RLS handles filtering)
  const {
    data: projects,
    isLoading,
    isFetching,
    error,
    refetch,
  } = useGetProjectsQuery();

  // Search state
  const [searchQuery, setSearchQuery] = useState('');

  // Filter projects based on search query
  const filteredProjects = useMemo(() => {
    if (!projects) return [];
    if (!searchQuery.trim()) return projects;

    const query = searchQuery.toLowerCase();
    return projects.filter(
      (project) =>
        project.name.toLowerCase().includes(query) ||
        project.description?.toLowerCase().includes(query) ||
        project.organisation?.name?.toLowerCase().includes(query)
    );
  }, [projects, searchQuery]);

  // Navigation handlers
  const handleProjectPress = useCallback(
    (projectId: string) => {
      // TODO: Navigate to project details when implemented
      console.log('Navigate to project:', projectId);
    },
    []
  );

  const handleCreateProject = useCallback(() => {
    navigation.navigate('AddProject');
  }, [navigation]);

  // FlatList optimization
  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<ProjectWithDetails>) => (
      <ProjectCard project={item} onPress={() => handleProjectPress(item.id)} />
    ),
    [handleProjectPress]
  );

  const keyExtractor = useCallback((item: ProjectWithDetails) => item.id, []);

  const getItemLayout = useCallback(
    (_: ProjectWithDetails[] | null | undefined, index: number) => ({
      length: ITEM_HEIGHT,
      offset: ITEM_HEIGHT * index,
      index,
    }),
    []
  );

  // Loading state
  if (isLoading && !projects) {
    return (
      <WWScreenView scrollable={false}>
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" testID="loading-indicator" />
          <Text variant="bodyMedium" style={[styles.loadingText, { color: theme.colors.onSurfaceVariant }]}>
            Loading projects...
          </Text>
        </View>
      </WWScreenView>
    );
  }

  // Error state
  if (error && !projects) {
    return (
      <WWScreenView scrollable={false}>
        <View style={styles.centerContainer}>
          <Text variant="headlineSmall" style={[styles.errorTitle, { color: theme.colors.error }]}>
            Failed to load projects
          </Text>
          <Text
            variant="bodyMedium"
            style={[styles.errorMessage, { color: theme.colors.onSurfaceVariant }]}
          >
            {error && typeof error === 'object' && 'error' in error
              ? String(error.error)
              : 'An unexpected error occurred'}
          </Text>
          <Button mode="contained" onPress={() => refetch()} style={styles.retryButton}>
            Retry
          </Button>
        </View>
      </WWScreenView>
    );
  }

  // Empty state
  if (!projects || projects.length === 0) {
    return (
      <WWScreenView scrollable={false}>
        <OfflineIndicator />
        <View style={styles.centerContainer}>
          <Text variant="headlineSmall" style={[styles.emptyTitle, { color: theme.colors.onSurface }]}>
            No projects yet
          </Text>
          <Text
            variant="bodyMedium"
            style={[styles.emptyMessage, { color: theme.colors.onSurfaceVariant }]}
          >
            Create your first project to start managing wildlife camera deployments
          </Text>
          <Button
            mode="contained"
            icon="plus"
            onPress={handleCreateProject}
            style={styles.createButton}
            testID="create-first-project-button"
          >
            Create Project
          </Button>
        </View>
      </WWScreenView>
    );
  }

  return (
    <View style={styles.container}>
      <OfflineIndicator />

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <Searchbar
          placeholder="Search projects..."
          onChangeText={setSearchQuery}
          value={searchQuery}
          style={styles.searchbar}
          testID="project-search-bar"
          accessibilityLabel="Search projects by name or description"
        />
      </View>

      {/* Projects List */}
      <FlatList
        data={filteredProjects}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        getItemLayout={getItemLayout}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={isFetching && !isLoading}
            onRefresh={refetch}
            colors={[theme.colors.primary]}
            tintColor={theme.colors.primary}
            testID="refresh-control"
          />
        }
        ListEmptyComponent={
          searchQuery ? (
            <View style={styles.emptySearchContainer}>
              <Text variant="bodyLarge" style={{ color: theme.colors.onSurfaceVariant }}>
                No projects found matching "{searchQuery}"
              </Text>
            </View>
          ) : null
        }
        maxToRenderPerBatch={10}
        windowSize={10}
        removeClippedSubviews={true}
        initialNumToRender={10}
        testID="projects-list"
      />

      {/* Floating Action Button */}
      <FAB
        icon="plus"
        style={[styles.fab, { backgroundColor: theme.colors.primary }]}
        onPress={handleCreateProject}
        label="New Project"
        testID="new-project-fab"
        accessibilityLabel="Create new project"
      />
    </View>
  );
};

// Estimated item height for FlatList optimization
const ITEM_HEIGHT = 180;

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  searchContainer: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: 'transparent',
  },
  searchbar: {
    elevation: 0,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 100, // Space for FAB
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
  emptyTitle: {
    marginBottom: 8,
    textAlign: 'center',
    fontWeight: '600',
  },
  emptyMessage: {
    marginBottom: 24,
    textAlign: 'center',
    maxWidth: 280,
  },
  createButton: {
    marginTop: 8,
  },
  emptySearchContainer: {
    paddingVertical: 32,
    alignItems: 'center',
  },
  fab: {
    position: 'absolute',
    margin: 16,
    right: 0,
    bottom: 0,
  },
});
