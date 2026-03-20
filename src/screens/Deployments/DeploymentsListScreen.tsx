import { useState, useMemo, useCallback, useEffect } from "react"
import { ListRenderItemInfo, View, StyleSheet } from "react-native"
import { FAB, Chip, Text } from 'react-native-paper'
import { useAppNavigation } from "../../hooks/useAppNavigation"
import { DeploymentCard } from "../../components/DeploymentCard"
import type Deployment from "../../database/models/Deployment"
import { useAppSelector } from "../../redux"
import { StandardizedListLayout } from "../../components/ui/StandardizedListLayout"
// import { useExtendedTheme } from "../../theme"
import { DeploymentService } from "../../services/DeploymentService"
import SupabaseSyncService from "../../services/SupabaseSyncService"
import { log, logError } from "../../utils/logger"

export const Deployments = () => {
	const navigation = useAppNavigation()
	// const theme = useExtendedTheme()
	
	const isGlobalSyncing = useAppSelector((state) => state.sync.isGlobalSyncing)
	const currentOrganisation = useAppSelector((state) => state.authentication.currentOrganisation)
	const organisationId = currentOrganisation?.id
	const organisationName = currentOrganisation?.name || 'your organisation'
	const hasMultipleOrgs = (useAppSelector((state) => state.authentication.user?.organisations)?.length ?? 0) > 1

	// Local state for deployments (replaces withObservables)
	const [deployments, setDeployments] = useState<Deployment[]>([])
	const [isLoading, setIsLoading] = useState(true)

	// Subscribe to deployments filtered by organisation
	useEffect(() => {
		setIsLoading(true)
		const observable = organisationId
			? DeploymentService.observeDeploymentsForOrganisation(organisationId)
			: DeploymentService.observeDeployments()

		const subscription = observable.subscribe({
			next: (results) => {
				setDeployments(results)
				setIsLoading(false)
			},
			error: (err) => {
				logError('[DeploymentsListScreen] Observable error:', err)
				setIsLoading(false)
			}
		})

		return () => subscription.unsubscribe()
	}, [organisationId])

	// Refresh state for pull-to-refresh
	const [isRefreshing, setIsRefreshing] = useState(false)

	// Search & Filter state
	const [searchQuery, setSearchQuery] = useState("")
	const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'ended'>('all')

	// Filter deployments based on search query and status
	const filteredDeployments = useMemo(() => {
		if (!deployments) return []

		let result = deployments

		// 1. Status Filter
		if (statusFilter === 'active') {
			result = result.filter(d => !(d as any).deploymentEnd)
		} else if (statusFilter === 'ended') {
			result = result.filter(d => !!(d as any).deploymentEnd)
		}

		// 2. Search Filter
		if (searchQuery.trim()) {
			const query = searchQuery.toLowerCase()
			result = result.filter(
				(deployment: any) =>
					deployment.name?.toLowerCase().includes(query) ||
					deployment.locationName?.toLowerCase().includes(query) ||
					deployment.startDeploymentComments?.toLowerCase().includes(query)
			)
		}

		return result
	}, [deployments, searchQuery, statusFilter])

	const handleDeploymentPress = useCallback((deploymentId: string) => {
		// Navigate to details if exists, or just log for now
		navigation.navigate('DeploymentDetails', { deploymentId })
	}, [navigation])

	const handleAddDeployment = useCallback(() => {
		// Use updated route name for the wizard
		navigation.navigate("StartDeploymentWizard", { mode: 'deployment' })
	}, [navigation])

	/**
	 * Handle pull-to-refresh
	 * Triggers a sync with Supabase to pull the latest deployment changes
	 * Observable will automatically update local state when new data arrives
	 */
	const handleRefresh = useCallback(async () => {
		setIsRefreshing(true)
		try {
			log('[DeploymentsListScreen] Syncing deployments with server...')
			// Trigger full sync which includes pulling latest changes
			// The observable will automatically trigger updates for components watching the data
			await SupabaseSyncService.sync()
			log('[DeploymentsListScreen] Sync completed successfully')
		} catch (error) {
			logError('[DeploymentsListScreen] Error syncing deployments:', error)
		} finally {
			setIsRefreshing(false)
		}
	}, [])

	const renderItem = useCallback(
		({ item }: ListRenderItemInfo<Deployment>) => (
			<DeploymentCard
				deployment={item}
				onPress={handleDeploymentPress}
			/>
		),
		[handleDeploymentPress],
	)

	const keyExtractor = useCallback((item: Deployment) => item.id, [])

	const hasActiveDeployments = useMemo(() => {
		return deployments?.some(d => !(d as any).deploymentEnd) ?? false
	}, [deployments])

	return (
		<View style={styles.container}>
			<StandardizedListLayout
				data={filteredDeployments}
				renderItem={renderItem}
				keyExtractor={keyExtractor}
				isLoading={isLoading || (isGlobalSyncing && (!deployments || deployments.length === 0))}
				isFetching={isRefreshing || isGlobalSyncing}
				onRefresh={handleRefresh}
				searchQuery={searchQuery}
				onSearchChange={setSearchQuery}
				searchPlaceholder="Search deployments..."
				primaryActionLabel="New Deployment"
				onPrimaryAction={handleAddDeployment}
				filterActions={
					<>
						<Chip
							selected={statusFilter === 'all'}
							onPress={() => setStatusFilter('all')}
							showSelectedCheck={false}
							style={styles.filterChip}
						>
							<Text>All</Text>
						</Chip>
						<Chip
							selected={statusFilter === 'active'}
							onPress={() => setStatusFilter('active')}
							showSelectedCheck={false}
							style={styles.filterChip}
						>
							<Text>Active</Text>
						</Chip>
						<Chip
							selected={statusFilter === 'ended'}
							onPress={() => setStatusFilter('ended')}
							showSelectedCheck={false}
							style={styles.filterChip}
						>
							<Text>Ended</Text>
						</Chip>
					</>
				}
				emptyStateTitle={hasMultipleOrgs ? `No deployments for ${organisationName}` : 'No deployments yet'}
				emptyStateMessage={
					statusFilter === 'all'
						? (hasMultipleOrgs
							? `There are no deployments yet for ${organisationName}. Create a new deployment or switch to a different organisation.`
							: 'Create a deployment to start tracking your devices in the field.')
						: `No ${statusFilter} deployments match your search`
				}
			/>

			{hasActiveDeployments && (
				<FAB
					icon="stop"
					label="End Deployment"
					style={[styles.fab, styles.endDeploymentFab]}
					color="#000"
					onPress={() => navigation.navigate("EndDeploymentWizard", { mode: 'end_deployment' } as any)}
				/>
			)}
		</View>
	)
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
	},
	filterChip: {
		marginRight: 4,
	},
	fab: {
		position: 'absolute',
		margin: 16,
		right: 0,
		bottom: 80, // Stack above the standard Primary Action FAB (usually at bottom: 16)
	},
	endDeploymentFab: {
		backgroundColor: '#FFAB00',
	}
})
