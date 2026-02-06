import { useState, useMemo, useCallback } from "react"
import { ListRenderItemInfo, View, StyleSheet } from "react-native"
import { withObservables } from '@nozbe/watermelondb/react'
import { FAB, Chip } from 'react-native-paper'
import { useAppNavigation } from "../../hooks/useAppNavigation"
import { DeploymentCard } from "../../components/DeploymentCard"
import type Deployment from "../../database/models/Deployment"
import { StandardizedListLayout } from "../../components/ui/StandardizedListLayout"
// import { useExtendedTheme } from "../../theme"
import { DeploymentService } from "../../services/DeploymentService"

type Props = {
	deployments: Deployment[]
}

const DeploymentsComponent = ({ deployments }: Props) => {
	const navigation = useAppNavigation()
	// const theme = useExtendedTheme()


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
				isLoading={false}
				isFetching={false}
				// onRefresh={refetch} // No manual refresh needed with observables
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
							All
						</Chip>
						<Chip
							selected={statusFilter === 'active'}
							onPress={() => setStatusFilter('active')}
							showSelectedCheck={false}
							style={styles.filterChip}
						>
							Active
						</Chip>
						<Chip
							selected={statusFilter === 'ended'}
							onPress={() => setStatusFilter('ended')}
							showSelectedCheck={false}
							style={styles.filterChip}
						>
							Ended
						</Chip>
					</>
				}
				emptyStateTitle="No deployments found"
				emptyStateMessage={
					statusFilter === 'all'
						? "Create a deployment to track your devices in the field"
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

const enhance = withObservables([], () => ({
	deployments: DeploymentService.observeDeployments()
}))

export const Deployments = enhance(DeploymentsComponent)
