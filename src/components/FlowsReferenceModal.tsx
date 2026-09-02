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
 * Resolve the named flows, in the order given, dropping any that no longer
 * exist or are not a flow.
 *
 * Listing them rather than filtering `COMMANDS` is deliberate. The previous
 * version filtered, so the rendered order came from the declaration order in
 * types.ts and the arrays here were decorative: Motion Detection appeared above
 * Capture Picture because of where it happened to sit in that file, and
 * reordering this list changed nothing on screen.
 */
const pick = (names: CommandNames[]): FlowGroup['commands'] =>
    names
        .map(name => COMMANDS[name])
        .filter(cmd => cmd && (cmd.type === 'process' || cmd.type === 'local'))
        .map(cmd => ({ name: cmd.name, description: cmd.description || '' }))

/**
 * Groups process commands into logical categories for the Flows modal.
 *
 * Ordered by how often an operator reaches for them: the camera flows are the
 * everyday ones, firmware next, then the two that change or restart the device.
 */
const getFlowGroups = (): FlowGroup[] => {
    const groups: FlowGroup[] = [
        // The three flows that point the camera at something and report what it
        // saw. They were a group each, which made three one-item lists and hid
        // how much they have in common: all three drive the camera, all three
        // are safe to run on a bench device, and an operator reaching for one
        // is usually deciding between them.
        {
            title: 'Camera & Sensors',
            icon: 'camera',
            commands: pick([
                    CommandNames.CAPTURE_PICTURE,
                    CommandNames.MOTION_DETECTION_PREVIEW,
                    CommandNames.LIGHT_SENSOR,
            ]),
        },
        // MODEL_VALIDATION sits here rather than under File Transfer: the
        // transfer is how it works, not what it is for. It ends by erasing the
        // model and loading the new one, which puts it with the other flows
        // that change what the device is running.
        {
            title: 'Firmware Updates',
            icon: 'cellphone-arrow-down',
            commands: pick([
                    CommandNames.UPDATE_BLE_FIRMWARE,
                    CommandNames.UPDATE_HIMAX_FIRMWARE,
                    CommandNames.FIRMWARE_STATUS,
                    CommandNames.MODEL_VALIDATION,
            ]),
        },
        {
            title: 'Device Configuration',
            icon: 'cog-outline',
            commands: pick([
                    CommandNames.RESET_TO_DEFAULTS,
            ]),
        },
        // The Console group held only CLEAR_CONSOLE, which sent nothing to the
        // device. Clearing the output is now a button on the console header,
        // beside Commands and Flows, where a console action belongs. The File
        // Transfer group emptied when its two entries moved to where they
        // belong by purpose rather than by mechanism.
        {
            title: 'Tests',
            icon: 'play-circle-outline',
            commands: pick([
                    CommandNames.DEV_DEPLOYMENT_TEST,
                    CommandNames.FILE_TRANSFER_TEST,
            ]),
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
