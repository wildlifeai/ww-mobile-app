import { View, StyleSheet } from "react-native"
import { ActivityIndicator } from "react-native-paper"

export const AppLoading = () => {
	return (
		<View style={[styles.loader]}>
			<ActivityIndicator size={30} />
		</View>
	)
}

const styles = StyleSheet.create({
	loader: {
		flex: 1,
		justifyContent: "center",
		alignItems: "center",
		padding: 30,
	},
	title: {
		marginBottom: 15,
	},
})
