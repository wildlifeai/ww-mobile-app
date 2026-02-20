
import { Platform } from 'react-native'
import { List } from 'react-native-paper'

const ListItemIcon = (iconName: string) => (props: any) => <List.Icon {...props} icon={iconName} />

const Icons = {
    cellphone: ListItemIcon("cellphone"),
    infoOutline: ListItemIcon("information-outline"),
    react: ListItemIcon("react"),
}

export const PlatformInfoSection = () => {
    const reactNativeVersion = Platform.constants?.reactNativeVersion || {}
    const rnVersionString = `${reactNativeVersion.major || 0}.${reactNativeVersion.minor || 0
        }.${reactNativeVersion.patch || 0}`

    return (
        <List.Section>
            <List.Subheader>Platform Information</List.Subheader>
            <List.Item
                title="Platform"
                description={Platform.OS}
                left={Icons.cellphone}
            />
            <List.Item
                title="Platform Version"
                description={`API ${Platform.Version}`}
                left={Icons.infoOutline}
            />
            <List.Item
                title="React Native Version"
                description={rnVersionString}
                left={Icons.react}
            />
        </List.Section>
    )
}
