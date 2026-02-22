import React, { useMemo, useCallback } from 'react'
import { View, StyleSheet } from 'react-native'
import { Card, Text } from 'react-native-paper'
import { WWText } from '../../../components/ui/WWText'
import { WWIcon } from '../../../components/ui/WWIcon'
import { useExtendedTheme } from '../../../theme'
import type Deployment from '../../../database/models/Deployment'

interface Props {
    deployment: Deployment
}

export const DeploymentNotesCard: React.FC<Props> = ({ deployment }) => {
    const theme = useExtendedTheme()
    const { colors } = theme
    const styles = useMemo(() => createStyles(theme), [theme])

    const renderNotesLeft = useCallback((props: any) => (
        <WWIcon {...props} source="note-text" size={24} color={colors.onSurface} />
    ), [colors.onSurface])

    if (!deployment.startDeploymentComments && !deployment.endDeploymentComments) {
        return null
    }

    return (
        <Card mode="outlined" style={styles.card}>
            <Card.Title
                title="Notes & Comments"
                titleStyle={styles.cardTitle}
                left={renderNotesLeft}
            />
            <Card.Content>
                {deployment.startDeploymentComments && (
                    <View style={styles.noteSection}>
                        <WWText variant="labelLarge" style={styles.noteLabel}>
                            <Text>Start Comments</Text>
                        </WWText>
                        <WWText variant="bodyMedium" style={styles.noteText}>
                            {deployment.startDeploymentComments}
                        </WWText>
                    </View>
                )}
                {deployment.endDeploymentComments && (
                    <View style={styles.noteSection}>
                        <WWText variant="labelLarge" style={styles.noteLabel}>
                            <Text>Retrieval Notes</Text>
                        </WWText>
                        <WWText variant="bodyMedium" style={styles.noteText}>
                            {deployment.endDeploymentComments}
                        </WWText>
                    </View>
                )}
            </Card.Content>
        </Card>
    )
}

const createStyles = (theme: any) => StyleSheet.create({
    card: {
        marginBottom: 16,
        backgroundColor: 'transparent',
    },
    cardTitle: {
        color: theme.colors.onSurface,
    },
    noteSection: {
        marginBottom: 16,
    },
    noteLabel: {
        color: theme.colors.onSurfaceVariant,
        marginBottom: 6,
    },
    noteText: {
        lineHeight: 20,
        color: theme.colors.onSurface,
    },
})
