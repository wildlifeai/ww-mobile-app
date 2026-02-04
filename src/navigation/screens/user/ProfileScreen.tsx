import { View } from "react-native"
import { WWScreenView } from "../../../components/ui/WWScreenView"
import { WWText } from "../../../components/ui/WWText"

export const Profile = () => {
	return (
		<WWScreenView>
			<View>
				<WWText variant="titleSmall">Profile screen.</WWText>
			</View>
		</WWScreenView>
	)
}
