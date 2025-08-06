import { StyleSheet, View } from "react-native"
import { WWScreenView } from "../../components/ui/WWScreenView"
import { useExtendedTheme } from "../../theme"
import MapView, { Region, Marker, PROVIDER_GOOGLE } from "react-native-maps"
import { Searchbar, FAB } from "react-native-paper"
import { useCallback, useRef, useState } from "react"
import Geolocation from "@react-native-community/geolocation"
import { useGetDeploymentsQuery } from "../../redux/api/deployments"
import { useAppSelector } from "../../redux"

export const Maps = () => {
	const { colors } = useExtendedTheme()
	const [searchQuery, setSearchQuery] = useState("")
	const { data: deployments } = useGetDeploymentsQuery()
	const { locationEnabled } = useAppSelector((state) => state.locationStatus)

	const mapRef = useRef<MapView>(null)
	const [region, setRegion] = useState<Region>({
		latitude: -39.0556,
		longitude: 174.0752,
		latitudeDelta: 0.0922,
		longitudeDelta: 0.0421,
	})

	const zoomIn = useCallback(() => {
		if (!mapRef.current) return
		setRegion((prev) => ({
			...prev,
			latitudeDelta: prev.latitudeDelta / 2,
			longitudeDelta: prev.longitudeDelta / 2,
		}))
	}, [])

	const zoomOut = useCallback(() => {
		if (!mapRef.current) return
		setRegion((prev) => ({
			...prev,
			latitudeDelta: prev.latitudeDelta * 2,
			longitudeDelta: prev.longitudeDelta * 2,
		}))
	}, [])

	const getCurrentLocation = useCallback(() => {
		if (!locationEnabled) return

		Geolocation.getCurrentPosition(
			(position) => {
				const newRegion = {
					latitude: position.coords.latitude,
					longitude: position.coords.longitude,
					latitudeDelta: 0.0922,
					longitudeDelta: 0.0421,
				}
				setRegion(newRegion)
				mapRef.current?.animateToRegion(newRegion)
			},
			(error) => console.log(error),
			{ enableHighAccuracy: true, timeout: 20000, maximumAge: 1000 },
		)
	}, [locationEnabled])

	return (
		<WWScreenView>
			<View style={styles.container}>
				<View style={styles.searchContainer}>
					<Searchbar
						placeholder="Search location"
						onChangeText={setSearchQuery}
						value={searchQuery}
						style={styles.searchBar}
					/>
				</View>

				<MapView
					provider={PROVIDER_GOOGLE}
					ref={mapRef}
					style={styles.map}
					region={region}
					onRegionChange={setRegion}
					showsUserLocation={locationEnabled}
					showsMyLocationButton={false}
					onMapReady={() => console.log("🗺️ Maps: MapView ready")}
					onError={(error) => console.error("🚨 Maps: Error loading map:", error)}
					onLayout={() => console.log("🗺️ Maps: MapView layout complete")}
				>
					{deployments?.map((deployment) =>
						deployment.latitude && deployment.longitude ? (
							<Marker
								key={deployment.id}
								coordinate={{
									latitude: deployment.latitude,
									longitude: deployment.longitude,
								}}
								title={
									deployment.locationName ||
									`Deployment #${deployment.id.slice(-4)}`
								}
								description={deployment.deploymentComments}
							/>
						) : null,
					)}
				</MapView>

				<View style={styles.fabContainer}>
					<FAB
						icon="crosshairs-gps"
						style={[styles.fab, { backgroundColor: colors.primary }]}
						onPress={getCurrentLocation}
						color={colors.onPrimary}
					/>
					<FAB
						icon="plus"
						style={[styles.fab, { backgroundColor: colors.primary }]}
						onPress={zoomIn}
						color={colors.onPrimary}
					/>
					<FAB
						icon="minus"
						style={[styles.fab, { backgroundColor: colors.primary }]}
						onPress={zoomOut}
						color={colors.onPrimary}
					/>
				</View>
			</View>
		</WWScreenView>
	)
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
	},
	searchContainer: {
		position: "absolute",
		top: 10,
		left: 10,
		right: 10,
		zIndex: 1,
	},
	searchBar: {
		elevation: 5,
		borderRadius: 8,
	},
	map: {
		flex: 1,
	},
	fabContainer: {
		position: "absolute",
		right: 16,
		bottom: 16,
		gap: 8,
	},
	fab: {
		borderRadius: 8,
	},
})
