import { useReducer, useMemo, useCallback, useEffect } from "react"
import { ListRenderItemInfo, View, StyleSheet } from "react-native"
import { FAB, Chip, Text } from 'react-native-paper'
import { useAppNavigation } from "../../hooks/useAppNavigation"
import { useFocusEffect } from "@react-navigation/native"
import { DeploymentCard } from "../../components/DeploymentCard"
import type Deployment from "../../database/models/Deployment"
import { useAppSelector } from "../../redux"
import { StandardizedListLayout } from "../../components/ui/StandardizedListLayout"
// import { useExtendedTheme } from "../../theme"
import { DeploymentService } from "../../services/DeploymentService"
import SupabaseSyncService from "../../services/SupabaseSyncService"
import { log, logError } from "../../utils/logger"

interface DeploymentsState {
	deployments: Deployment[];
	isLoading: boolean;
	isRefreshing: boolean;
	searchQuery: string;
	statusFilter: 'all' | 'active' | 'ended';
}

type DeploymentsAction =
	| { type: 'SET_DEPLOYMENTS'; payload: Deployment[] }
	| { type: 'SET_LOADING'; payload: boolean }
	| { type: 'SET_REFRESHING'; payload: boolean }
	| { type: 'SET_SEARCH_QUERY'; payload: string }
	| { type: 'SET_STATUS_FILTER'; payload: 'all' | 'active' | 'ended' }

const initialState: DeploymentsState = {
	deployments: [],
	isLoading: true,
	isRefreshing: false,
	searchQuery: "",
	statusFilter: 'all',
}

function deploymentsReducer(state: DeploymentsState, action: DeploymentsAction): DeploymentsState {
	switch (action.type) {
		case 'SET_DEPLOYMENTS':
			return { ...state, deployments: action.payload, isLoading: false }
		case 'SET_LOADING':
			return { ...state, isLoading: action.payload }
		case 'SET_REFRESHING':
			return { ...state, isRefreshing: action.payload }
		case 'SET_SEARCH_QUERY':
			return { ...state, searchQuery: action.payload }
		case 'SET_STATUS_FILTER':
			return { ...state, statusFilter: action.payload }
		default:
			return state
	}
}

export const Deployments = () => {
	const navigation = useAppNavigation()
	// const theme = useExtendedTheme()
	
	const isGlobalSyncing = useAppSelector((state) => state.sync.isGlobalSyncing)
	const currentOrganisation = useAppSelector((state) => state.authentication.currentOrganisation)
	const userId = useAppSelector((state) => state.authentication.user?.id)
	const organisationId = currentOrganisation?.id
	const organisationName = currentOrganisation?.name || 'your organisation'
	const hasMultipleOrgs = (useAppSelector((state) => state.authentication.user?.organisations)?.length ?? 0) > 1

	const [state, dispatch] = useReducer(deploymentsReducer, initialState)
	const { deployments, isLoading, isRefreshing, searchQuery, statusFilter } = state

	const loadDeployments = useCallback(async () => {
		try {
			if (!userId) {
				log('[DeploymentsListScreen] No user ID available, cannot load deployments')
				dispatch({ type: 'SET_DEPLOYMENTS', payload: [] })
				return
			}

			const deploymentsList = organisationId
				? await DeploymentService.getDeploymentsForUserInOrganisation(userId, organisationId)
				: await DeploymentService.getDeploymentsForUser(userId)

			dispatch({ type: 'SET_DEPLOYMENTS', payload: deploymentsList })
		} catch (error) {
			logError('[DeploymentsListScreen] Error loading deployments:', error)
		} finally {
			dispatch({ type: 'SET_LOADING', payload: false })
			dispatch({ type: 'SET_REFRESHING', payload: false })
		}
	}, [userId, organisationId])

	// Fetch deployments on focus
	useFocusEffect(
		useCallback(() => {
			loadDeployments()
		}, [loadDeployments])
	)

	// Reload deployments when global sync finishes
	useEffect(() => {
		if (!isGlobalSyncing) {
			loadDeployments()
		}
	}, [isGlobalSyncing, loadDeployments])

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
		dispatch({ type: 'SET_REFRESHING', payload: true })
		try {
			log('[DeploymentsListScreen] Syncing deployments with server...')
			await SupabaseSyncService.sync()
			log('[DeploymentsListScreen] Sync completed successfully')
			// The useFocusEffect/useEffect will reload the data once sync is finished
		} catch (error) {
			logError('[DeploymentsListScreen] Error syncing deployments:', error)
			dispatch({ type: 'SET_REFRESHING', payload: false })
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
				onSearchChange={(text) => dispatch({ type: 'SET_SEARCH_QUERY', payload: text })}
				searchPlaceholder="Search deployments..."
				primaryActionLabel="New Deployment"
				onPrimaryAction={handleAddDeployment}
				filterActions={
					<>
						<Chip
							selected={statusFilter === 'all'}
							onPress={() => dispatch({ type: 'SET_STATUS_FILTER', payload: 'all' })}
							showSelectedCheck={false}
							style={styles.filterChip}
						>
							<Text>All</Text>
						</Chip>
						<Chip
							selected={statusFilter === 'active'}
							onPress={() => dispatch({ type: 'SET_STATUS_FILTER', payload: 'active' })}
							showSelectedCheck={false}
							style={styles.filterChip}
						>
							<Text>Active</Text>
						</Chip>
						<Chip
							selected={statusFilter === 'ended'}
							onPress={() => dispatch({ type: 'SET_STATUS_FILTER', payload: 'ended' })}
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
