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
}

export const WWScreenView = ({
    children,
    scrollable = true,
    ...props
}: Props) => {
    const { appPadding } = useExtendedTheme()
    const { bottom, top } = useSafeAreaInsets()

    // Robust Safe Area: With 'pan', the window is full height.
    // iOS and Android now behave similarly.
    const safeTop = top > 0 ? top : (Platform.OS === 'android' ? 30 : 0)

    const content = scrollable ? (
        <KeyboardAwareScrollView
            style={styles.scrollView}
            contentContainerStyle={[
                { padding: appPadding, paddingBottom: appPadding + bottom, paddingTop: appPadding + safeTop },
                styles.scrollContent,
                props.style,
            ]}
            keyboardShouldPersistTaps="handled" // bottomOffset removed (auto-handled or part of contentContainerStyle)
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
