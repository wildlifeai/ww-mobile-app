import { PropsWithChildren, ReactNode } from "react"
import { StyleSheet, View, ViewStyle } from "react-native"
import { Text } from "react-native-paper"
import {
	Control,
	ControllerRenderProps,
	FieldPath,
	FieldValues,
	useController,
	UseControllerProps,
} from "react-hook-form"
import { WWText } from "../ui/WWText"

type Props<
	TFieldValues extends FieldValues = FieldValues,
	TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
> = {
	control: Control<TFieldValues>
	style?: ViewStyle
	label?: ReactNode
	subText?: ReactNode
	helpText?: ReactNode
	required?: boolean
	children: (
		props: ControllerRenderProps<TFieldValues, TName> & {
			hasError?: boolean
		},
	) => ReactNode
} & UseControllerProps<TFieldValues, TName>

export const Field = <
	TFieldValues extends FieldValues = FieldValues,
	TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
>({
	children,
	style,
	name,
	rules,
	label,
	helpText,
	subText,
	control,
	required = false,
}: Props<TFieldValues, TName>) => {
	const {
		field,
		fieldState: { error },
	} = useController({
		name,
		rules,
		control,
	})

	const hasError = error?.message ? true : undefined

	return (
		<View style={[style, styles.fieldWrapper]}>
			{label && (
				<View style={styles.labelContainer}>
					<WWText style={styles.label}>
						<Text>{label}</Text>
						{required && <WWText style={styles.required}><Text> *</Text></WWText>}
					</WWText>
					{subText && <WWText style={styles.subText}><Text>{subText}</Text></WWText>}
				</View>
			)}
			{children({
				...field,
				hasError,
			})}
			{helpText && !hasError && (
				<WWText style={styles.helpText}><Text>{helpText}</Text></WWText>
			)}
			{hasError && <WWText style={styles.errorText}><Text>{error?.message}</Text></WWText>}
		</View>
	)
}

type UncontrolledFieldProps = {
	style?: ViewStyle
	label?: ReactNode
	subText?: ReactNode
	helpText?: ReactNode
	errorText?: string
}

export const UncontrolledField = ({
	children,
	style,
	label,
	subText,
	helpText,
	errorText,
}: PropsWithChildren<UncontrolledFieldProps>) => {
	return (
		<View style={[style, styles.fieldWrapper]}>
			{label && (
				<View style={styles.labelContainer}>
					<WWText style={styles.label}><Text>{label}</Text></WWText>
					{subText && <WWText style={styles.subText}><Text>{subText}</Text></WWText>}
				</View>
			)}
			{children}
			{helpText && !errorText && (
				<WWText style={styles.helpText}><Text>{helpText}</Text></WWText>
			)}
			{errorText && <WWText style={styles.errorText}><Text>{errorText}</Text></WWText>}
		</View>
	)
}

const styles = StyleSheet.create({
	fieldWrapper: {
		marginBottom: 16,
	},
	labelContainer: {
		marginBottom: 8,
	},
	label: {
		fontSize: 16,
		fontWeight: "500",
	},
	required: {
		color: "red",
	},
	subText: {
		fontSize: 12,
		color: "#666",
		marginTop: 2,
	},
	helpText: {
		fontSize: 12,
		color: "#666",
		marginTop: 4,
	},
	errorText: {
		fontSize: 12,
		color: "red",
		marginTop: 4,
	},
})
