import { PropsWithChildren } from "react"
import {
	KeyboardAvoidingView,
	Platform,
	StyleSheet,
	ViewStyle,
    StyleProp
} from "react-native"
import { useHeaderHeight } from "@react-navigation/elements"

type Props = {
	style?: StyleProp<ViewStyle>
	/**
	 * Additional vertical offset.
	 * Default: headerHeight (if available) + bottom inset
	 */
	offset?: number
    /**
     * Whether to verify header height automatically.
     * Default: true
     */
    useHeader?: boolean
}

/**
 * Standardized KeyboardAvoidingView for the application.
 * 
 * - iOS: Uses 'padding' behavior with automatic offset calculation (header + safe area).
 * - Android: Uses 'height' behavior (or undefined if windowSoftInputMode is 'resize').
 *   We generally prefer 'resize' in app.config.ts for Android.
 */
export const WWKeyboardAvoidingView = ({
    children,
    style,
    offset = 0,
    useHeader = true,
}: PropsWithChildren<Props>) => {
    let headerHeight = 0
    
    try {
        // eslint-disable-next-line react-hooks/rules-of-hooks
        headerHeight = useHeader ? useHeaderHeight() : 0
    } catch (e) {
        // useHeaderHeight might fail if not inside a navigation container
    }

	const behavior = Platform.OS === "ios" ? "padding" : undefined
    
    // On iOS, we need to offset by the header height if it's translucent or absolute
    // But usually with 'padding', we just need to account for the bottom inset if standard
    // However, specifically for chat-like interfaces (Engineer Console), 
    // 'padding' pushes the content up. 
    
    // For iOS 'padding':
    // verticalOffset = height of elements covering the screen top (header)
    const verticalOffset = Platform.OS === "ios" ? (headerHeight + offset) : 0

	return (
		<KeyboardAvoidingView
			style={[styles.view, style]}
			behavior={behavior}
			keyboardVerticalOffset={verticalOffset}
		>
			{children}
		</KeyboardAvoidingView>
	)
}

const styles = StyleSheet.create({
	view: {
		flex: 1,
	},
})
