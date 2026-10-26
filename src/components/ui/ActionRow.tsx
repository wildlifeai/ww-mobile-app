import { Image, Pressable, StyleSheet, View } from 'react-native'
import { ActivityIndicator, Text, useTheme } from 'react-native-paper'
import { WWIcon } from './WWIcon'

interface ActionRowProps {
    title: string
    onPress: () => void
    /** Opens the action's help. Without it there is no "?". */
    onHelp?: () => void
    /** What the action found, under the name: "78%", "Motion seen" */
    result?: string | null
    /** A picture the action took, shown at the right as a thumbnail */
    image?: string | null
    /** Shows a spinner at the right while the action runs */
    busy?: boolean
    disabled?: boolean
}

/**
 * An action on a form page: a quiet filled button with the action's name in
 * the middle, a "?" after the name, and once it has run what it found under
 * the name. Tapping it runs the action in a closable popup (ActionDialog). It
 * is filled, not outlined, so it never reads as one of the FieldBox inputs
 * beside it, and neutral, so the screen's main button stays the one that
 * stands out (26 October 2026 redesign).
 */
export const ActionRow = ({ title, onPress, onHelp, result, image, busy, disabled }: ActionRowProps) => {
    const theme = useTheme()
    return (
        <Pressable
            onPress={onPress}
            disabled={disabled}
            accessibilityRole="button"
            accessibilityLabel={title}
            style={({ pressed }) => [
                styles.row,
                {
                    backgroundColor: theme.colors.surfaceVariant,
                    opacity: disabled ? 0.5 : pressed ? 0.8 : 1,
                },
            ]}
        >
            <View style={styles.titleRow}>
                <Text variant="titleMedium" style={[styles.title, { color: theme.colors.onSurface }]}>{title}</Text>
                {onHelp && (
                    <Pressable onPress={onHelp} hitSlop={12} accessibilityRole="button" accessibilityLabel={`Help: ${title}`}>
                        <WWIcon source="help-circle-outline" size={16} color={theme.colors.primary} />
                    </Pressable>
                )}
            </View>
            {!!result && !busy && (
                <Text variant="labelMedium" style={{ color: theme.colors.onSurfaceVariant }}>{result}</Text>
            )}
            {busy ? (
                <ActivityIndicator size="small" style={styles.side} />
            ) : (
                !!image && <Image source={{ uri: image }} style={[styles.side, styles.thumb]} />
            )}
        </Pressable>
    )
}

/** Room each side for the spinner or thumbnail, so the centred name never runs under it */
const SIDE = 56

const styles = StyleSheet.create({
    row: {
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 56,
        paddingHorizontal: SIDE,
        paddingVertical: 8,
        borderRadius: 28,
    },
    titleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    title: {
        flexShrink: 1,
        textAlign: 'center',
    },
    side: {
        position: 'absolute',
        right: 8,
    },
    thumb: {
        width: 40,
        height: 40,
        borderRadius: 20,
    },
})
