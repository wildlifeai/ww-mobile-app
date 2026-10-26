import { ReactNode } from 'react'
import { Pressable, StyleProp, StyleSheet, View, ViewStyle } from 'react-native'
import { Text, useTheme } from 'react-native-paper'
import { WWIcon } from './WWIcon'

interface FieldBoxProps {
    title: string
    /** Opens the field's help. Without it there is no "?". */
    onHelp?: () => void
    children: ReactNode
    /** For the box itself, such as flex: 1 around a notes field that fills the page */
    style?: StyleProp<ViewStyle>
}

/**
 * An input box with its title on the top border and a "?" right after the
 * title, which opens the field's help (26 October 2026 redesign, as little
 * text on the page as possible). The child draws the box: a paper outlined
 * TextInput or a WWSelect given no label of its own, whose outline then starts
 * at its top edge, or any view with a border. The title sits on that border
 * over the screen's background colour.
 */
export const FieldBox = ({ title, onHelp, children, style }: FieldBoxProps) => {
    const theme = useTheme()
    return (
        <View style={[styles.box, style]}>
            {children}
            <View style={[styles.legend, { backgroundColor: theme.colors.background }]} pointerEvents="box-none">
                <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>{title}</Text>
                {onHelp && (
                    <Pressable onPress={onHelp} hitSlop={12} accessibilityRole="button" accessibilityLabel={`Help: ${title}`}>
                        <WWIcon source="help-circle-outline" size={16} color={theme.colors.primary} />
                    </Pressable>
                )}
            </View>
        </View>
    )
}

const styles = StyleSheet.create({
    box: {
        marginTop: 8,
    },
    legend: {
        position: 'absolute',
        top: -9,
        left: 10,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 4,
    },
})
