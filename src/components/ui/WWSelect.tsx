import { forwardRef, useCallback } from "react"
import { StyleSheet, View, StyleProp, ViewStyle } from "react-native"
import { Dropdown, DropdownProps } from "react-native-paper-dropdown"
import { WWText } from "./WWText"

export type Option = {
	label: string
	value: string
}

type CommonProps = {
	hasError?: boolean
	onChange?: (value: string) => void
	onSelectEffect?: (value: string) => void
	errorText?: string
	label: string
	options: Option[]
	style?: StyleProp<ViewStyle>
	theme?: any
}

export type WWSelectProps = CommonProps &
	Omit<DropdownProps, "onSelect" | "options">

export const WWSelect = forwardRef<View, WWSelectProps>(
	(
		{
			hasError,
			onChange,
			onSelectEffect,
			value,
			disabled,
			errorText,
			label,
			options,
			...props
		},
		ref,
	) => {
		const onSelect = useCallback(
			(selectedValue?: string) => {
				if (selectedValue) {
					onChange?.(selectedValue)
					onSelectEffect?.(selectedValue)
				}
			},
			[onChange, onSelectEffect],
		)

		return (
			<View style={styles.container} ref={ref}>
				<Dropdown
					{...props}
					label={label}
					mode="outlined"
					placeholder={label}
					options={options}
					value={value}
					onSelect={onSelect}
					disabled={disabled}
					error={hasError}
					hideMenuHeader={true}
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
		width: "100%",
		margin: 0,
	},
	input: {
		width: "100%",
		marginVertical: 0,
	},
	errorText: {
		color: "red",
		fontSize: 12,
		marginTop: 4,
	},
})
