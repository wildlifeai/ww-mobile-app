import React from 'react'
import { View, StyleSheet } from 'react-native'
import { Button, Card, Text, Divider } from 'react-native-paper'
import { WWSelect } from '../../../components/ui/WWSelect'
import { WWButton } from '../../../components/ui/WWButton'
import { WWIcon } from '../../../components/ui/WWIcon'

interface ProjectSelectionSectionProps {
    selectedProject: string
    handleProjectChange: (projectId: string) => void
    isInitializing: boolean
    projects: any[]
    theme: any
    onShowHelp: (title: string, content: string) => void
}

export const ProjectSelectionSection: React.FC<ProjectSelectionSectionProps> = ({
    selectedProject,
    handleProjectChange,
    isInitializing,
    projects,
    theme,
    onShowHelp
}) => {
    return (
        <Card style={styles.card}>
            <Card.Title
                title="Project Association"
                left={(props) => <WWIcon {...props} source="tune" />}
                right={(props) => (
                    <Button 
                        {...props} 
                        icon="help-circle-outline" 
                        onPress={() => onShowHelp('Project Association', 'Select the project that this device will appear in. You can also create a new project here.')}
                    >
                        Help
                    </Button>
                )}
            />
            <Card.Content>
                <WWSelect
                    label="Project"
                    value={selectedProject}
                    onChange={handleProjectChange}
                    disabled={isInitializing}
                    options={[
                        { label: 'Select a project...', value: '' },
                        ...(projects?.map((p) => ({ label: p.name, value: p.id })) || []),
                        { label: '➕ Create New Project', value: 'create_new' }
                    ]}
                />
                {!selectedProject && (
                    <Text variant="bodySmall" style={[styles.warningText, { color: theme.colors.error }]}>
                        ⚠️ Project selection required
                    </Text>
                )}

                <Divider style={styles.divider} />

                <WWButton
                    mode="outlined"
                    onPress={() => handleProjectChange('create_new')}
                    icon="plus"
                    disabled={isInitializing}
                >
                    Create New Project
                </WWButton>
            </Card.Content>
        </Card>
    )
}

const styles = StyleSheet.create({
    card: {
        // marginBottom: 16, // Removed to use gap in parent container
    },
    divider: {
        marginVertical: 16,
    },
    warningText: {
        marginTop: 8,
    },
})
