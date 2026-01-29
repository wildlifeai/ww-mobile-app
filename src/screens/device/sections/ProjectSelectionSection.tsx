import React from 'react'
import { View, StyleSheet } from 'react-native'
import { Text } from 'react-native-paper'
import { WWSelect } from '../../../components/ui/WWSelect'

interface ProjectSelectionSectionProps {
    selectedProject: string
    handleProjectChange: (projectId: string) => void
    isInitializing: boolean
    projects: any[] // Using any[] for now, or you can import Project type if available
    theme: any
}

export const ProjectSelectionSection: React.FC<ProjectSelectionSectionProps> = ({
    selectedProject,
    handleProjectChange,
    isInitializing,
    projects,
    theme
}) => {
    return (
        <View style={styles.section}>
            <Text variant="titleMedium" style={[styles.sectionTitle, { color: theme.colors.onSurface }]}>
                Project Association
            </Text>
            <WWSelect
                label="Project"
                value={selectedProject}
                onChange={handleProjectChange}
                disabled={isInitializing}
                options={[
                    { label: 'Select a project...', value: '' },
                    // Only show "Create New Project" if there are NO existing projects
                    // OR if the user explicitly needs it (but user said it's not required if others exist)
                    ...((!projects || projects.length === 0) ? [{ label: '➕ Create New Project', value: 'create_new' }] : []),
                    ...(projects?.map((p) => ({ label: p.name, value: p.id })) || []),
                ]}
            />
            {!selectedProject && (
                <Text variant="bodySmall" style={[styles.warningText, { color: theme.colors.error }]}>
                    ⚠️ Project selection required
                </Text>
            )}
        </View>
    )
}

const styles = StyleSheet.create({
    section: {
        marginBottom: 24,
    },
    sectionTitle: {
        fontWeight: '600',
        marginBottom: 16,
    },
    warningText: {
        marginTop: 8,
    },
})
