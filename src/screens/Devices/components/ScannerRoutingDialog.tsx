import { useState } from 'react'
import { StyleSheet, TouchableOpacity, ScrollView } from 'react-native'
import { Portal, Dialog, Button, Text } from 'react-native-paper'
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons'
import { useExtendedTheme } from '../../../theme'
import { ProjectWithDetails } from '../../../types/project'

export type ScannerRoutingState = 'idle' | 'no_projects' | 'no_access_active_deployment'

type Props = {
    visible: boolean
    state: ScannerRoutingState
    isProcessing: boolean
    onCreateProject: () => void
    onDismiss: () => void
}

export const ScannerRoutingDialog = ({
    visible,
    state,
    isProcessing,
    onCreateProject,
    onDismiss
}: Props) => {
    const commonDialogProps = {
        visible: visible && state !== 'idle',
        onDismiss: isProcessing ? undefined : onDismiss,
        dismissable: !isProcessing,
    }

    const renderDialog = () => {
        switch (state) {
            case 'no_access_active_deployment':
                return (
                    <Dialog {...commonDialogProps} dismissable={false}>
                        <Dialog.Title>Access Denied</Dialog.Title>
                        <Dialog.Content>
                            <Text variant="bodyLarge">
                                This Wildlife Watcher is active in a project you don't have access to. Contact the project admin to be added.
                            </Text>
                        </Dialog.Content>
                        <Dialog.Actions>
                            <Button mode="contained" onPress={commonDialogProps.onDismiss} disabled={isProcessing}>
                                OK
                            </Button>
                        </Dialog.Actions>
                    </Dialog>
                )

            case 'no_projects':
                return (
                    <Dialog {...commonDialogProps}>
                        <Dialog.Title>No Projects Found</Dialog.Title>
                        <Dialog.Content>
                            <Text variant="bodyLarge">
                                You need to create a project first before you can associate a device with it for deployment.
                            </Text>
                        </Dialog.Content>
                        <Dialog.Actions>
                            <Button onPress={commonDialogProps.onDismiss} disabled={isProcessing}>Cancel</Button>
                            <Button mode="contained" onPress={onCreateProject} disabled={isProcessing}>
                                Create Project
                            </Button>
                        </Dialog.Actions>
                    </Dialog>
                )

            default:
                return null
        }
    }

    return (
        <Portal>
            {renderDialog()}
        </Portal>
    )
}

const styles = StyleSheet.create({})
