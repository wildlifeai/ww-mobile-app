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

import React, { useState, useMemo, useCallback } from "react"
import { ListRenderItemInfo } from "react-native"
import { useFocusEffect } from "@react-navigation/native"
import { useGetProjectsQuery } from "../../redux/api/projectsApi"
import { ProjectCard } from "../../components/ProjectCard"
import { useAppNavigation } from "../../hooks/useAppNavigation"
import type { ProjectWithDetails } from "../../types/project"
import { useAppSelector } from "../../redux"
import { StandardizedListLayout } from "../../components/ui/StandardizedListLayout"

export const Projects = () => {
	const navigation = useAppNavigation()

	// Query projects for current organisation
	const userId = useAppSelector((state) => state.authentication.user?.id)
	const organisationId = useAppSelector((state) => state.authentication.currentOrganisation?.id)

	const {
		data: projects,
		isLoading,
		isFetching,
		error,
		refetch,
	} = useGetProjectsQuery(
		{ userId: userId!, organisationId: organisationId! },
		{ skip: !userId || !organisationId }
	)

	// Refresh on focus
	useFocusEffect(
		useCallback(() => {
			refetch()
		}, [refetch])
	)

	// Search state
	const [searchQuery, setSearchQuery] = useState("")

	// Filter projects based on search query
	const filteredProjects = useMemo(() => {
		if (!projects) return []
		if (!searchQuery.trim()) return projects

		const query = searchQuery.toLowerCase()
		return projects.filter(
			(project) =>
				project.name.toLowerCase().includes(query) ||
				project.description?.toLowerCase().includes(query) ||
				project.organisation?.name?.toLowerCase().includes(query),
		)
	}, [projects, searchQuery])

	// Navigation handlers
	const handleProjectPress = useCallback(
		(projectId: string) => {
			navigation.navigate("ProjectDetailsScreen", { projectId })
		},
		[navigation],
	)

	const handleCreateProject = useCallback(() => {
		navigation.navigate("NewProjectScreen")
	}, [navigation])

	const renderItem = useCallback(
		({ item }: ListRenderItemInfo<ProjectWithDetails>) => (
			<ProjectCard project={item} onPress={() => handleProjectPress(item.id)} />
		),
		[handleProjectPress],
	)

	const keyExtractor = useCallback((item: ProjectWithDetails) => item.id, [])

	return (
		<StandardizedListLayout
			data={filteredProjects}
			renderItem={renderItem}
			keyExtractor={keyExtractor}
			isLoading={isLoading}
			isFetching={isFetching}
			onRefresh={refetch}
			error={error}
			onRetry={refetch}
			searchQuery={searchQuery}
			onSearchChange={setSearchQuery}
			searchPlaceholder="Search projects..."
			primaryActionLabel="New Project"
			onPrimaryAction={handleCreateProject}
			emptyStateTitle="No projects yet"
			emptyStateMessage="Create your first project to start managing wildlife camera deployments"
		/>
	)
}
