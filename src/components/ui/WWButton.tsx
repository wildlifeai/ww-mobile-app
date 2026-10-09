import { forwardRef } from "react"
import { StyleSheet, View } from "react-native"
import { Button, ButtonProps } from "react-native-paper"
import { WWText } from "./WWText"

type CommonProps = {
	hasError?: boolean
	errorText?: string
}

export type WWButtonProps = CommonProps & ButtonProps

export const WWButton = forwardRef<View, WWButtonProps>(
	({ hasError, errorText, style, disabled, ...props }, ref) => {
		return (
			<View style={styles.container} ref={ref}>
				<Button
					{...props}
					disabled={disabled}
					style={[style, styles.button, hasError && styles.errorButton]}
				/>
				{hasError && errorText && (
					<WWText style={styles.errorText}>{errorText}</WWText>
				)}
			</View>
		)
	},
)

const styles = StyleSheet.create({
	container: {
		width: "auto",
	},
	button: {
		width: "100%",
	},
	errorButton: {
		borderColor: "red",
		borderWidth: 1,
	},
	errorText: {
		color: "red",
		fontSize: 12,
		marginTop: 4,
	},
})
