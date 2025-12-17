// Import gesture handler FIRST before any other imports  
import 'react-native-gesture-handler'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { StatusBar } from 'expo-status-bar'

import { Suspense } from "react"
import { Text } from "react-native"

import { SafeAreaProvider } from "react-native-safe-area-context"
import { Provider as ReduxProvider } from "react-redux"
import { AndroidPermissionsProvider } from "./providers/AndroidPermissionsProvider"
import { AppSetupProvider } from "./providers/AppSetupProvider"
import { BleEngineProvider } from "./providers/BleEngineProvider"
import store from "./redux"
import { MainNavigation } from "./navigation"
import { NavigationContainer } from "@react-navigation/native"
import { linking } from "./navigation/linking"
import { ListenToBleEngineProvider } from "./providers/ListenToBleEngineProvider"
import { PaperProvider } from "react-native-paper"
import { CombinedDefaultTheme } from "./theme"
import { AuthProvider } from "./providers/AuthProvider"

export const App = () => {
	return (
		<GestureHandlerRootView style={{ flex: 1 }}>
			<SafeAreaProvider>
				<StatusBar style="light" backgroundColor="#000000" />
				<Suspense fallback={<Text>Loading...</Text>}>
					<ReduxProvider store={store}>
						<PaperProvider theme={CombinedDefaultTheme}>
							<NavigationContainer theme={CombinedDefaultTheme} linking={linking}>
								<AndroidPermissionsProvider>
									<AppSetupProvider>
										<BleEngineProvider>
											<ListenToBleEngineProvider>
												<AuthProvider>
													<MainNavigation />
												</AuthProvider>
											</ListenToBleEngineProvider>
										</BleEngineProvider>
									</AppSetupProvider>
								</AndroidPermissionsProvider>
							</NavigationContainer>
						</PaperProvider>
					</ReduxProvider>
				</Suspense>
			</SafeAreaProvider>
		</GestureHandlerRootView>
	)
}
