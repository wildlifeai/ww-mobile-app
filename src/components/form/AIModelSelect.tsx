/**
 * AIModelSelect Component
 * Form field for selecting AI models in project creation/editing
 *
 * Features:
 * - Organisation-scoped AI model selection via RTK Query
 * - Loading states during data fetch
 * - Error state handling
 * - Empty state handling
 * - Optional "None" selection
 * - Integration with react-hook-form Controller
 */

import { Control, FieldPath, FieldValues } from "react-hook-form"
import { ActivityIndicator } from "react-native"
import { Field } from "./Field"
import { WWSelect, Option } from "../ui/WWSelect"
import { useGetAIModelsQuery } from "../../redux/api/aiModelsApi"
import type { Database } from "../../types/supabase"

type AIModel = Database["public"]["Tables"]["ai_models"]["Row"]

interface AIModelSelectProps<
	TFieldValues extends FieldValues = FieldValues,
	TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
> {
	control: Control<TFieldValues>
	name: TName
	organisationId: string
	label?: string
	required?: boolean
}

export const AIModelSelect = <
	TFieldValues extends FieldValues = FieldValues,
	TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
>({
	control,
	name,
	organisationId,
	label = "AI Model",
	required = false,
}: AIModelSelectProps<TFieldValues, TName>) => {
	const { data: models = [], isLoading, error } = useGetAIModelsQuery(organisationId)

	// Transform models to dropdown options
	const options: Option[] = [
		// Add "None" option as first choice
		{ label: "None", value: "" },
		// Map AI models to options
		...models.map((model: AIModel) => ({
			label: `${model.name} v${model.version}`,
			value: model.id,
		})),
	]

	// Handle empty state
	if (!isLoading && !error && models.length === 0) {
		return (
			<Field
				control={control}
				name={name}
				label={label}
				required={required}
				helpText="No AI models available for this organisation"
			>
				{(field) => (
					<WWSelect
						{...field}
						label={label}
						options={[{ label: "None", value: "" }]}
						disabled={true}
					/>
				)}
			</Field>
		)
	}

	// Handle error state
	if (error) {
		const errorMessage =
			typeof error === "object" && error !== null && "error" in error
				? String(error.error)
				: "Failed to load AI models"

		return (
			<Field
				control={control}
				name={name}
				label={label}
				required={required}
				helpText={errorMessage}
			>
				{(field) => (
					<WWSelect
						{...field}
						label={label}
						options={[{ label: "None", value: "" }]}
						disabled={true}
						hasError={true}
						errorText={errorMessage}
					/>
				)}
			</Field>
		)
	}

	// Handle loading state
	if (isLoading) {
		return (
			<Field
				control={control}
				name={name}
				label={label}
				required={required}
				helpText="Loading AI models..."
			>
				{(field) => (
					<>
						<ActivityIndicator size="small" />
						<WWSelect
							{...field}
							label={label}
							options={[{ label: "Loading...", value: "" }]}
							disabled={true}
						/>
					</>
				)}
			</Field>
		)
	}

	// Success state - render dropdown with models
	return (
		<Field
			control={control}
			name={name}
			label={label}
			required={required}
		>
			{(field) => (
				<WWSelect
					{...field}
					label={label}
					options={options}
					disabled={false}
				/>
			)}
		</Field>
	)
}
