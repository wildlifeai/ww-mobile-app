import React from 'react'
import { Portal, Dialog, Button, Text } from 'react-native-paper'

interface Props {
    visible: boolean
    title: string
    content: string
    onDismiss: () => void
}

export const HelpDialog = ({ visible, title, content, onDismiss }: Props) => {
    return (
        <Portal>
            <Dialog visible={visible} onDismiss={onDismiss}>
                <Dialog.Title>{title}</Dialog.Title>
                <Dialog.Content>
                    <Text variant="bodyMedium">{content}</Text>
                </Dialog.Content>
                <Dialog.Actions>
                    <Button onPress={onDismiss}>Close</Button>
                </Dialog.Actions>
            </Dialog>
        </Portal>
    )
}
