/**
 * Google sign-in (#350): the OAuth client IDs this build was given.
 *
 * Read like the Supabase settings in `environments.ts`: the `EXPO_PUBLIC_` var
 * first, then the value `app.config.ts` copied into `extra`. Read at the call,
 * not at import, so the answer is whatever the build carries now.
 */

import Constants from "expo-constants"
import { Platform } from "react-native"

export interface GoogleSignInConfig {
	/** The web OAuth client set up in Supabase's Google provider, passed as `webClientId`. */
	webClientId: string
	/** The iOS OAuth client; required on iOS, unused on Android. */
	iosClientId?: string
}

const read = (value: unknown): string =>
	typeof value === "string" ? value.trim() : ""

/**
 * The client IDs, or null when this build cannot offer Google sign-in: no web
 * client ID, or no iOS client ID on iOS.
 */
export function getGoogleSignInConfig(): GoogleSignInConfig | null {
	const extra = Constants.expoConfig?.extra
	const webClientId = read(process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID) || read(extra?.googleWebClientId)
	const iosClientId = read(process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID) || read(extra?.googleIosClientId)

	if (!webClientId) return null
	if (Platform.OS === "ios" && !iosClientId) return null
	return { webClientId, iosClientId: iosClientId || undefined }
}

/** Whether to show "Continue with Google". */
export const isGoogleSignInConfigured = (): boolean => getGoogleSignInConfig() !== null
