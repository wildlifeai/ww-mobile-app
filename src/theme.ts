import {
	DefaultTheme as NavigationDefaultTheme,
	DarkTheme as NavigationDarkTheme,
} from "@react-navigation/native"
import {
	MD3DarkTheme,
	MD3LightTheme,
	MD3Theme,
	adaptNavigationTheme,
	useTheme,
} from "react-native-paper"
// Fix for React Native - deepmerge has non-standard exports
const deepmergeModule = require("deepmerge")
const merge = deepmergeModule.default || deepmergeModule

const { LightTheme, DarkTheme } = adaptNavigationTheme({
	reactNavigationLight: NavigationDefaultTheme,
	reactNavigationDark: NavigationDarkTheme,
})

const extendThemes = (theme: MD3Theme) => {
	return {
		...theme,
		appPadding: 20,
		roundness: 10,
		spacing: 10,
	}
}

const darkColors = {
	primary: "rgb(76, 175, 80)",
	onPrimary: "rgb(255, 255, 255)",
	primaryContainer: "rgb(76, 175, 80)",
	onPrimaryContainer: "rgb(255, 255, 255)",
	secondary: "rgb(76, 175, 80)",
	onSecondary: "rgb(255, 255, 255)",
	secondaryContainer: "rgb(56, 142, 60)",
	onSecondaryContainer: "rgb(255, 255, 255)",
	tertiary: "rgb(255, 255, 255)",
	onTertiary: "rgb(255, 255, 255)",
	tertiaryContainer: "rgb(255, 255, 255)",
	onTertiaryContainer: "rgb(255, 255, 255)",
	error: "rgb(255, 180, 171)",
	onError: "rgb(255, 255, 255)",
	errorContainer: "rgb(147, 0, 10)",
	onErrorContainer: "rgb(255, 255, 255)",
	background: "rgb(26, 28, 25)",
	onBackground: "rgb(255, 255, 255)",
	surface: "rgb(26, 28, 25)",
	onSurface: "rgb(255, 255, 255)",
	surfaceVariant: "rgb(66, 73, 64)",
	onSurfaceVariant: "rgb(255, 255, 255)",
	outline: "rgb(140, 147, 136)",
	outlineVariant: "rgb(66, 73, 64)",
	shadow: "rgb(0, 0, 0)",
	scrim: "rgb(0, 0, 0)",
	inverseSurface: "rgb(226, 227, 221)",
	inverseOnSurface: "rgb(255, 255, 255)",
	inversePrimary: "rgb(0, 110, 28)",
	elevation: {
		level0: "transparent",
		level1: "rgb(31, 38, 30)",
		level2: "rgb(34, 43, 33)",
		level3: "rgb(36, 49, 35)",
		level4: "rgb(37, 51, 36)",
		level5: "rgb(39, 55, 38)",
	},
	surfaceDisabled: "rgba(226, 227, 221, 0.12)",
	onSurfaceDisabled: "rgba(226, 227, 221, 0.38)",
	backdrop: "rgba(44, 50, 42, 0.4)",
	primaryDisabled: "rgba(120, 220, 119, 0.38)", // Using primary with 38% opacity
}

const lightColors = {
	primary: "rgb(0, 110, 28)",
	onPrimary: "rgb(255, 255, 255)",
	primaryContainer: "rgb(148, 249, 144)",
	onPrimaryContainer: "rgb(0, 34, 4)",
	secondary: "rgb(46, 125, 50)",
	onSecondary: "rgb(255, 255, 255)",
	secondaryContainer: "rgb(200, 230, 201)",
	onSecondaryContainer: "rgb(27, 94, 32)",
	tertiary: "rgb(0, 104, 116)",
	onTertiary: "rgb(255, 255, 255)",
	tertiaryContainer: "rgb(151, 240, 255)",
	onTertiaryContainer: "rgb(0, 31, 36)",
	error: "rgb(186, 26, 26)",
	onError: "rgb(255, 255, 255)",
	errorContainer: "rgb(255, 218, 214)",
	onErrorContainer: "rgb(65, 0, 2)",
	background: "rgb(252, 253, 246)",
	onBackground: "rgb(26, 28, 25)",
	surface: "rgb(252, 253, 246)",
	onSurface: "rgb(26, 28, 25)",
	surfaceVariant: "rgb(222, 229, 216)",
	onSurfaceVariant: "rgb(66, 73, 64)",
	outline: "rgb(114, 121, 111)",
	outlineVariant: "rgb(194, 201, 189)",
	shadow: "rgb(0, 0, 0)",
	scrim: "rgb(0, 0, 0)",
	inverseSurface: "rgb(47, 49, 45)",
	inverseOnSurface: "rgb(240, 241, 235)",
	inversePrimary: "rgb(120, 220, 119)",
	elevation: {
		level0: "transparent",
		level1: "rgb(239, 246, 235)",
		level2: "rgb(232, 242, 229)",
		level3: "rgb(224, 237, 222)",
		level4: "rgb(222, 236, 220)",
		level5: "rgb(217, 233, 216)",
	},
	surfaceDisabled: "rgba(26, 28, 25, 0.12)",
	onSurfaceDisabled: "rgba(26, 28, 25, 0.38)",
	backdrop: "rgba(44, 50, 42, 0.4)",
	primaryDisabled: "rgba(0, 110, 28, 0.38)", // Using primary with 38% opacity
}

export const CombinedDefaultTheme = merge(
	DarkTheme,
	extendThemes({
		...MD3DarkTheme,
		colors: darkColors,
	}),
)

export const CombinedLightTheme = merge(
	LightTheme,
	extendThemes({
		...MD3LightTheme,
		colors: lightColors,
	}),
)

export const useExtendedTheme = () =>
	useTheme<typeof CombinedDefaultTheme | typeof CombinedLightTheme>()
