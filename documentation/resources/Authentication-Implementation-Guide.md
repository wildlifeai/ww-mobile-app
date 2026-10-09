# Authentication Implementation Guide

> **Prerequisite reading**: [01-TECHNOLOGY-STACK.md](../onboarding/01-TECHNOLOGY-STACK.md) (Redux architecture, provider hierarchy) and [02-CODEBASE-GUIDE.md](../onboarding/02-CODEBASE-GUIDE.md) (folder structure, state management conventions).

## Architecture Overview

Authentication uses **Supabase Auth + Redux + RTK Query**. There is no React Context; the `AuthProvider` dispatches directly to the Redux store.

```
App Start
  → AuthProvider checks Supabase session (getCurrentSession)
  → Dispatches setInitialState(session) to Redux
  → Sets up onAuthStateChange listener
  → On change: dispatches setCredentials / logout

Navigation reads Redux state.authentication.token
  → No token  → Login / Register / ForgotPassword screens
  → Has token → Main app screens
```

### Navigation Gate (Priority Chain)

`MainNavigation` (`src/navigation/index.tsx`) uses conditional rendering with a priority chain — auth is one gate among several:

```tsx
// Simplified from src/navigation/index.tsx
if (appLoading)          → AppLoading screen
if (bluetooth !== on)    → BluetoothProblems screen
if (!bleInitialized)     → BLEProblems screen
if (!token)              → Auth screens (Login, Register, ForgotPassword)
else                     → Main app (Home, Devices, Projects, etc.)
```

> [!IMPORTANT]
> Never use `navigation.navigate()` to switch between auth/main states. The conditional rendering handles transitions automatically when Redux state changes.

---

## Key Files

| File | Purpose |
|------|---------|
| `src/providers/AuthProvider.tsx` | Session bootstrap + auth listener → Redux |
| `src/services/auth.ts` | Supabase auth functions (login, Google sign-in, register, logout, password reset, org fetching) |
| `src/services/supabase.ts` | Supabase client factory with environment switching |
| `src/redux/slices/authSlice.ts` | Auth state, types, roles, permissions, org management |
| `src/redux/api/auth/index.ts` | RTK Query mutations (`useLoginMutation`, `useGoogleSignInMutation`, `useRegisterMutation`) |
| `src/config/googleSignIn.ts` | The Google client IDs this build carries, and whether to offer Google sign-in |
| `src/components/GoogleSignInButton.tsx` | "Continue with Google" on Login and Register |
| `src/redux/api/auth/types.ts` | Request types; re-exports auth types from `authSlice` |
| `src/navigation/index.tsx` | Navigation gate (auth/main conditional rendering) |
| `src/navigation/linking.ts` | Deep link configuration |
| `src/hooks/useDeepLinking.ts` | Deep link handler for auth callbacks |
| `src/navigation/screens/auth/` | `LoginScreen.tsx`, `RegisterScreen.tsx`, `ForgotPasswordScreen.tsx` |

---

## AuthProvider

**File**: `src/providers/AuthProvider.tsx`

The provider is minimal — no Context, no `useAuth()` hook. It:
1. Calls `getCurrentSession()` from `auth.ts` on mount
2. Dispatches `setInitialState(session)` to Redux
3. Sets up `setupAuthListener()` which dispatches `setCredentials` or `logout` on auth state changes
4. Stores the unsubscribe function in a ref for cleanup

```tsx
// src/providers/AuthProvider.tsx (actual code, simplified)
export const AuthProvider = ({ children }: PropsWithChildren) => {
  const dispatch = useAppDispatch()
  const authListenerRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    const init = async () => {
      const sessionData = await getCurrentSession()
      dispatch(setInitialState(sessionData))

      authListenerRef.current = setupAuthListener(
        (authResponse) => {
          if (authResponse) dispatch(setCredentials(authResponse))
          else dispatch(logout())
        },
        (orgData) => {
          // Background fetch resolves, updating state without blocking UI/network
          dispatch(setOrganisationsAndRole(orgData))
          dispatch(setProfileLoading(false))
        }
      )
    }
    init()
    return () => authListenerRef.current?.()
  }, [dispatch])

  return children  // No Context wrapper
}
```

---

## Auth Service Layer

**File**: `src/services/auth.ts`

Standalone exported functions (not a class):

| Function | Purpose |
|----------|---------|
| `login(credentials)` | Sign in with email/password via Supabase, fetches user orgs |
| `signInWithGoogle()` | Native Google sign-in, then `signInWithIdToken`; null when the user cancels. See [Google sign-in](#google-sign-in) |
| `register(credentials)` | Create account, handles email confirmation flow |
| `logout()` | Sign out of this phone, offline too; see [Offline](#offline). Called through `useSupabaseAuth().logout`, which then clears the Redux state |
| `getCurrentSession()` | Get existing session, transforms to `AuthResponse`; offline, falls back to the stored session |
| `setupAuthListener(callback, onProfileData)` | Subscribes to `onAuthStateChange`, fires fast UI-unblocking callback, and triggers deduplicated background profile fetch. Opens from the stored session at once; see [Offline](#offline) |
| `readStoredSession()`, `getStoredUserId()` | The session auth-js keeps on disk, read without asking auth-js to refresh it; the user id for local reads |
| `ensureValidSession()` | Refreshes an expired token if it can; true once the session may go to the server (the reconnect sync) |
| `resetPassword(email)` | Send password reset email |
| `updatePassword(newPassword)` | Update password (active session required) |
| `updatePasswordWithToken(token, password, refreshToken?)` | Reset password using deep link token |
| `fetchUserOrganisations(userId)` | The user's organisations and roles from `user_roles` and `organisations`; from the local tables when the cloud cannot be reached (#332) |
| `transformSupabaseUser(user, session)` | Convert Supabase `User` → app `AuthResponse` with org data |
| `getCurrentUser()` | Get current Supabase user |

### RTK Query Integration

Login, Google sign-in and register are exposed as RTK Query mutations in `src/redux/api/auth/index.ts`:

```tsx
// These call the standalone functions from auth.ts
export const { useLoginMutation, useGoogleSignInMutation, useRegisterMutation } = authApi
```

Screens use these hooks for loading/error state management, then dispatch `setCredentials()` on success.

---

## Redux Auth State

**File**: `src/redux/slices/authSlice.ts`

### Types

```tsx
type UserRole = "ww_admin" | "project_admin" | "project_member"

interface User {
  id: string
  email: string
  role: UserRole
  organisation_id: string | null
  profile?: UserProfile          // first_name, last_name, avatar_url
  organisations?: UserOrganisation[]  // id, name, role
}

interface AuthResponse {
  jwt: string
  user: User
  refresh_token?: string
  isPendingConfirmation?: boolean
}

type AuthState = {
  token?: string
  refreshToken?: string
  user?: User
  currentOrganisation?: UserOrganisation
  permissions: UserPermissions   // 10 boolean permission flags
  loading: boolean
  profileLoading: boolean        // tracks async background organisation fetching
  initialLoad: boolean           // true until first session check completes
  sessionPersisted: boolean
  error?: string
}
```

### Permission System

`calculatePermissions(role)` maps each role to 10 permission flags:

| Permission | `ww_admin` | `project_admin` | `project_member` |
|-----------|:-:|:-:|:-:|
| `canManageUsers` | ✅ | ❌ | ❌ |
| `canAccessAllOrganisations` | ✅ | ❌ | ❌ |
| `canCreateProjects` | ✅ | ✅ | ❌ |
| `canManageProjects` | ✅ | ✅ | ❌ |
| `canDeleteProjects` | ✅ | ✅ | ❌ |
| `canViewProjects` | ✅ | ✅ | ✅ |
| `canManageDeployments` | ✅ | ✅ | ✅ |
| `canViewDeployments` | ✅ | ✅ | ✅ |
| `canManageDevices` | ✅ | ✅ | ❌ |
| `canViewDevices` | ✅ | ✅ | ✅ |

### Actions

| Action | Effect |
|--------|--------|
| `setCredentials(authResponse)` | Sets token, user, permissions, current org; persists to storage |
| `setOrganisationsAndRole(data)`| Merges background fetched profile configurations gracefully |
| `logout()` | Clears all state, resets permissions to empty, clears storage |
| `setInitialState(authResponse \| null)` | First load — sets state without triggering persistence writes |
| `setCurrentOrganisation(orgId)` | Switches active org, recalculates permissions based on org role, and sets `user.organisation_id` so a token refresh keeps it |
| `updateUserProfile(profile)` | Updates profile fields and re-persists |

### Selectors

`selectCurrentUser`, `selectUserPermissions`, `selectCurrentOrganisation`, `selectIsAuthenticated`, `selectIsProjectAdmin`

---

## Supabase Client

**File**: `src/services/supabase.ts`

Uses a **factory pattern** with dynamic environment switching:

```tsx
// Initialize (called once at app startup by providers)
const client = await initializeSupabaseClient()

// Use anywhere
const client = getSupabaseClient()

// Switch environment (settings screen)
await reconnectSupabase()
```

Configuration:
- **Storage**: `AsyncStorage` (session persistence)
- **Auto refresh**: enabled; paused while NetInfo reports no connection and resumed on reconnect (`AppSetupProvider`)
- **Detect session in URL**: disabled (mobile app)
- **Fetch**: `createTimeoutFetch()` from `supabaseFetch.ts`, a 30 s limit on auth and PostgREST reads. Writes, RPCs, storage and edge functions are exempt
- **Legacy compat**: `supabase` export uses a `Proxy` with deprecation warnings

---

## Offline

The field is offline more often than not, so a signed-in user stays signed in until the **server** rejects the session (#310).

- **The app opens from the stored session.** `setupAuthListener` reads the session auth-js keeps on disk and signs in from it at once, without waiting for `INITIAL_SESSION`. auth-js refreshes an expired token before it announces anything, about 26 s of retries per attempt without a network, and the app used to sit on a spinner for 75 s and then show Login.
- **A missing session is not a sign-out.** When `INITIAL_SESSION` (or any event but `SIGNED_OUT`) comes without a session but the stored one is still on disk, the refresh could not reach the server: auth-js removes the stored session only when the server rejects it. The app stays signed in and auth-js renews the token when the network returns (`TOKEN_REFRESHED`). `SIGNED_OUT`, or nothing stored, signs out as before.
- **Local reads never ask auth-js.** `ProjectService` takes the user from `getStoredUserId()`: `getSession()` would refresh an expired token first, and offline that is half a minute and then no user.
- **Nothing is written with a token the server would refuse.** Supabase calls get their token from `getSession()`, which never returns an expired one, and the sync checks the user with the server (`getUser`) before it uploads. The reconnect sync also waits for `ensureValidSession()`. The Redux `token` can hold the expired one while offline, and nothing writes with it.
- **Organisations come from the local database first** (#332): the tables the last sync left, then the cloud's answer when it arrives. An empty cloud answer is kept. The organisation the user last had open is remembered per user (`currentOrganisation:<userId>` in AsyncStorage) and reopened while the roles still allow it.
- **Signing out needs no network** (#360). auth-js's `signOut` asks the server first and keeps the stored session when it cannot be reached, and the app opens from the stored session, so the next launch signed the same account back in. `logout()` removes the stored session itself, then lets `signOut` clear the rest and announce `SIGNED_OUT` without waiting for it, since it can sit behind a token refresh. When there is a connection it also asks the server to end the session, `local` scope: this phone only, not the website or another phone. Every Sign out goes through `useSupabaseAuth().logout`.
- **Network failures are not errors.** Offline, a failed Supabase call is logged with `log`, not `logError`, and supabase-js's own `console.error` for each failed fetch goes to `console.log` (`installNetworkErrorFilter`, installed in `index.js`). The "Offline Mode" banner is the only sign in the UI.

---

## Deep Linking

### Configuration (`src/navigation/linking.ts`)

```tsx
prefixes: [prefix, "wildlifewatcher://", "com.wildlife.wildlifewatcher://", ...]
config: {
  screens: {
    Login: "auth/callback",
    ForgotPassword: "auth/reset-password",
    Register: "auth/confirm",
    Home: "",
  }
}
```

The `getStateFromPath` override defers auth routes to `useDeepLinking` to avoid navigation conflicts.

### Handler (`src/hooks/useDeepLinking.ts`)

Handles two auth deep link flows:

1. **Password reset** (`auth/reset-password`) — Parses both query params and URL fragment params (Supabase uses `#` for tokens), navigates to `ForgotPassword` with `{ token, refreshToken, mode: "reset" }`
2. **Email confirmation** (`auth/callback`) — Navigates to `Login` with `{ confirmed: true }`

```tsx
// Supports multiple token formats
const token = allParams.access_token || allParams.token_hash || allParams.token
```

---

## Auth Screens

All screens use `WWScreenView`, React Hook Form (`useForm`), and `Field`/`WWTextInput` form components.

### LoginScreen
- RTK Query: `useLoginMutation()` → dispatches `setCredentials` on success
- **Remember me**: persists email to `expo-secure-store`
- Navigates to `Register` and `ForgotPassword`
- **Continue with Google** below Login, when configured; see [Google sign-in](#google-sign-in)

### RegisterScreen
- RTK Query: `useRegisterMutation()` with fields: name, email, organization (optional), password, confirm
- **Email confirmation**: checks `response.isPendingConfirmation` → shows alert directing to email, navigates to Login
- Otherwise dispatches `setCredentials` for immediate login
- **Continue with Google** below Register, the same button as on Login

### ForgotPasswordScreen
- **Dual mode** based on `route.params`:
  - **Request mode** (default): calls `resetPassword(email)` → shows "check email" alert
  - **Reset mode** (has `token` param from deep link): shows password + confirm fields, calls `updatePasswordWithToken()`, then `getCurrentSession()` → `setCredentials`

---

## Google sign-in

Native sign-in ([#350](https://github.com/wildlifeai/ww-mobile-app/issues/350)) with
`@react-native-google-signin/google-signin`: Google's own sheet gives an ID token, and
`supabase.auth.signInWithIdToken({ provider: 'google', token })` turns it into a Supabase
session. `signInWithGoogle()` then returns the same `AuthResponse` as
`login()`, and `GoogleSignInButton` dispatches `triggerTutorial` and `setCredentials` as
LoginScreen does, so organisations, the tutorial and the sync follow exactly as for a password
sign-in. The server side (the provider, the `users` row, the General organisation, linking to
an existing account with the same email) is described in #350.

| Case | What the user sees |
|------|--------------------|
| No `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`, or on iOS no `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` | No button |
| The binary was built without the library (an older dev client) | "not set up in this version of the app". The library looks up its native module as it loads, so `auth.ts` requires it at the tap instead of importing it, which would crash such a build at launch |
| Offline (`isKnownOffline()`) | "No connection", like the app's other server-only actions, and Google's sheet does not open |
| Supabase unreachable after Google's sheet | "No connection" too |
| The user closes Google's sheet | Nothing |
| Google Play services missing or out of date (Android) | Google's update dialog where it can, then a message to update or sign in with email |
| Supabase refuses the token | "The server did not accept the Google sign-in", with Supabase's reason |

After each attempt the app signs out of Google's own session (`GoogleSignin.signOut()`), so
the next tap offers the account picker again. The Supabase session is the only one the app
keeps.

**No password.** A Google-only account has none, and nothing in the app needs one: Forgot
Password and the Profile screen's Reset Password both send a recovery email, and its link lets
the user set a password.

**iOS nonce, undecided.** Supabase checks the ID token's nonce on iOS unless *Skip nonce
checks* is on for its Google provider. Version 16.1.5 of the library takes no nonce in its free
API (`ConfigureParams`, `SignInParams`), so iOS needs either that switch, or a nonce passed
through both calls with a different sign-in API. Android is unaffected.

### Setup

Nothing works until all of this is done, and the last step is a new build: the library is
native code, so a JS reload on an existing dev client is not enough.

1. **Android OAuth clients**, in the Google Cloud project that holds the web client. One client
   takes one package name and one SHA-1, so create one per package and signing key:
   - `com.wildlife.wildlifewatcher` with the EAS keystore's SHA-1 (`eas credentials -p android`)
     and the Play App Signing key's SHA-1 (Play Console, App integrity, App signing).
   - `com.wildlife.wildlifewatcher.expo`, the debug package, with the SHA-1 of each key that
     signs it: the EAS keystore for EAS `development` builds, and `android/app/debug.keystore`
     for local ones (`keytool -list -v -keystore android/app/debug.keystore -alias
     androiddebugkey -storepass android`).
2. **iOS OAuth clients**, for the bundle IDs `com.wildlife.wildlifewatcher` and
   `com.wildlife.wildlifewatcher.expo` (`APP_VARIANT=development`). Each client's reversed ID,
   `com.googleusercontent.apps.<id>`, is that build's URL scheme.
3. **Supabase, on dev and staging**: Authentication, Sign In / Providers, Google, *Client IDs*.
   Keep the web client ID first and add the Android and iOS client IDs after it,
   comma-separated. Decide the iOS nonce there too (above).
4. **Environment variables**, in `.env.development` (or `.env.local`) and in each EAS
   environment that builds the app, as plain text: the IDs are not secret, and an
   `EXPO_PUBLIC_` variable cannot be a secret ([Expo-EAS-Guide.md](Expo-EAS-Guide.md#environment-variables)).
   The three are in [.env.example](../../.env.example):
   - `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`, the web client. Unset, the button is hidden.
   - `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID`, the iOS client matching the build's bundle ID.
   - `GOOGLE_IOS_URL_SCHEME`, that client's reversed ID. Build time only: `app.config.ts`
     registers the library's config plugin only when it is set, because the plugin throws
     without it.
5. **A new dev client**: `npm run android` locally, or an EAS `development` build. Test on dev
   first. While Google's consent screen is in *Testing*, only its listed test users can sign in.

---

## Troubleshooting

### Deep links not working
- Must use **Development Client** (not Expo Go) — Expo Go doesn't support custom URL schemes
- Verify the `scheme` field in `app.config.ts` matches `wildlifewatcher://`
- Test: `adb shell am start -W -a android.intent.action.VIEW -d "wildlifewatcher://auth/reset-password?token_hash=test&type=recovery" com.wildlife.wildlifewatcher`

### Session not persisting
- Verify `AsyncStorage` is properly installed (it's the storage backend for Supabase auth)
- Check that `initializeSupabaseClient()` was called before any auth operations
- The `getSupabaseClient()` call will throw if the client isn't initialized

### Auth state not updating navigation
- Check that `AuthProvider` is in the provider hierarchy (it must wrap `MainNavigation`)
- Verify the `setupAuthListener` callback is dispatching correctly
- The navigation gate reads `state.authentication.token` — if it's `undefined`, auth screens show

---

**Last Updated**: 2026-10-01