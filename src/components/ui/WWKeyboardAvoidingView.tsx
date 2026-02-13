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
 * Sub-component to safely use the useHeaderHeight hook.
 * This component is only rendered when useHeader is true and we are on iOS,
 * preventing Rules of Hooks violations (conditional hook execution).
 */
const IOSKeyboardAvoidingViewWithHeader = ({ 
    children, 
    style, 
    offset = 0 
}: PropsWithChildren<Omit<Props, 'useHeader'>>) => {
    // We assume that if this component is rendered, we are inside a NavigationContainer
    // If not, useHeaderHeight might throw, which should be caught by an error boundary or avoided by passing useHeader={false}
    const headerHeight = useHeaderHeight()
    
    return (
        <KeyboardAvoidingView
			style={[styles.view, style]}
			behavior="padding"
			keyboardVerticalOffset={headerHeight + offset}
		>
			{children}
		</KeyboardAvoidingView>
    )
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

    if (Platform.OS === 'ios') {
        if (useHeader) {
            return (
                <IOSKeyboardAvoidingViewWithHeader style={style} offset={offset}>
                    {children}
                </IOSKeyboardAvoidingViewWithHeader>
            )
        }
        
        return (
            <KeyboardAvoidingView
                style={[styles.view, style]}
                behavior="padding"
                keyboardVerticalOffset={offset}
            >
                {children}
            </KeyboardAvoidingView>
        )
    }

    // Android & other platforms
	return (
		<KeyboardAvoidingView
			style={[styles.view, style]}
			behavior={undefined}
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
