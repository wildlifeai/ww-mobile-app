import { StyleSheet } from 'react-native'
import { Portal, Dialog, Button, Text } from 'react-native-paper'

export type ScannerRoutingState =
  | 'idle'
  | 'no_projects'
  | 'no_access_active_deployment'
  | 'network_error'
  | 'loading_timeout'

type Props = {
    visible: boolean
    state: ScannerRoutingState
    params?: any
    isProcessing: boolean
    onCreateProject: () => void
    onDismiss: () => void
}

export const ScannerRoutingDialog = ({
    visible,
    state,
    params,
    isProcessing,
    onCreateProject,
    onDismiss
}: Props) => {
    const commonDialogProps = {
        visible: visible && state !== 'idle',
        onDismiss: isProcessing ? undefined : onDismiss,
        dismissable: !isProcessing,
    }

    return (
        <Portal>
            {state === 'no_access_active_deployment' && (
                <Dialog {...commonDialogProps} dismissable={false}>
                    <Dialog.Title><Text>Access Denied</Text></Dialog.Title>
                    <Dialog.Content>
                        <Text variant="bodyLarge">
                            This Wildlife Watcher is active in <Text style={styles.boldText}>'{params?.projectName || 'an unknown project'}'</Text>. You do not have access to this project. Contact the Wildlife Watcher team for support.
                        </Text>
                    </Dialog.Content>
                    <Dialog.Actions>
                        <Button mode="contained" onPress={commonDialogProps.onDismiss} disabled={isProcessing}>
                            <Text>OK</Text>
                        </Button>
                    </Dialog.Actions>
                </Dialog>
            )}

            {state === 'no_projects' && (
                <Dialog {...commonDialogProps}>
                    <Dialog.Title><Text>No Projects Found</Text></Dialog.Title>
                    <Dialog.Content>
                        <Text variant="bodyLarge">
                            You need to have at least a project first before you can use the Wildlife Watcher.
                        </Text>
                    </Dialog.Content>
                    <Dialog.Actions>
                        <Button onPress={commonDialogProps.onDismiss} disabled={isProcessing}><Text>Cancel</Text></Button>
                        <Button mode="contained" onPress={onCreateProject} disabled={isProcessing}>
                            <Text>Create Project</Text>
                        </Button>
                    </Dialog.Actions>
                </Dialog>
            )}

            {state === 'network_error' && (
                <Dialog {...commonDialogProps}>
                    <Dialog.Title><Text>Connection Error</Text></Dialog.Title>
                    <Dialog.Content>
                        <Text variant="bodyLarge">
                            Could not reach the server to check your projects. Please check your internet connection and try again.
                        </Text>
                    </Dialog.Content>
                    <Dialog.Actions>
                        <Button mode="contained" onPress={commonDialogProps.onDismiss} disabled={isProcessing}>
                            <Text>OK</Text>
                        </Button>
                    </Dialog.Actions>
                </Dialog>
            )}

            {state === 'loading_timeout' && (
                <Dialog {...commonDialogProps}>
                    <Dialog.Title><Text>Server Slow</Text></Dialog.Title>
                    <Dialog.Content>
                        <Text variant="bodyLarge">
                            The server is taking too long to respond. Please try again in a few moments.
                        </Text>
                    </Dialog.Content>
                    <Dialog.Actions>
                        <Button mode="contained" onPress={commonDialogProps.onDismiss} disabled={isProcessing}>
                            <Text>OK</Text>
                        </Button>
                    </Dialog.Actions>
                </Dialog>
            )}
        </Portal>
    )
}

const styles = StyleSheet.create({
    boldText: {
        fontWeight: 'bold'
    }
})
