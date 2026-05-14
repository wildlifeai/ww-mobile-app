import { useState } from "react"
import { View, StyleSheet, ScrollView, Alert } from "react-native"
import { WWScreenView } from "../../../components/ui/WWScreenView"
import { WWText } from "../../../components/ui/WWText"
import { List, Divider, Button, ActivityIndicator } from "react-native-paper"
import dayjs from "dayjs"
import { useGetProjectsQuery } from "../../../redux/api/projectsApi"
import { useSupabaseAuth } from "../../../hooks/useSupabaseAuth"
import { useUserOrganisations } from "../../../hooks/useUserOrganisations"
import { useExtendedTheme } from "../../../theme"

const OrganisationProjectsList = ({ orgId, userId }: { orgId: string, userId: string }) => {
	const { data: projects, isLoading } = useGetProjectsQuery({ userId, organisationId: orgId })
	const { colors } = useExtendedTheme()

	if (isLoading) return <ActivityIndicator style={{ marginVertical: 8 }} />
	if (!projects || projects.length === 0) return <WWText variant="bodySmall" style={{ marginLeft: 72, color: colors.onSurfaceVariant }}>No projects found</WWText>

	return (
		<View style={{ marginLeft: 72, marginBottom: 8 }}>
			<WWText variant="labelSmall" style={{ color: colors.primary, marginBottom: 4 }}>Projects:</WWText>
			{projects.map(p => (
				<WWText key={p.id} variant="bodySmall" style={{ color: colors.onSurfaceVariant }}>
					• {p.name}
				</WWText>
			))}
		</View>
	)
}

export const Profile = () => {
	const { user, resetPassword } = useSupabaseAuth()
	const { organisations } = useUserOrganisations()
	const { spacing, colors } = useExtendedTheme()
	const [resetting, setResetting] = useState(false)

	const handleResetPassword = async () => {
		if (!user?.email) return
		
		try {
			setResetting(true)
			await resetPassword(user.email)
			Alert.alert("Success", "Password reset link has been sent to your email.")
		} catch (error) {
			Alert.alert("Error", "Failed to send password reset link.")
		} finally {
			setResetting(false)
		}
	}

	return (
		<WWScreenView>
			<ScrollView contentContainerStyle={styles.container}>
				<View style={[styles.header, { marginBottom: spacing * 3 }]}>
					<WWText variant="titleLarge" style={{ marginTop: spacing }}>
						{user?.profile?.first_name || ""} {user?.profile?.last_name || ""}
					</WWText>
					<WWText variant="bodyMedium" style={{ color: colors.onSurfaceVariant }}>
						{user?.email}
					</WWText>
					{user?.created_at && (
						<WWText variant="bodySmall" style={{ color: colors.onSurfaceVariant, marginTop: spacing / 2 }}>
							Member since {dayjs(user.created_at).format('MMMM YYYY')}
						</WWText>
					)}
				</View>

				<Divider />

				<List.Section>
					<List.Subheader>Organisations</List.Subheader>
					{organisations.length > 0 ? (
						organisations.map((org) => (
							<View key={org.id}>
								<List.Item
									title={org.name}
									description={`Role: ${org.role.replace("_", " ")}`}
									left={(props) => <List.Icon {...props} icon="domain" />}
								/>
								{user?.id && <OrganisationProjectsList orgId={org.id} userId={user.id} />}
							</View>
						))
					) : (
						<List.Item title="No organisations found" />
					)}
				</List.Section>

				<Divider />

				<List.Section>
					<List.Subheader>Account Actions</List.Subheader>
					<View style={{ paddingHorizontal: spacing * 2, marginTop: spacing }}>
						<Button 
							mode="outlined" 
							onPress={handleResetPassword}
							loading={resetting}
							disabled={resetting}
						>
							Reset Password
						</Button>
					</View>
				</List.Section>

			</ScrollView>
		</WWScreenView>
	)
}

const styles = StyleSheet.create({
	container: {
		flexGrow: 1,
		paddingBottom: 20,
	},
	header: {
		alignItems: "center",
		marginTop: 20,
	},
})
