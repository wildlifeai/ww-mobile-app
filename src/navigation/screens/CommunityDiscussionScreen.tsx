import { View } from "react-native"
import { WWScreenView } from "../../components/ui/WWScreenView"
import { WWText } from "../../components/ui/WWText"
import { Text } from "react-native-paper"

export const CommunityDiscussion = () => {
	return (
		<WWScreenView>
			<View>
				<WWText variant="titleSmall"><Text>Community discussion screen.</Text></WWText>
			</View>
		</WWScreenView>
	)
}
