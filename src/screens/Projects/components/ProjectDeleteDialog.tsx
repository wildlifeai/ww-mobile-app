import React from 'react'
import { Portal, Dialog, Button, Text, useTheme } from 'react-native-paper'

interface ProjectDeleteDialogProps {
	visible: boolean
	projectName: string
	isDeleting: boolean
	onDismiss: () => void
	onDelete: () => void
}

export const ProjectDeleteDialog: React.FC<ProjectDeleteDialogProps> = ({
	visible,
	projectName,
	isDeleting,
	onDismiss,
	onDelete,
}) => {
	const theme = useTheme()

	return (
		<Portal>
			<Dialog visible={visible} onDismiss={onDismiss}>
				<Dialog.Title>Delete Project</Dialog.Title>
				<Dialog.Content>
					<Text variant="bodyMedium">
						Are you sure you want to delete "{projectName}"? This action cannot be
						undone.
					</Text>
				</Dialog.Content>
				<Dialog.Actions>
					<Button onPress={onDismiss} disabled={isDeleting}>
						Cancel
					</Button>
					<Button
						onPress={onDelete}
						loading={isDeleting}
						disabled={isDeleting}
						textColor={theme.colors.error}
						testID="confirm-delete-button"
					>
						Delete
					</Button>
				</Dialog.Actions>
			</Dialog>
		</Portal>
	)
}
