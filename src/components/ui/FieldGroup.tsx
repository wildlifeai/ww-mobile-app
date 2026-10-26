import { ReactNode, useMemo } from 'react'
import { StyleSheet, View } from 'react-native'
import { ThemeProvider, useTheme } from 'react-native-paper'

/**
 * A rounded panel, a shade lighter than the screen, that groups boxes which
 * belong together: on Start Monitoring the project and its icons, the tests of
 * the camera in place, and the notes with the site photo (26 October 2026).
 *
 * Inside, the panel's colour is the theme's background: an outlined input
 * fills with the background colour and a FieldBox title sits on it, so both
 * blend into the panel instead of showing the screen's darker colour.
 */
export const FieldGroup = ({ children }: { children: ReactNode }) => {
    const theme = useTheme()
    const fill = theme.colors.elevation?.level2 ?? theme.colors.surfaceVariant
    const inner = useMemo(() => ({ ...theme, colors: { ...theme.colors, background: fill } }), [theme, fill])
    return (
        <View style={[styles.group, { backgroundColor: fill }]}>
            <ThemeProvider theme={inner}>{children}</ThemeProvider>
        </View>
    )
}

const styles = StyleSheet.create({
    group: {
        borderRadius: 20,
        padding: 16,
        gap: 16,
    },
})
