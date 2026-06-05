
import { List, Text } from 'react-native-paper'
import * as Application from 'expo-application'

// Reusing icon helper
const ListItemIcon = (iconName: string) => (props: any) => <List.Icon {...props} icon={iconName} />

const Icons = {
    wrench: ListItemIcon("wrench"),
    package: ListItemIcon("package-variant"),
    tag: ListItemIcon("tag"),
    info: ListItemIcon("information"),
}

export const BuildInfoSection = () => {
    const isDevelopment = __DEV__
    const bundleId = Application.applicationId || "unknown"
    const appVersion = Application.nativeApplicationVersion || "unknown"
    const buildNumber = Application.nativeBuildVersion || "unknown"
    const readableVersion = `${appVersion}.${buildNumber}`

    return (
        <List.Section>
            <List.Subheader><Text>Build Information</Text></List.Subheader>
            <List.Item
                title="Build Type"
                description={isDevelopment ? "Development" : "Production"}
                left={Icons.wrench}
            />
            <List.Item
                title="Bundle Identifier"
                description={bundleId}
                left={Icons.package}
            />
            <List.Item
                title="App Version"
                description={`${appVersion} (${buildNumber})`}
                left={Icons.tag}
            />
            <List.Item
                title="Readable Version"
                description={readableVersion}
                left={Icons.info}
            />
        </List.Section>
    )
}
