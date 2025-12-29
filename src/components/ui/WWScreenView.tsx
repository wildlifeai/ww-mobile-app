import { PropsWithChildren } from "react"
import {
	Keyboard,
	Platform,
	ScrollViewProps,
	StyleSheet,
	TouchableWithoutFeedback,
	View,
	ViewProps,
} from "react-native"
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view"
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
				<KeyboardAwareScrollView
					style={styles.scrollView}
					contentContainerStyle={[
						{ padding: appPadding, paddingBottom: appPadding + bottom, paddingTop: appPadding + safeTop },
						styles.scrollContent,
						props.style,
					]}
					keyboardShouldPersistTaps="handled"
					enableOnAndroid={true}
					enableAutomaticScroll={true}
					extraScrollHeight={Platform.OS === 'ios' ? 20 : 0}
					showsVerticalScrollIndicator={false}
				>
					{children}
				</KeyboardAwareScrollView>
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
