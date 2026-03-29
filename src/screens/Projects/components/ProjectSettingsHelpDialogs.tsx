import React from 'react'
import { StyleSheet, ScrollView } from 'react-native'
import { Text, Portal, Dialog, Button, Divider } from 'react-native-paper'

interface Props {
    samplingHelpVisible: boolean
    setSamplingHelpVisible: (visible: boolean) => void
    captureHelpVisible: boolean
    setCaptureHelpVisible: (visible: boolean) => void
    gpsHelpVisible: boolean
    setGpsHelpVisible: (visible: boolean) => void
}

export const ProjectSettingsHelpDialogs: React.FC<Props> = ({
    samplingHelpVisible,
    setSamplingHelpVisible,
    captureHelpVisible,
    setCaptureHelpVisible,
    gpsHelpVisible,
    setGpsHelpVisible
}) => {
    return (
        <Portal>
            <Dialog
                visible={samplingHelpVisible}
                onDismiss={() => setSamplingHelpVisible(false)}
                style={styles.dialog}
            >
                <Dialog.Title><Text>Sampling Designs</Text></Dialog.Title>
                <Dialog.ScrollArea>
                    <ScrollView contentContainerStyle={styles.dialogScrollContent}>
                        <Text style={styles.helpItem}>
                            <Text style={styles.bold}>Simple random:</Text> <Text>random
                            distribution of sampling locations</Text>
                        </Text>
                        <Divider style={styles.divider} />

                        <Text style={styles.helpItem}>
                            <Text style={styles.bold}>Systematic random:</Text> <Text>random
                            distribution of sampling locations, but arranged in a regular
                            pattern</Text>
                        </Text>
                        <Divider style={styles.divider} />

                        <Text style={styles.helpItem}>
                            <Text style={styles.bold}>Clustered random:</Text> <Text>random
                            distribution of sampling locations, but clustered in arrays</Text>
                        </Text>
                        <Divider style={styles.divider} />

                        <Text style={styles.helpItem}>
                            <Text style={styles.bold}>Experimental:</Text> <Text>non-random
                            distribution aimed to study an effect, including the
                            before-after control-impact (BACI) design</Text>
                        </Text>
                        <Divider style={styles.divider} />

                        <Text style={styles.helpItem}>
                            <Text style={styles.bold}>Targeted:</Text> <Text>non-random
                            distribution optimized for capturing specific target species
                            (often using various bait types)</Text>
                        </Text>
                        <Divider style={styles.divider} />

                        <Text style={styles.helpItem}>
                            <Text style={styles.bold}>Opportunistic:</Text> <Text>opportunistic
                            camera trapping (usually with a small number of cameras).</Text>
                        </Text>
                    </ScrollView>
                </Dialog.ScrollArea>
                <Dialog.Actions>
                    <Button onPress={() => setSamplingHelpVisible(false)}>
                        <Text>Close</Text>
                    </Button>
                </Dialog.Actions>
            </Dialog>

            <Dialog
                visible={captureHelpVisible}
                onDismiss={() => setCaptureHelpVisible(false)}
                style={styles.dialog}
            >
                <Dialog.Title><Text>Capture Methods</Text></Dialog.Title>
                <Dialog.ScrollArea>
                    <ScrollView contentContainerStyle={styles.dialogScrollContent}>
                        <Text style={styles.helpItem}>
                            <Text style={styles.bold}>activityDetection:</Text> <Text>The camera
                            uses the motion-detection sensor to record photos</Text>
                        </Text>
                        <Divider style={styles.divider} />

                        <Text style={styles.helpItem}>
                            <Text style={styles.bold}>timeLapse:</Text> <Text>Set a timer (e.g.
                            every 30 seconds) for the camera to take photos.</Text>
                        </Text>
                    </ScrollView>
                </Dialog.ScrollArea>
                <Dialog.Actions>
                    <Button onPress={() => setCaptureHelpVisible(false)}>
                        <Text>Close</Text>
                    </Button>
                </Dialog.Actions>
            </Dialog>

            <Dialog
                visible={gpsHelpVisible}
                onDismiss={() => setGpsHelpVisible(false)}
                style={styles.dialog}
            >
                <Dialog.Title><Text>GPS Image Tracking</Text></Dialog.Title>
                <Dialog.ScrollArea>
                    <ScrollView contentContainerStyle={styles.dialogScrollContent}>
                        <Text style={styles.helpItem}>
                            Geolocation is by default only tracked in the Wildlife Watcher database so that only users with access to the project and deployments can access the information.
                        </Text>
                        <Divider style={styles.divider} />
                        <Text style={styles.helpItem}>
                            <Text style={styles.bold}>Warning:</Text> Writing the GPS locations directly in the images' EXIF properties can expose sensitive information (e.g., a georeferenced picture of a threatened species floating online). Enable this only if absolutely necessary for your workflow.
                        </Text>
                    </ScrollView>
                </Dialog.ScrollArea>
                <Dialog.Actions>
                    <Button onPress={() => setGpsHelpVisible(false)}>
                        <Text>Close</Text>
                    </Button>
                </Dialog.Actions>
            </Dialog>
        </Portal>
    )
}

const styles = StyleSheet.create({
    helpItem: {
        marginBottom: 8,
        lineHeight: 20,
    },
    bold: {
        fontWeight: "bold",
    },
    divider: {
        marginVertical: 8,
    },
    dialog: {
        maxHeight: "80%",
    },
    dialogScrollContent: {
        paddingVertical: 16,
    },
})
