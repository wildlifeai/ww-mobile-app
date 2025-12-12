import { memo, useState, useMemo, useCallback } from "react"
import { ListRenderItemInfo } from "react-native"
import { useAppNavigation } from "../../hooks/useAppNavigation"
import { useGetDeploymentsQuery } from "../../redux/api/deployments"
import { DeploymentCard } from "../../components/DeploymentCard"
import type { Deployment } from "../../types/deployment"
import { StandardizedListLayout } from "../../components/ui/StandardizedListLayout"

export const Deployments = memo(() => {
	const navigation = useAppNavigation()

	// Query deployments
	const {
		data: deployments,
		isLoading,
		isFetching,
		refetch
	} = useGetDeploymentsQuery()

	// Search state
	const [searchQuery, setSearchQuery] = useState("")

	// Filter deployments based on search query
	const filteredDeployments = useMemo(() => {
		if (!deployments) return []
		if (!searchQuery.trim()) return deployments

		const query = searchQuery.toLowerCase()
		return deployments.filter(
			(deployment) =>
				deployment.site_name?.toLowerCase().includes(query) ||
				deployment.notes?.toLowerCase().includes(query)
		)
	}, [deployments, searchQuery])

	const handleDeploymentPress = useCallback((deploymentId: string) => {
		// Navigate to details if exists, or just log for now
		// navigation.navigate('DeploymentDetails', { deploymentId })
	}, [navigation])

	const handleAddDeployment = useCallback(() => {
		navigation.navigate("AddDeployment")
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

	return (
		<StandardizedListLayout
			data={filteredDeployments}
			renderItem={renderItem}
			keyExtractor={keyExtractor}
			isLoading={isLoading}
			isFetching={isFetching}
			onRefresh={refetch}
			searchQuery={searchQuery}
			onSearchChange={setSearchQuery}
			searchPlaceholder="Search deployments..."
			primaryActionLabel="New Deployment"
			onPrimaryAction={handleAddDeployment}
			emptyStateTitle="No deployments yet"
			emptyStateMessage="Create a deployment to track your devices in the field"
		/>
	)
})
