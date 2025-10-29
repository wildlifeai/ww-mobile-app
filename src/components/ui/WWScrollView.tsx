import { forwardRef } from "react"
import {
	ScrollViewProps,
	StyleProp,
	StyleSheet,
	View,
	ViewStyle,
} from "react-native"
import { ScrollView } from "react-native-gesture-handler"

// Omit hitSlop from ScrollViewProps to avoid null type issue with react-native-gesture-handler
type Props = Omit<ScrollViewProps, 'hitSlop'> & {
	containerStyle?: StyleProp<ViewStyle>
	hitSlop?: number | { top?: number; bottom?: number; left?: number; right?: number }
}

export const WWScrollView = forwardRef<ScrollView, Props>(
	({ children, containerStyle, ...props }, ref) => {
		return (
			<ScrollView ref={ref} {...props} style={[styles.view, props.style]}>
				<View onStartShouldSetResponder={() => true} style={containerStyle}>
					{children}
				</View>
			</ScrollView>
		)
	},
)

const styles = StyleSheet.create({
	view: {
		flex: 1,
	},
})
