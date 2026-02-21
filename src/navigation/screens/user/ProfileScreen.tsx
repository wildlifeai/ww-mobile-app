import { View } from "react-native"
import { WWScreenView } from "../../../components/ui/WWScreenView"
import { WWText } from "../../../components/ui/WWText"
import { Text } from "react-native-paper"

export const Profile = () => {
	return (
		<WWScreenView>
			<View>
				<WWText variant="titleSmall"><Text>Profile screen.</Text></WWText>
			</View>
		</WWScreenView>
	)
}
