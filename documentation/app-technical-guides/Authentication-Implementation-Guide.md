# Authentication Implementation Guide

## Overview

This guide documents the complete authentication system implementation for the Wildlife Watcher mobile app, including Supabase integration, deep linking, and React Navigation configuration.

## Architecture

### Authentication Flow

```
App Start → AuthProvider → Supabase Session Check
    ↓
Session Exists? → Dispatch setCredentials (Redux) → Main App
    ↓
Session Missing? → Clear Redux State → Auth Stack
```

### Provider Hierarchy

The authentication system is integrated into the app's provider hierarchy:

```tsx
SafeAreaProvider → ReduxProvider → PaperProvider → NavigationContainer
→ AndroidPermissionsProvider → AppSetupProvider → BleEngineProvider
→ ListenToBleEngineProvider → AuthProvider → MainNavigation
```

## Core Components

### 1. AuthProvider (`src/providers/AuthProvider.tsx`)

**Purpose**: Manages authentication state and provides auth context to the entire app.

**Key Features**:
- Session management with Supabase
- Automatic session restoration on app start
- Deep link handling for auth flows
- Loading states and error handling

**Implementation**:
```tsx
export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
        setLoading(false);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{ session, loading }}>
      {children}
    </AuthContext.Provider>
  );
};
```

### 2. Navigation Structure (`src/navigation/index.tsx`)

**Conditional Navigation**: Based on authentication state, the app renders either:
- **AuthStack**: Login, Register, Forgot Password screens
- **MainNavigation**: Primary app functionality (requires authentication)

**Implementation**:
```tsx
export default function Navigation() {
  const { session, loading } = useAuth();

  if (loading) {
    return <LoadingScreen />;
  }

  return (
    <NavigationContainer linking={linking}>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {session ? (
          <Stack.Screen name="Main" component={MainNavigation} />
        ) : (
          <>
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen name="Register" component={RegisterScreen} />
            <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
```

### 3. Deep Linking Integration

**Configuration** (`src/navigation/linking.ts`):
```tsx
const linking: LinkingOptions<RootStackParamList> = {
  prefixes: ['wildlifewatcher://'],
  config: {
    screens: {
      Login: 'login',
      Register: 'register', 
      ForgotPassword: 'forgot-password',
      Main: {
        screens: {
          Home: 'home',
          Projects: 'projects',
          Devices: 'devices',
          Profile: 'profile',
        },
      },
    },
  },
};
```

**Deep Link Handler** (`src/hooks/useDeepLinking.ts`):
```tsx
export const useDeepLinking = () => {
  useEffect(() => {
    const handleDeepLink = (url: string) => {
      if (url.includes('forgot-password')) {
        // Handle password reset deep links
        const urlObj = new URL(url);
        const accessToken = urlObj.searchParams.get('access_token');
        const refreshToken = urlObj.searchParams.get('refresh_token');
        
        if (accessToken && refreshToken) {
          supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
        }
      }
    };

    const subscription = Linking.addEventListener('url', ({ url }) => {
      handleDeepLink(url);
    });

    // Handle app launch from deep link
    Linking.getInitialURL().then((url) => {
      if (url) {
        handleDeepLink(url);
      }
    });

    return () => subscription?.remove();
  }, []);
};
```

## Supabase Configuration

### 1. Client Setup (`src/services/supabase.ts`)

```tsx
import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import { Database } from '../types/supabase';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false, // Important for mobile apps
  },
});
```

### 2. Environment Variables

Required in `.env`:
```
EXPO_PUBLIC_SUPABASE_URL=your_supabase_project_url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### 3. Database Schema Requirements

The authentication system expects these Supabase configurations:

**User Profiles Table**:
```sql
create table profiles (
  id uuid references auth.users on delete cascade not null primary key,
  email text,
  first_name text,
  last_name text,
  avatar_url text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS
alter table profiles enable row level security;

-- Create policies
create policy "Public profiles are viewable by everyone." on profiles
  for select using (true);

create policy "Users can insert their own profile." on profiles
  for insert with check (auth.uid() = id);

create policy "Users can update own profile." on profiles
  for update using (auth.uid() = id);
```

## Screen Implementations

### 1. Login Screen (`src/navigation/screens/Login.tsx`)

**Key Features**:
- Email/password authentication
- Form validation with React Hook Form
- Loading states and error handling
- Navigation to Register and Forgot Password

**Implementation Highlights**:
```tsx
const onSubmit = async (data: LoginFormData) => {
  setLoading(true);
  setError(null);
  
  const { error } = await supabase.auth.signInWithPassword({
    email: data.email,
    password: data.password,
  });
  
  if (error) {
    setError(error.message);
  }
  
  setLoading(false);
};
```

### 2. Register Screen (`src/navigation/screens/Register.tsx`)

**Key Features**:
- User account creation
- Profile data collection (first name, last name)
- Password confirmation validation
- Automatic sign-in after successful registration

**Implementation Highlights**:
```tsx
const onSubmit = async (data: RegisterFormData) => {
  setLoading(true);
  setError(null);
  
  const { data: authData, error } = await supabase.auth.signUp({
    email: data.email,
    password: data.password,
    options: {
      data: {
        first_name: data.firstName,
        last_name: data.lastName,
      },
    },
  });
  
  if (error) {
    setError(error.message);
  } else if (authData.user) {
    // User created successfully
    // Profile will be created automatically via database triggers
  }
  
  setLoading(false);
};
```

### 3. Forgot Password Screen (`src/navigation/screens/ForgotPassword.tsx`)

**Key Features**:
- Password reset email sending
- Deep link handling for reset flow
- User feedback and status messages

**Implementation Highlights**:
```tsx
const handleResetPassword = async (data: ForgotPasswordFormData) => {
  setLoading(true);
  setMessage(null);
  setError(null);
  
  const { error } = await supabase.auth.resetPasswordForEmail(
    data.email,
    {
      redirectTo: 'wildlifewatcher://forgot-password',
    }
  );
  
  if (error) {
    setError(error.message);
  } else {
    setMessage('Check your email for a password reset link!');
  }
  
  setLoading(false);
};
```

## Authentication Service Layer

### Core Service (`src/services/auth.ts`)

```tsx
export class AuthService {
  static async signIn(email: string, password: string) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    
    if (error) throw error;
    return data;
  }
  
  static async signUp(email: string, password: string, metadata?: any) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: metadata,
      },
    });
    
    if (error) throw error;
    return data;
  }
  
  static async signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  }
  
  static async resetPassword(email: string, redirectTo?: string) {
    const { error } = await supabase.auth.resetPasswordForEmail(
      email,
      { redirectTo }
    );
    
    if (error) throw error;
  }
  
  static async updatePassword(password: string) {
    const { error } = await supabase.auth.updateUser({
      password,
    });
    
    if (error) throw error;
  }
}
```

## Redux Integration

### Auth Types (`src/redux/api/auth/types.ts`)

```tsx
export type User = {
  id: string;
  email: string;
  first_name?: string;
  last_name?: string;
  avatar_url?: string;
};

export type AuthState = {
  user: User | null;
  session: Session | null;
  loading: boolean;
  error: string | null;
};
```

### Auth Slice Integration

The app uses Redux to manage global user state, permissions, and organization context. The `AuthProvider` syncs Supabase session changes to the Redux store.

```typescript
// src/redux/slices/authSlice.ts
export const authSlice = createSlice({
  name: "authentication",
  initialState,
  reducers: {
    setCredentials: (state, action) => {
      state.user = action.payload.user;
      state.token = action.payload.jwt;
      state.permissions = calculatePermissions(action.payload.user.role);
    },
    // ...
  }
});
```

## Common Pitfalls and Solutions

### 1. Expo Go vs Development Client

**Problem**: Deep linking doesn't work properly in Expo Go.

**Solution**: Use Expo Development Client for testing authentication flows:
```bash
# Create development build
npx expo run:android --variant debug
```

**Why**: Expo Go has limitations with custom URL schemes and native modules.

### 2. Session Persistence

**Problem**: User session not persisting across app restarts.

**Solution**: Ensure proper Supabase client configuration:
```tsx
export const supabase = createClient(url, key, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false, // Important for mobile
  },
});
```

### 3. Navigation State Issues

**Problem**: Navigation stack getting confused during auth state changes.

**Solution**: Use conditional rendering based on auth state:
```tsx
// Don't use navigation.navigate() for auth transitions
// Let the conditional rendering handle navigation changes
{session ? <MainNavigation /> : <AuthStack />}
```

### 4. Deep Link URL Parsing

**Problem**: URLs with special characters causing parsing issues.

**Solution**: Proper URL parsing and validation:
```tsx
const handleDeepLink = (url: string) => {
  try {
    const urlObj = new URL(url);
    const token = urlObj.searchParams.get('access_token');
    // Process token...
  } catch (error) {
    console.error('Invalid URL:', error);
  }
};
```

## Testing Strategies

### 1. Authentication Flow Testing

**Manual Testing Checklist**:
- [ ] Sign up with valid email/password
- [ ] Sign in with correct credentials
- [ ] Sign in with incorrect credentials
- [ ] Password reset email flow
- [ ] Deep link password reset
- [ ] Session persistence after app restart
- [ ] Sign out functionality

### 2. Deep Link Testing

**Testing Commands**:
```bash
# Test deep links on Android
adb shell am start \
  -W -a android.intent.action.VIEW \
  -d "wildlifewatcher://forgot-password?access_token=test&refresh_token=test" \
  com.wildlife.wildlifewatcher

# Test on iOS Simulator
xcrun simctl openurl booted "wildlifewatcher://forgot-password"
```

### 3. Integration Testing

**Key Areas**:
- Auth state changes triggering navigation updates
- Profile creation on successful registration
- Session token refresh handling
- Error boundary handling for auth failures

## Performance Considerations

### 1. Authentication State Loading

**Optimization**: Show appropriate loading states during auth checks:
```tsx
if (loading) {
  return <SplashScreen />;
}
```

### 2. Session Refresh

**Automatic Handling**: Supabase handles token refresh automatically, but ensure UI doesn't block:
```tsx
supabase.auth.onAuthStateChange((event, session) => {
  if (event === 'TOKEN_REFRESHED') {
    // Handle refresh without blocking UI
    console.log('Token refreshed');
  }
});
```

### 3. Memory Management

**Context Cleanup**: Ensure auth listeners are properly cleaned up:
```tsx
useEffect(() => {
  const { data: { subscription } } = supabase.auth.onAuthStateChange(handler);
  
  return () => subscription.unsubscribe(); // Important cleanup
}, []);
```

## Security Best Practices

### 1. Environment Variables

- Never commit API keys to repository
- Use different keys for development/production
- Validate environment variables on app start

### 2. Session Management

- Enable automatic token refresh
- Implement proper session timeout handling
- Clear sensitive data on logout

### 3. Deep Link Validation

- Validate all URL parameters
- Implement proper error boundaries
- Log security-relevant events

## Troubleshooting Guide

### Common Issues

**1. "Invalid login credentials" on valid credentials**
- Check Supabase project settings
- Verify email confirmation requirements
- Check user table policies

**2. Deep links not working**
- Verify URL scheme in app.config.js
- Test with Development Client (not Expo Go)
- Check Android intent filters

**3. Session not persisting**
- Verify AsyncStorage permissions
- Check Supabase client configuration
- Review auth state change handlers

**4. Navigation issues during auth changes**
- Use conditional rendering instead of navigation.navigate()
- Ensure proper loading states
- Check navigation stack configuration

### Debug Commands

```bash
# Check deep link registration
adb shell pm query-services | grep wildlife

# Monitor auth state changes
# Add logging to auth state change handler

# Check AsyncStorage
# Use React Native Debugger or Flipper
```

## Next Steps and Improvements

### Planned Enhancements

1. **Biometric Authentication**: Add fingerprint/face recognition
2. **Social Login**: Google, Apple, Facebook authentication
3. **Multi-factor Authentication**: SMS or authenticator app
4. **Session Analytics**: Track auth events and user behavior
5. **Offline Auth**: Handle authentication state during network outages

### Code Quality Improvements

1. **Unit Tests**: Add comprehensive test coverage for auth flows
2. **Integration Tests**: Automated testing of complete auth workflows
3. **Performance Monitoring**: Track auth-related performance metrics
4. **Error Tracking**: Implement proper error reporting and analytics

---

This authentication system provides a solid foundation for the Wildlife Watcher app with proper security, user experience, and maintainability considerations.