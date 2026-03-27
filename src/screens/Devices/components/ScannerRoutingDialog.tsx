import { useState } from 'react'
import { StyleSheet, TouchableOpacity, ScrollView } from 'react-native'
import { Portal, Dialog, Button, Text } from 'react-native-paper'
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons'
import { useExtendedTheme } from '../../../theme'
import { ProjectWithDetails } from '../../../types/project'

export type ScannerRoutingState = 'idle' | 'active_deployment' | 'start_deployment' | 'no_projects' | 'unassociated'

type Props = {
    visible: boolean
    state: ScannerRoutingState
    deviceName: string | null
    projects: ProjectWithDetails[]
    isProcessing: boolean
    onStartDeployment: () => void
    onStopDeployment: () => void
    onCreateProject: () => void
    onAssociateDevice: (projectId: string) => void
    onDismiss: () => void
}

export const ScannerRoutingDialog = ({
    visible,
    state,
    deviceName,
    projects,
    isProcessing,
    onStartDeployment,
    onStopDeployment,
    onCreateProject,
    onAssociateDevice,
    onDismiss
}: Props) => {
    const theme = useExtendedTheme()
    const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null)

    const commonDialogProps = {
        visible: visible && state !== 'idle',
        onDismiss: isProcessing ? undefined : () => {
            setSelectedProjectId(null)
            onDismiss()
        },
        dismissable: !isProcessing,
    }

    const renderDialog = () => {
        switch (state) {
            case 'start_deployment':
                return (
                    <Dialog {...commonDialogProps}>
                        <Dialog.Title>Device Ready</Dialog.Title>
                        <Dialog.Content>
                            <Text variant="bodyLarge">
                                {deviceName || 'This device'} is associated with a project and ready for deployment.
                            </Text>
                        </Dialog.Content>
                        <Dialog.Actions>
                            <Button onPress={commonDialogProps.onDismiss} disabled={isProcessing}>Cancel</Button>
                            <Button mode="contained" onPress={onStartDeployment} loading={isProcessing} disabled={isProcessing}>
                                Start Deployment
                            </Button>
                        </Dialog.Actions>
                    </Dialog>
                )

            case 'active_deployment':
                return (
                    <Dialog {...commonDialogProps}>
                        <Dialog.Title>Active Deployment</Dialog.Title>
                        <Dialog.Content>
                            <Text variant="bodyLarge">
                                {deviceName || 'This device'} is currently in an active deployment.
                                Do you want to end this deployment now?
                            </Text>
                        </Dialog.Content>
                        <Dialog.Actions>
                            <Button onPress={commonDialogProps.onDismiss} disabled={isProcessing}>Cancel</Button>
                            <Button mode="contained" onPress={onStopDeployment} loading={isProcessing} disabled={isProcessing}>
                                Stop Deployment
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
                                You don't have any projects. You need to create a project first before you can associate a device with it for deployment.
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

            case 'unassociated':
                return (
                    <Dialog {...commonDialogProps}>
                        <Dialog.Title>Associate Device</Dialog.Title>
                        <Dialog.Content style={styles.scrollContentMaxHeight}>
                            <Text variant="bodyLarge" style={styles.marginBottom}>
                                {deviceName || 'This device'} is new. Please select a project to associate it with:
                            </Text>
                            <ScrollView style={styles.projectList}>
                                {projects.map((project) => (
                                    <TouchableOpacity
                                        key={project.id}
                                        style={[
                                            styles.projectRow,
                                            selectedProjectId === project.id && { backgroundColor: theme.colors.primaryContainer }
                                        ]}
                                        onPress={() => setSelectedProjectId(project.id)}
                                        disabled={isProcessing}
                                    >
                                        <MaterialCommunityIcons
                                            name={selectedProjectId === project.id ? "radiobox-marked" : "radiobox-blank"}
                                            size={24}
                                            color={selectedProjectId === project.id ? theme.colors.primary : theme.colors.onSurfaceVariant}
                                        />
                                        <Text variant="bodyLarge" style={[
                                            styles.projectName,
                                            selectedProjectId === project.id && { color: theme.colors.onPrimaryContainer }
                                        ]}>
                                            {project.name}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </ScrollView>
                        </Dialog.Content>
                        <Dialog.Actions>
                            <Button onPress={commonDialogProps.onDismiss} disabled={isProcessing}>Cancel</Button>
                            <Button 
                                mode="contained" 
                                onPress={() => selectedProjectId && onAssociateDevice(selectedProjectId)}
                                disabled={!selectedProjectId || isProcessing}
                                loading={isProcessing}
                            >
                                Associate & Continue
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

const styles = StyleSheet.create({
    marginBottom: {
        marginBottom: 16,
    },
    scrollContentMaxHeight: {
        maxHeight: 400,
    },
    projectList: {
        marginTop: 8,
    },
    projectRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 8,
        borderRadius: 8,
        marginBottom: 4,
    },
    projectName: {
        marginLeft: 12,
        flex: 1,
    }
})
