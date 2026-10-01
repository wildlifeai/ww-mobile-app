import { forwardRef, useCallback } from "react"
import { StyleProp, StyleSheet, View, ViewStyle } from "react-native"
import { Checkbox, CheckboxProps } from "react-native-paper"
import { useExtendedTheme } from "../../theme"

type Props = {
	style?: StyleProp<ViewStyle>
	hasError?: boolean
	errorText?: string
	value?: boolean
	onChange?: (value: boolean) => void
	label?: string
} & Omit<CheckboxProps, "status" | "onPress">

export const WWCheckbox = forwardRef<View, Props>((props, ref) => {
	const {
		style,
		hasError,
		value = false,
		onChange,
		disabled,
		label,
		...rest
	} = props

	const { colors } = useExtendedTheme()
	const handleChange = useCallback(() => {
		onChange?.(!value)
	}, [onChange, value])

	return (
		<View style={styles.wrapper} ref={ref}>
			<Checkbox.Item
				{...rest}
				label={label || ""}
				status={value ? "checked" : "unchecked"}
				onPress={handleChange}
				disabled={disabled}
				color={hasError ? "red" : colors.primary}
				uncheckedColor="#fff"
				style={[styles.container, style]}
				labelStyle={styles.label}
				position="leading"
				mode="android"
			/>
		</View>
	)
})

const styles = StyleSheet.create({
	wrapper: {
		width: "100%",
		alignItems: "flex-start",
	},
	container: {
		borderRadius: 4,
	},
	// Paper right-aligns a leading checkbox's label, which only shows once the
	// label wraps: the second line would hug the right edge (#190)
	label: {
		textAlign: "left",
	},
})
