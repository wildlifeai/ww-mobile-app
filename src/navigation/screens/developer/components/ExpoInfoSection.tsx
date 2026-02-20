

import { List } from 'react-native-paper'
import Constants from 'expo-constants'

const ListItemIcon = (iconName: string) => (props: any) => <List.Icon {...props} icon={iconName} />

const Icons = {
    rocket: ListItemIcon("rocket"),
    cellphone: ListItemIcon("cellphone"),
    wifi: ListItemIcon("wifi"),
}

export const ExpoInfoSection = () => {
    const expoSdkVersion = Constants.expoConfig?.sdkVersion || "Unknown"

    return (
        <List.Section>
            <List.Subheader>Expo Information</List.Subheader>
            <List.Item
                title="Expo SDK Version"
                description={expoSdkVersion}
                left={Icons.rocket}
            />
            <List.Item
                title="Expo Client"
                description="Development Client"
                left={Icons.cellphone}
            />
            <List.Item
                title="Metro Bundler"
                description="Connected via WSL2"
                left={Icons.wifi}
            />
        </List.Section>
    )
}
