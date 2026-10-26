import { ReactNode } from 'react'
import { ScrollView, StyleSheet } from 'react-native'
import { Button, Dialog, Portal } from 'react-native-paper'

interface ActionDialogProps {
    visible: boolean
    title: string
    onClose: () => void
    children: ReactNode
    /** Buttons before Close, such as Take Another */
    actions?: ReactNode
}

/** The popup an ActionRow opens: its result and controls, and a Close. */
export const ActionDialog = ({ visible, title, onClose, children, actions }: ActionDialogProps) => (
    <Portal>
        <Dialog visible={visible} onDismiss={onClose} style={styles.dialog}>
            <Dialog.Title>{title}</Dialog.Title>
            <Dialog.ScrollArea>
                <ScrollView contentContainerStyle={styles.content}>{children}</ScrollView>
            </Dialog.ScrollArea>
            <Dialog.Actions>
                {actions}
                <Button onPress={onClose}>Close</Button>
            </Dialog.Actions>
        </Dialog>
    </Portal>
)

const styles = StyleSheet.create({
    dialog: {
        maxHeight: '85%',
    },
    content: {
        gap: 12,
        paddingVertical: 16,
    },
})
