import { useMemo } from "react"
import { View, ScrollView, StyleSheet } from "react-native"
import { Modal, Portal, IconButton, Divider, Button, Chip, Text } from "react-native-paper"
import { WWText } from "./ui/WWText"
import { useExtendedTheme } from "../theme"
import { CommandNames, COMMANDS } from "../ble/types"

type Props = {
    visible: boolean
    onDismiss: () => void
    onRunFlow: (command: CommandNames) => void
}

interface FlowGroup {
    title: string
    icon: string
    commands: { name: CommandNames; description: string }[]
}

/**
 * Groups process commands into logical categories for the Flows modal.
 */
const getFlowGroups = (): FlowGroup[] => {
    const processCommands = Object.values(COMMANDS).filter(
        cmd => cmd.type === 'process' || cmd.type === 'local'
    )

    const groups: FlowGroup[] = [
        {
            title: 'Camera & Capture',
            icon: 'camera',
            commands: processCommands
                .filter(cmd => [
                    CommandNames.CAPTURE_PREVIEW,
                    CommandNames.CAMERA_SETTINGS_TEST,
                ].includes(cmd.name))
                .map(cmd => ({ name: cmd.name, description: cmd.description || '' })),
        },
        {
            title: 'Motion Detection',
            icon: 'motion-sensor',
            commands: processCommands
                .filter(cmd => [
                    CommandNames.MOTION_DETECTION_PREVIEW,
                ].includes(cmd.name))
                .map(cmd => ({ name: cmd.name, description: cmd.description || '' })),
        },
        {
            title: 'Device Configuration',
            icon: 'cog-outline',
            commands: processCommands
                .filter(cmd => [
                    CommandNames.SET_UTC,
                    CommandNames.SET_GPS,
                    CommandNames.RESET_TO_DEFAULTS,
                ].includes(cmd.name))
                .map(cmd => ({ name: cmd.name, description: cmd.description || '' })),
        },
        {
            title: 'Firmware Updates',
            icon: 'cellphone-arrow-down',
            commands: processCommands
                .filter(cmd => [
                    CommandNames.UPDATE_BLE_FIRMWARE,
                    CommandNames.UPDATE_HIMAX_FIRMWARE,
                ].includes(cmd.name))
                .map(cmd => ({ name: cmd.name, description: cmd.description || '' })),
        },
        {
            title: 'File Transfer',
            icon: 'file-send',
            commands: processCommands
                .filter(cmd => [
                    CommandNames.TX_FILE,
                    CommandNames.FILE_TRANSFER_TEST,
                    CommandNames.MODEL_VALIDATION_TEST,
                ].includes(cmd.name))
                .map(cmd => ({ name: cmd.name, description: cmd.description || '' })),
        },
        {
            title: 'Console',
            icon: 'console',
            commands: processCommands
                .filter(cmd => [
                    CommandNames.CLEAR_CONSOLE,
                ].includes(cmd.name))
                .map(cmd => ({ name: cmd.name, description: cmd.description || '' })),
        },
        {
            title: 'Deployment Testing',
            icon: 'play-circle-outline',
            commands: processCommands
                .filter(cmd => [
                    CommandNames.DEV_DEPLOYMENT_TEST,
                ].includes(cmd.name))
                .map(cmd => ({ name: cmd.name, description: cmd.description || '' })),
        },
        {
            title: 'Other',
            icon: 'dots-horizontal-circle-outline',
            commands: processCommands
                .filter(cmd => [
                    CommandNames.ENABLE_CAMERA,
                    CommandNames.DISABLE_CAMERA,
                    CommandNames.md,
                    CommandNames.SET_MOTION_DETECT_INTERVAL,
                    CommandNames.DISABLE_MOTION_DETECT,
                    CommandNames.SET_TIMELAPSE_INTERVAL,
                    CommandNames.DISABLE_TIMELAPSE,
                    CommandNames.SET_NUM_PICTURES,
                    CommandNames.SET_PICTURE_INTERVAL,
                ].includes(cmd.name))
                .map(cmd => ({ name: cmd.name, description: cmd.description || '' })),
        },
    ]

    // Only return groups that have commands
    return groups.filter(g => g.commands.length > 0)
}

export const FlowsReferenceModal = ({ visible, onDismiss, onRunFlow }: Props) => {
    const { colors, spacing } = useExtendedTheme()
    const groups = useMemo(() => getFlowGroups(), [])

    const dynamicStyles = useMemo(() => ({
        modal: {
            backgroundColor: colors.background
        },
        groupHeader: {
            backgroundColor: colors.surfaceVariant,
        },
        groupHeaderText: {
            color: colors.onSurfaceVariant,
        },
        rowBorder: {
            borderBottomColor: colors.outlineVariant
        },
        descriptionText: {
            color: colors.onSurfaceVariant
        }
    }), [colors])

    return (
        <Portal>
            <Modal visible={visible} onDismiss={onDismiss} contentContainerStyle={[styles.modal, dynamicStyles.modal]}>
                <View style={styles.header}>
                    <WWText variant="titleLarge"><Text>Flows & Processes</Text></WWText>
                    <IconButton icon="close" onPress={onDismiss} />
                </View>

                <Divider />

                <ScrollView style={styles.content}>
                    <WWText style={{ marginBottom: spacing, marginTop: spacing }}>
                        <Text>Pre-built workflows and multi-step processes. Click Run to execute.</Text>
                    </WWText>

                    {groups.map((group) => (
                        <View key={group.title}>
                            <View style={[styles.groupHeaderRow, dynamicStyles.groupHeader]}>
                                <Chip icon={group.icon} compact style={styles.groupChip}>
                                    <Text>{group.title}</Text>
                                </Chip>
                            </View>

                            {group.commands.map((cmd) => (
                                <View key={cmd.name} style={[styles.row, dynamicStyles.rowBorder]}>
                                    <View style={styles.rowInfo}>
                                        <WWText style={styles.boldText}><Text>{cmd.name}</Text></WWText>
                                        {cmd.description ? (
                                            <WWText variant="bodySmall" style={dynamicStyles.descriptionText}>
                                                <Text>{cmd.description}</Text>
                                            </WWText>
                                        ) : null}
                                    </View>
                                    <View style={styles.rowAction}>
                                        <Button mode="contained" compact onPress={() => onRunFlow(cmd.name)}>
                                            <Text>Run</Text>
                                        </Button>
                                    </View>
                                </View>
                            ))}
                        </View>
                    ))}
                </ScrollView>
            </Modal>
        </Portal>
    )
}

const styles = StyleSheet.create({
    modal: {
        margin: 20,
        borderRadius: 8,
        height: '90%',
        padding: 20
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 0
    },
    content: {
        flex: 1
    },
    groupHeaderRow: {
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 6,
        marginTop: 12,
        marginBottom: 4,
    },
    groupChip: {
        alignSelf: 'flex-start'
    },
    row: {
        flexDirection: 'row',
        paddingVertical: 12,
        paddingHorizontal: 4,
        borderBottomWidth: 1,
        alignItems: 'center'
    },
    rowInfo: {
        flex: 2
    },
    boldText: {
        fontWeight: 'bold'
    },
    rowAction: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center'
    }
})
