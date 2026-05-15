import { useMemo } from "react"
import { View, ScrollView, StyleSheet } from "react-native"
import { Modal, Portal, IconButton, Divider, Button, Chip, Text } from "react-native-paper"
import { WWText } from "./ui/WWText"
import { useExtendedTheme } from "../theme"
import { CommandNames, COMMANDS } from "../ble/types"

type Props = {
    visible: boolean
    onDismiss: () => void
    onRunCommand: (command: CommandNames) => void
}

interface CommandGroup {
    title: string
    icon: string
    commands: { name: CommandNames; description: string }[]
}

interface CommandSection {
    title: string
    subtitle: string
    groups: CommandGroup[]
}

/**
 * Groups commands by processor target (BLE vs AI) and logical category.
 * Only includes commands with type: 'command' (or no type).
 */
const getCommandSections = (): CommandSection[] => {
    const allCommands = Object.values(COMMANDS).filter(
        cmd => cmd.type === 'command' || !cmd.type
    )

    const pick = (names: CommandNames[]) =>
        allCommands
            .filter(cmd => names.includes(cmd.name))
            .map(cmd => ({ name: cmd.name, description: cmd.description || '' }))

    return [
        {
            title: '📡 BLE Processor (nRF52)',
            subtitle: 'Direct commands to the BLE chip — no AI prefix',
            groups: [
                {
                    title: 'System & Identity',
                    icon: 'information-outline',
                    commands: pick([
                        CommandNames.id,
                        CommandNames.ver,
                        CommandNames.device,
                        CommandNames.status,
                        CommandNames.state,
                        CommandNames.battery,
                        CommandNames.temp,
                        CommandNames.selftest,
                        CommandNames.heartbeat,
                    ]),
                },
                {
                    title: 'Clock & Location',
                    icon: 'clock-outline',
                    commands: pick([
                        CommandNames.setutc,
                        CommandNames.getutc,
                        CommandNames.getgps,
                    ]),
                },
                {
                    title: 'Device Control',
                    icon: 'power',
                    commands: pick([
                        CommandNames.dis,
                        CommandNames.reset,
                        CommandNames.erase,
                        CommandNames.dfu,
                        CommandNames.wake,
                    ]),
                },
                {
                    title: 'LoRaWAN',
                    icon: 'antenna',
                    commands: pick([
                        CommandNames.deveui,
                        CommandNames.appeui,
                        CommandNames.appkey,
                        CommandNames.join,
                        CommandNames.ping,
                        CommandNames.network,
                    ]),
                },
                {
                    title: 'LED Diagnostics',
                    icon: 'led-on',
                    commands: pick([
                        CommandNames.flashr,
                        CommandNames.flashg,
                        CommandNames.flashb,
                    ]),
                },
            ],
        },
        {
            title: '🧠 AI Processor (Himax HX6538)',
            subtitle: 'Commands prefixed with "AI" — routed via BLE to the Himax chip',
            groups: [
                {
                    title: 'AI System',
                    icon: 'chip',
                    commands: pick([
                        CommandNames.ai_ver,
                        CommandNames.aiinfo,
                        CommandNames.camera_type,
                        CommandNames.inithm0360,
                        CommandNames.ai_firmware,
                    ]),
                },
                {
                    title: 'Operational Parameters',
                    icon: 'tune-vertical',
                    commands: pick([
                        CommandNames.getop_all,
                        CommandNames.getop,
                        CommandNames.setop,
                        CommandNames.setdid,
                        CommandNames.getdid,
                        CommandNames.setgps,
                    ]),
                },
                {
                    title: 'Capture & Motion Detection',
                    icon: 'camera',
                    commands: pick([
                        CommandNames.md,
                    ]),
                },
                {
                    title: 'Model Management',
                    icon: 'brain',
                    commands: pick([
                        CommandNames.erasemodel,
                        CommandNames.loadmodel,
                    ]),
                },
                {
                    title: 'OP Shortcuts',
                    icon: 'lightning-bolt',
                    commands: pick([
                        CommandNames.SET_NUM_PICTURES,
                        CommandNames.SET_PICTURE_INTERVAL,
                        CommandNames.SET_TIMELAPSE_INTERVAL,
                        CommandNames.SET_MOTION_DETECT_INTERVAL,
                        CommandNames.DISABLE_MOTION_DETECT,
                        CommandNames.DISABLE_TIMELAPSE,
                    ]),
                },
            ],
        },
    ]
}

export const CommandReferenceModal = ({ visible, onDismiss, onRunCommand }: Props) => {
    const { colors, spacing } = useExtendedTheme()
    const sections = useMemo(() => getCommandSections(), [])

    const dynamicStyles = useMemo(() => ({
        modal: {
            backgroundColor: colors.background
        },
        instructionText: {
            marginBottom: spacing,
            marginTop: spacing
        },
        sectionHeader: {
            backgroundColor: colors.elevation?.level2 || colors.surface,
        },
        sectionSubtitle: {
            color: colors.onSurfaceVariant,
        },
        groupHeader: {
            backgroundColor: colors.surfaceVariant,
        },
        rowBorder: {
            borderBottomColor: colors.outlineVariant
        },
        descriptionText: {
            color: colors.onSurfaceVariant
        }
    }), [colors, spacing])

    return (
        <Portal>
            <Modal visible={visible} onDismiss={onDismiss} contentContainerStyle={[styles.modal, dynamicStyles.modal]}>
                <View style={styles.header}>
                    <WWText variant="titleLarge"><Text>Commands</Text></WWText>
                    <IconButton icon="close" onPress={onDismiss} />
                </View>

                <Divider />

                <ScrollView style={styles.content}>
                    <WWText style={dynamicStyles.instructionText}>
                        <Text>Firmware commands by target processor. Click Run to send.</Text>
                    </WWText>

                    {sections.map((section) => (
                        <View key={section.title}>
                            <View style={[styles.sectionHeaderRow, dynamicStyles.sectionHeader]}>
                                <WWText variant="titleMedium" style={styles.sectionTitle}>
                                    <Text>{section.title}</Text>
                                </WWText>
                                <WWText variant="bodySmall" style={dynamicStyles.sectionSubtitle}>
                                    <Text>{section.subtitle}</Text>
                                </WWText>
                            </View>

                            {section.groups
                                .filter(g => g.commands.length > 0)
                                .map((group) => (
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
                                                <Button mode="contained" compact onPress={() => onRunCommand(cmd.name)}>
                                                    <Text>Run</Text>
                                                </Button>
                                            </View>
                                        </View>
                                    ))}
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
    sectionHeaderRow: {
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderRadius: 8,
        marginTop: 16,
        marginBottom: 4,
    },
    sectionTitle: {
        fontWeight: 'bold',
    },
    groupHeaderRow: {
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 6,
        marginTop: 8,
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
