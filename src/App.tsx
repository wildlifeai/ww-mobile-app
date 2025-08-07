// Lazy load gesture handler to avoid NativeModule error during initialization
const lazyLoadGestureHandler = () => {
  try {
    require("react-native-gesture-handler");
  } catch (e) {
    console.warn("Gesture handler not available:", e);
  }
};

// Load gesture handler when component mounts
setTimeout(lazyLoadGestureHandler, 100);

import { Suspense } from "react"

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
		<SafeAreaProvider>
			<Suspense fallback={"Loading..."}>
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
	)
}
