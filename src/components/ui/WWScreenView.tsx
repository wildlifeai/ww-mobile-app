import { PropsWithChildren } from "react"
import {
	Keyboard,
	Platform,
	ScrollView,
	ScrollViewProps,
	StyleSheet,
	TouchableWithoutFeedback,
	View,
	ViewProps,
} from "react-native"
import { useExtendedTheme } from "../../theme"
import { useSafeAreaInsets } from "react-native-safe-area-context"

type Props = PropsWithChildren<ViewProps | ScrollViewProps> & {
	scrollable?: boolean
}

export const WWScreenView = ({
	children,
	scrollable = true,
	...props
}: Props) => {
	const { appPadding } = useExtendedTheme()
	const { bottom, top } = useSafeAreaInsets()

	// Robust Safe Area for Android: If top inset is 0, assume we might be behind a translucent bar and add decent padding.
	const safeTop = top > 0 ? top : (Platform.OS === 'android' ? 30 : 0)

	return (
		<TouchableWithoutFeedback style={styles.view} onPress={Keyboard.dismiss}>
			{scrollable ? (
				<ScrollView
					style={styles.scrollView}
					contentContainerStyle={[
						{ padding: appPadding, paddingBottom: appPadding + bottom, paddingTop: appPadding + safeTop },
						styles.scrollContent,
						props.style,
					]}
					keyboardShouldPersistTaps="handled"
				>
					{children}
				</ScrollView>
			) : (
				<View
					style={[
						{ padding: appPadding, paddingBottom: appPadding + bottom, paddingTop: appPadding + safeTop },
						styles.view,
						props.style,
					]}
				>
					{children}
				</View>
			)}
		</TouchableWithoutFeedback>
	)
}

const styles = StyleSheet.create({
	view: { flex: 1 },
	scrollView: {
		flex: 1,
	},
	scrollContent: {
		minHeight: "100%",
	},
})
