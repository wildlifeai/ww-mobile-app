import { useMemo, useState } from "react"
import { View, ScrollView, StyleSheet } from "react-native"
import { Modal, Portal, IconButton, Divider, Button, Text, TouchableRipple, Icon, TextInput, HelperText } from "react-native-paper"
import { WWText } from "./ui/WWText"
import { HelpDialog } from "./ui/HelpDialog"
import { useExtendedTheme } from "../theme"
import { CommandNames, COMMANDS, CommandParam } from "../ble/types"
import { checkCommandArg, opName } from "./commandArgs"

type Props = {
    visible: boolean
    onDismiss: () => void
    /** `args` are the checked values, in order, for a command that has `params`. */
    onRunCommand: (command: CommandNames, args?: string[]) => void
}

interface CommandGroup {
    title: string
    icon: string
    commands: { name: CommandNames; description: string; params?: CommandParam[] }[]
}

interface CommandSection {
    title: string
    icon: string
    groups: CommandGroup[]
}

/** Behind the ? next to the title. */
export const COMMANDS_HELP =
    'Firmware commands by target processor. Tap Run to send; a command that takes values asks for them first.'

/**
 * Groups commands by processor target (BLE vs AI) and logical category.
 * Only includes commands with type: 'command' (or no type).
 *
 * Exported for the coverage test: the sections below are a hand-maintained
 * allowlist, so a command can be fully defined in COMMANDS and still never
 * appear here. `slots` and `switchslot` were invisible that way until Aug 2026.
 */
export const getCommandSections = (): CommandSection[] => {
    const allCommands = Object.values(COMMANDS).filter(
        cmd => cmd.type === 'command' || !cmd.type
    )

    // In the order each category names them, not the command table's order.
    const pick = (names: CommandNames[]) =>
        names.flatMap(name => {
            const cmd = allCommands.find(c => c.name === name)
            return cmd ? [{ name: cmd.name, description: cmd.description || '', params: cmd.params }] : []
        })

    return [
        {
            title: 'BLE Processor',
            icon: 'bluetooth',
            groups: [
                {
                    title: 'System & Identity',
                    icon: 'information-outline',
                    commands: pick([
                        CommandNames.id,
                        CommandNames.ver,
                        CommandNames.device,
                        CommandNames.status,
                        CommandNames.battery,
                        CommandNames.temp,
                        CommandNames.selftest,
                        CommandNames.heartbeat,
                    ]),
                },
                {
                    title: 'Clock',
                    icon: 'clock-outline',
                    commands: pick([
                        CommandNames.setutc,
                        CommandNames.getutc,
                    ]),
                },
                {
                    title: 'Device Control',
                    icon: 'power',
                    commands: pick([
                        CommandNames.dis,
                        CommandNames.reset,
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
            title: 'AI Processor',
            icon: 'brain',
            groups: [
                {
                    title: 'AI System',
                    icon: 'chip',
                    commands: pick([
                        CommandNames.ai_ver,
                        CommandNames.ai_info,
                        CommandNames.inithm0360,
                    ]),
                },
                {
                    title: 'SD Card & Files',
                    icon: 'folder-outline',
                    commands: pick([
                        CommandNames.dir,
                        CommandNames.format,
                    ]),
                },
                {
                    title: 'Operational Parameters',
                    icon: 'tune-vertical',
                    commands: pick([
                        CommandNames.getop_all,
                        CommandNames.getop,
                        CommandNames.setop,
                        CommandNames.setgps,
                        CommandNames.ai_getgps,
                    ]),
                },
                {
                    title: 'Camera Functions',
                    icon: 'camera',
                    commands: pick([
                        CommandNames.capture_one,
                        CommandNames.light,
                        CommandNames.slots,
                        CommandNames.switchslot,
                    ]),
                },
            ],
        },
    ]
}

/**
 * The values a command needs, asked for under its row. Send stays disabled
 * until every one checks out, so nothing reaches the device with a value the
 * operator did not choose.
 */
const CommandArgsForm = ({ params, onSend }: {
    params: CommandParam[]
    onSend: (args: string[]) => void
}) => {
    const [texts, setTexts] = useState<string[]>(() => params.map(() => ''))
    const checks = params.map((param, i) => checkCommandArg(param, texts[i] ?? ''))
    const values = checks.map(check => ('value' in check ? check.value : null))
    const setText = (i: number, text: string) =>
        setTexts(prev => prev.map((t, j) => (j === i ? text : t)))

    return (
        <View style={styles.argsForm}>
            {params.map((param, i) => {
                const check = checks[i]
                // An op index shows what it resolved to, so a typed name can be checked.
                const resolved = param.kind === 'op' && 'value' in check
                    ? `op${check.value} ${opName(parseInt(check.value, 10)) ?? ''}`.trim()
                    : ''
                const typedWrong = !!texts[i].trim() && 'error' in check
                return (
                    <View key={param.label} style={styles.argField}>
                        <TextInput
                            mode="outlined"
                            dense
                            label={param.label}
                            placeholder={param.hint}
                            value={texts[i]}
                            onChangeText={(text) => setText(i, text)}
                            keyboardType={param.kind === 'int' ? 'number-pad' : 'default'}
                            autoCapitalize={param.kind === 'op' ? 'characters' : 'none'}
                            autoCorrect={false}
                            error={typedWrong}
                        />
                        <HelperText type={typedWrong ? 'error' : 'info'} visible={typedWrong || !!resolved}>
                            {'error' in check ? check.error : resolved}
                        </HelperText>
                    </View>
                )
            })}
            <Button
                mode="contained"
                compact
                disabled={values.some(value => value === null)}
                onPress={() => onSend(values as string[])}
            >
                <Text>Send</Text>
            </Button>
        </View>
    )
}

export const CommandReferenceModal = ({ visible, onDismiss, onRunCommand }: Props) => {
    const { colors } = useExtendedTheme()
    const sections = useMemo(() => getCommandSections(), [])

    // One category open at a time, all closed when the list opens.
    const [openGroup, setOpenGroup] = useState<string | null>(null)
    const [helpVisible, setHelpVisible] = useState(false)

    // The one command whose values are being asked for, if any.
    const [argsFor, setArgsFor] = useState<CommandNames | null>(null)

    const handleRun = (name: CommandNames, params?: CommandParam[]) => {
        if (!params?.length) {
            onRunCommand(name)
            return
        }
        setArgsFor(prev => (prev === name ? null : name))
    }

    const toggleGroup = (key: string) => {
        setOpenGroup(prev => (prev === key ? null : key))
        setArgsFor(null)
    }

    const dynamicStyles = useMemo(() => ({
        modal: {
            backgroundColor: colors.background
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
    }), [colors])

    return (
        <Portal>
            <Modal visible={visible} onDismiss={onDismiss} contentContainerStyle={[styles.modal, dynamicStyles.modal]}>
                <View style={styles.header}>
                    <View style={styles.headerTitle}>
                        <WWText variant="titleLarge"><Text>Commands</Text></WWText>
                        <IconButton
                            icon="help-circle-outline"
                            size={22}
                            iconColor={colors.primary}
                            onPress={() => setHelpVisible(true)}
                            accessibilityLabel="About the commands"
                            testID="commands-help"
                        />
                    </View>
                    <IconButton icon="close" onPress={onDismiss} />
                </View>

                <Divider />

                <ScrollView style={styles.content}>
                    {sections.map((section) => (
                        <View key={section.title}>
                            <View style={styles.sectionHeading}>
                                <Icon source={section.icon} size={24} color={colors.primary} />
                                <WWText variant="titleMedium" style={styles.sectionTitle}>
                                    <Text>{section.title}</Text>
                                </WWText>
                            </View>

                            {section.groups
                                .filter(g => g.commands.length > 0)
                                .map((group) => {
                                    const key = `${section.title}/${group.title}`
                                    const open = openGroup === key
                                    return (
                                        <View key={key}>
                                            <TouchableRipple
                                                onPress={() => toggleGroup(key)}
                                                style={[styles.groupHeader, dynamicStyles.groupHeader]}
                                                accessibilityRole="button"
                                                accessibilityState={{ expanded: open }}
                                                testID={`group-${group.title}`}
                                            >
                                                <View style={styles.groupHeaderContent}>
                                                    <Icon source={group.icon} size={20} color={colors.onSurfaceVariant} />
                                                    <WWText variant="titleSmall" style={styles.groupTitle}>
                                                        <Text>{group.title}</Text>
                                                    </WWText>
                                                    <Icon source={open ? 'chevron-up' : 'chevron-down'} size={22} color={colors.onSurfaceVariant} />
                                                </View>
                                            </TouchableRipple>

                                            {open ? group.commands.map((cmd) => (
                                                <View key={cmd.name} style={[styles.rowBorder, dynamicStyles.rowBorder]}>
                                                    <View style={styles.row}>
                                                        <View style={styles.rowInfo}>
                                                            <WWText style={styles.boldText}><Text>{cmd.name}</Text></WWText>
                                                            {cmd.description ? (
                                                                <WWText variant="bodySmall" style={dynamicStyles.descriptionText}>
                                                                    <Text>{cmd.description}</Text>
                                                                </WWText>
                                                            ) : null}
                                                        </View>
                                                        <View style={styles.rowAction}>
                                                            <Button
                                                                mode={argsFor === cmd.name ? 'outlined' : 'contained'}
                                                                compact
                                                                onPress={() => handleRun(cmd.name, cmd.params)}
                                                                testID={`run-${cmd.name}`}
                                                            >
                                                                <Text>{argsFor === cmd.name ? 'Cancel' : 'Run'}</Text>
                                                            </Button>
                                                        </View>
                                                    </View>
                                                    {argsFor === cmd.name && cmd.params ? (
                                                        <CommandArgsForm
                                                            params={cmd.params}
                                                            onSend={(args) => {
                                                                setArgsFor(null)
                                                                onRunCommand(cmd.name, args)
                                                            }}
                                                        />
                                                    ) : null}
                                                </View>
                                            )) : null}
                                        </View>
                                    )
                                })}
                        </View>
                    ))}
                </ScrollView>

                <HelpDialog
                    visible={helpVisible}
                    title="Commands"
                    content={COMMANDS_HELP}
                    onDismiss={() => setHelpVisible(false)}
                />
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
    headerTitle: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    content: {
        flex: 1
    },
    sectionHeading: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        marginTop: 16,
        marginBottom: 4,
        paddingHorizontal: 4,
    },
    sectionTitle: {
        fontWeight: 'bold',
    },
    groupHeader: {
        borderRadius: 6,
        marginTop: 6,
        overflow: 'hidden',
    },
    groupHeaderContent: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        paddingHorizontal: 12,
        paddingVertical: 10,
    },
    groupTitle: {
        flex: 1,
    },
    row: {
        flexDirection: 'row',
        paddingVertical: 12,
        paddingHorizontal: 4,
        alignItems: 'center'
    },
    rowBorder: {
        borderBottomWidth: 1,
    },
    argsForm: {
        paddingHorizontal: 4,
        paddingBottom: 12,
        gap: 4,
    },
    argField: {
        gap: 4,
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
