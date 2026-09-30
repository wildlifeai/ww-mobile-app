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
| `src/services/auth.ts` | Supabase auth functions (login, register, logout, password reset, org fetching) |
| `src/services/supabase.ts` | Supabase client factory with environment switching |
| `src/redux/slices/authSlice.ts` | Auth state, types, roles, permissions, org management |
| `src/redux/api/auth/index.ts` | RTK Query mutations (`useLoginMutation`, `useRegisterMutation`) |
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
| `register(credentials)` | Create account, handles email confirmation flow |
| `logout()` | Sign out from Supabase |
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

Login and register are exposed as RTK Query mutations in `src/redux/api/auth/index.ts`:

```tsx
// These call the standalone functions from auth.ts
export const { useLoginMutation, useRegisterMutation } = authApi
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

`selectCurrentUser`, `selectUserPermissions`, `selectCurrentOrganisation`, `selectIsAuthenticated`, `selectIsWWAdmin`, `selectIsProjectAdmin`, `selectCanManageUsers`

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

### RegisterScreen
- RTK Query: `useRegisterMutation()` with fields: name, email, organization (optional), password, confirm
- **Email confirmation**: checks `response.isPendingConfirmation` → shows alert directing to email, navigates to Login
- Otherwise dispatches `setCredentials` for immediate login

### ForgotPasswordScreen
- **Dual mode** based on `route.params`:
  - **Request mode** (default): calls `resetPassword(email)` → shows "check email" alert
  - **Reset mode** (has `token` param from deep link): shows password + confirm fields, calls `updatePasswordWithToken()`, then `getCurrentSession()` → `setCredentials`

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

**Last Updated**: 2026-03-26