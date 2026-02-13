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
import { KeyboardAwareScrollView } from "react-native-keyboard-controller"
import { useExtendedTheme } from "../../theme"
import { useSafeAreaInsets } from "react-native-safe-area-context"

type Props = PropsWithChildren<ViewProps | ScrollViewProps> & {
	scrollable?: boolean
	/**
	 * Set to true when this screen has a navigation header.
	 * This prevents double top padding since the header already handles safe area.
	 * @default true
	 */
	withHeader?: boolean
}

export const WWScreenView = ({
    children,
    scrollable = true,
    withHeader = true, // Default to true since most screens have headers
    ...props
}: Props) => {
    const { appPadding } = useExtendedTheme()
    const { bottom, top } = useSafeAreaInsets()

    // Only apply top safe area padding when there's NO navigation header
    // When withHeader=true, the navigation header already handles the safe area
    const safeTop = withHeader ? 0 : (top > 0 ? top : (Platform.OS === 'android' ? 30 : 0))

    const content = scrollable ? (
        <KeyboardAwareScrollView
            style={styles.scrollView}
            contentContainerStyle={[
                { padding: appPadding, paddingBottom: appPadding + bottom, paddingTop: appPadding + safeTop },
                styles.scrollContent,
                props.style,
            ]}
            keyboardShouldPersistTaps="handled"
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
    );

    return (
        <TouchableWithoutFeedback style={styles.view} onPress={Keyboard.dismiss}>
            {content}
        </TouchableWithoutFeedback>
    );
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
