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

import { useState, useMemo, useCallback, useEffect, useRef } from "react"
import { ListRenderItemInfo } from "react-native"
import { useFocusEffect } from "@react-navigation/native"
import { useGetProjectsQuery } from "../../redux/api/projectsApi"
import { ProjectCard } from "../../components/ProjectCard"
import { useAppNavigation } from "../../hooks/useAppNavigation"
import type { ProjectWithDetails } from "../../types/project"
import { useAppSelector } from "../../redux"
import { StandardizedListLayout } from "../../components/ui/StandardizedListLayout"
import SupabaseSyncService from "../../services/SupabaseSyncService"
import { logError } from "../../utils/logger"

export const Projects = () => {
	const navigation = useAppNavigation()

	// Query projects for current organisation
	const userId = useAppSelector((state) => state.authentication.user?.id)
	const currentOrganisation = useAppSelector((state) => state.authentication.currentOrganisation)
	const organisationId = currentOrganisation?.id
	const organisationName = currentOrganisation?.name || 'your organisation'
	const hasMultipleOrgs = (useAppSelector((state) => state.authentication.user?.organisations)?.length ?? 0) > 1
	const isGlobalSyncing = useAppSelector((state) => state.sync.isGlobalSyncing)
	const [refreshing, setRefreshing] = useState(false)

	const {
		data: projects,
		isLoading,
		isFetching,
		error,
		refetch: forceRefetch,
	} = useGetProjectsQuery(
		{ userId: userId!, organisationId: organisationId! },
		{ skip: !userId || !organisationId }
	)

	// Refetch when global sync finishes
	const wasSyncing = useRef(isGlobalSyncing)
	useEffect(() => {
		if (wasSyncing.current && !isGlobalSyncing && userId && organisationId) {
			forceRefetch()
		}
		wasSyncing.current = isGlobalSyncing
	}, [isGlobalSyncing, forceRefetch, userId, organisationId])

	// Refresh on subsequent focus (skip initial mount)
	const isFirstFocus = useRef(true)
	useFocusEffect(
		useCallback(() => {
			if (isFirstFocus.current) {
				isFirstFocus.current = false
				return
			}
			if (userId && organisationId) {
				forceRefetch()
			}
		}, [forceRefetch, userId, organisationId])
	)

	const handleRefresh = useCallback(async () => {
		setRefreshing(true)
		try {
			await SupabaseSyncService.sync()
		} catch (err) {
			logError('[ProjectsListScreen] Error syncing projects:', err)
		} finally {
			setRefreshing(false)
		}
	}, [])

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
			isLoading={isLoading || (isGlobalSyncing && (!projects || projects.length === 0))}
			isFetching={isFetching || isGlobalSyncing || refreshing}
			onRefresh={handleRefresh}
			error={error}
			onRetry={forceRefetch}
			searchQuery={searchQuery}
			onSearchChange={setSearchQuery}
			searchPlaceholder="Search projects..."
			primaryActionLabel="New Project"
			onPrimaryAction={handleCreateProject}
			emptyStateTitle={hasMultipleOrgs ? `No projects for ${organisationName}` : 'No projects yet'}
			emptyStateMessage={hasMultipleOrgs
				? `There are no projects yet for ${organisationName}. Create a new project or switch to a different organisation.`
				: 'Create your first project to start managing wildlife camera deployments.'
			}
		/>
	)
}
