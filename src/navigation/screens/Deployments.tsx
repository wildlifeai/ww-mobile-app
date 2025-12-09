import { memo, useState, useMemo, useCallback } from "react"
import {
	FlatList,
	StyleSheet,
	View,
	RefreshControl,
	ListRenderItemInfo,
} from "react-native"
import {
	Searchbar,
	FAB,
	ActivityIndicator,
	Text,
	useTheme,
	Button,
} from "react-native-paper"
import { useAppNavigation } from "../../hooks/useAppNavigation"
import { WWScreenView } from "../../components/ui/WWScreenView"
import { WWLoader } from "../../components/ui/WWLoader"
import { useGetDeploymentsQuery } from "../../redux/api/deployments"
import { DeploymentCard } from "../../components/DeploymentCard"
import type { Deployment } from "../../types/deployment"

export const Deployments = memo(() => {
	const navigation = useAppNavigation()
	const theme = useTheme()

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
		// console.log(`pressed deployment ${deploymentId}`)
		// Navigate to details if exists, or just log for now
	}, [])

	const handleAddDeployment = useCallback(() => {
		navigation.navigate("AddDeployment")
	}, [navigation])

	// FlatList optimization
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
		<View style={styles.container}>
			{/* Search Bar */}
			<View style={styles.searchContainer}>
				<Searchbar
					placeholder="Search deployments..."
					onChangeText={setSearchQuery}
					value={searchQuery}
					style={styles.searchbar}
					testID="deployment-search-bar"
				/>
			</View>

			{/* Deployments List */}
			{isLoading && !deployments ? (
				<View style={styles.centerContainer}>
					<ActivityIndicator size="large" />
					<Text style={{ marginTop: 16, color: theme.colors.onSurfaceVariant }}>
						Loading deployments...
					</Text>
				</View>
			) : (
				<FlatList
					data={filteredDeployments}
					renderItem={renderItem}
					keyExtractor={keyExtractor}
					contentContainerStyle={styles.listContent}
					refreshControl={
						<RefreshControl
							refreshing={isFetching && !isLoading}
							onRefresh={refetch}
							colors={[theme.colors.primary]}
							tintColor={theme.colors.primary}
						/>
					}
					ListEmptyComponent={
						<View style={styles.centerContainer}>
							<Text variant="bodyLarge" style={{ color: theme.colors.onSurfaceVariant, textAlign: 'center' }}>
								{searchQuery
									? `No deployments found matching "${searchQuery}"`
									: "No deployments found. Create one to get started."}
							</Text>
						</View>
					}
				/>
			)}

			{/* Floating Action Button */}
			<FAB
				icon="plus"
				style={[styles.fab, { backgroundColor: theme.colors.primary }]}
				onPress={handleAddDeployment}
				label="New Deployment"
				testID="new-deployment-fab"
			/>
		</View>
	)
})

const styles = StyleSheet.create({
	container: {
		flex: 1,
	},
	searchContainer: {
		paddingHorizontal: 16,
		paddingVertical: 8,
		backgroundColor: "transparent",
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
		justifyContent: "center",
		alignItems: "center",
		padding: 32,
		marginTop: 64,
	},
	fab: {
		position: "absolute",
		margin: 16,
		right: 0,
		bottom: 0,
	},
})
