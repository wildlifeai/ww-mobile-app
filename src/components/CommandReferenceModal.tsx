import React, { useState } from "react"
import { View, ScrollView, StyleSheet } from "react-native"
import { Modal, Portal, IconButton, Divider, List, Button, Chip } from "react-native-paper"
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

    // Flatten commands for display
    const commandList = Object.values(COMMANDS).map((cmd) => ({
        name: cmd.name,
        read: cmd.readCommand || "-",
        write: cmd.writeCommand ? "Yes" : "-",
        description: cmd.description,
        type: cmd.type,
    }))

    return (
        <Portal>
            <Modal visible={visible} onDismiss={onDismiss} contentContainerStyle={[styles.modal, { backgroundColor: colors.background }]}>
                <View style={styles.header}>
                    <WWText variant="titleLarge">Command Reference</WWText>
                    <IconButton icon="close" onPress={onDismiss} />
                </View>

                <Divider />

                <ScrollView style={styles.content}>
                    <WWText style={{ marginBottom: spacing, marginTop: spacing }}>
                        List of available firmware commands. Click Run to send.
                    </WWText>

                    {commandList.map((cmd, index) => (
                        <View key={index} style={[styles.row, { borderBottomColor: colors.outlineVariant }]}>
                            <View style={{ flex: 2 }}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                    <WWText style={{ fontWeight: 'bold' }}>{cmd.name}</WWText>
                                    {cmd.type && (
                                        <Chip
                                            compact
                                            style={{
                                                height: 20,
                                                backgroundColor: colors.surfaceVariant
                                            }}
                                            textStyle={{ fontSize: 10, marginVertical: 0 }}
                                        >
                                            {cmd.type === 'process' ? 'Process' : cmd.type === 'local' ? 'Local' : 'Cmd'}
                                        </Chip>
                                    )}
                                </View>
                                {cmd.description && (
                                    <WWText variant="bodySmall" style={{ color: colors.onSurfaceVariant }}>
                                        {cmd.description}
                                    </WWText>
                                )}
                            </View>
                            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                                <Button mode="contained" compact onPress={() => onRunCommand(cmd.name)}>
                                    Run
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
    }
})
