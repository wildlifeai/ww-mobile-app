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

export const CommandReferenceModal = ({ visible, onDismiss, onRunCommand }: Props) => {
    const { colors, spacing } = useExtendedTheme()

    // Flatten commands for display - filtering out process/workflow commands to keep the console pure
    const commandList = Object.values(COMMANDS)
        .filter(cmd => cmd.type === 'command' || !cmd.type)
        .map((cmd) => ({
        name: cmd.name,
        read: cmd.readCommand || "-",
        write: cmd.writeCommand ? "Yes" : "-",
        description: cmd.description,
        type: cmd.type,
    }))

    const dynamicStyles = useMemo(() => ({
        modal: {
            backgroundColor: colors.background
        },
        instructionText: {
            marginBottom: spacing,
            marginTop: spacing
        },
        rowBorder: {
            borderBottomColor: colors.outlineVariant
        },
        chip: {
            backgroundColor: colors.surfaceVariant
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
                        <Text>List of available firmware commands. Click Run to send.</Text>
                    </WWText>

                    {commandList.map((cmd) => (
                        <View key={cmd.name} style={[styles.row, dynamicStyles.rowBorder]}>
                            <View style={styles.rowInfo}>
                                <View style={styles.nameContainer}>
                                    <WWText style={styles.boldText}><Text>{cmd.name}</Text></WWText>
                                    {cmd.type && (
                                        <Chip
                                            compact
                                            style={[styles.chip, dynamicStyles.chip]}
                                            textStyle={styles.chipText}
                                        >
                                            <Text>{cmd.type === 'process' ? 'Process' : cmd.type === 'local' ? 'Local' : 'Cmd'}</Text>
                                        </Chip>
                                    )}
                                </View>
                                {cmd.description && (
                                    <WWText variant="bodySmall" style={dynamicStyles.descriptionText}>
                                        <Text>{cmd.description}</Text>
                                    </WWText>
                                )}
                            </View>
                            <View style={styles.rowAction}>
                                <Button mode="contained" compact onPress={() => onRunCommand(cmd.name)}>
                                    <Text>Run</Text>
                                </Button>
                            </View>
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
    row: {
        flexDirection: 'row',
        paddingVertical: 12,
        borderBottomWidth: 1,
        alignItems: 'center'
    },
    rowInfo: {
        flex: 2
    },
    nameContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8
    },
    boldText: {
        fontWeight: 'bold'
    },
    chip: {
        height: 20
    },
    chipText: {
        fontSize: 10,
        marginVertical: 0
    },
    rowAction: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center'
    }
})
