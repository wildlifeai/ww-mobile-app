
import { List, Text } from 'react-native-paper'

const listItemIcon = (iconName: string) => (props: any) => <List.Icon {...props} icon={iconName} />

const Icons = {
    checkCircle: listItemIcon("check-circle"),
    cloudCheck: listItemIcon("cloud-check"),
    checkAll: listItemIcon("check-all"),
}

export const MigrationStatusSection = () => {
    return (
        <List.Section>
            <List.Subheader><Text>Migration Status</Text></List.Subheader>
            <List.Item
                title="Migration"
                description="Expo SDK 51 Migration Complete"
                left={Icons.checkCircle}
            />
            <List.Item
                title="EAS Build"
                description="Development Client Active"
                left={Icons.cloudCheck}
            />
            <List.Item
                title="Native Modules"
                description="BLE, Maps, Nordic DFU Working"
                left={Icons.checkAll}
            />
        </List.Section>
    )
}
