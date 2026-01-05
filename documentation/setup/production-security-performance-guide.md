# Production Security & Performance Guide
**Wildlife Watcher Mobile App - React Native + Expo + Supabase**

*Research Date: 2025-10-22*

---

## Table of Contents
1. [Performance Optimization](#performance-optimization)
2. [Security Best Practices](#security-best-practices)
3. [Build Optimization](#build-optimization)
4. [Monitoring & Error Tracking](#monitoring--error-tracking)
5. [Production Readiness Checklist](#production-readiness-checklist)

---

## Performance Optimization

### Bundle Size Optimization

#### Expo/Metro Bundle Optimization
```javascript
// metro.config.js - Enable production optimizations
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

config.transformer.getTransformOptions = async () => ({
  transform: {
    experimentalImportSupport: true,
    inlineRequires: true, // Lazy loading for faster startup
  },
});

config.transformer.minifierPath = 'metro-minify-terser';
config.transformer.minifierConfig = {
  compress: {
    // Enable safe optimizations
    unsafe: false, // Use true only after thorough testing
    unsafe_arrows: false,
    unsafe_comps: false,
    unsafe_Function: false,
    unsafe_math: false,
    unsafe_symbols: false,
    unsafe_methods: false,
    unsafe_proto: false,
    unsafe_regexp: false,
    unsafe_undefined: false,
    unused: true,
  },
};

module.exports = config;
```

**Key Practices:**
- **Remove console statements**: Production builds should strip all `console.log()`, `console.warn()`, etc.
- **Tree shaking**: Expo automatically performs tree shaking for ESM imports in production
- **Bundle analysis**: Use `npx expo export --source-maps` + `source-map-explorer` to analyze bundle size
- **Compression**: Hermes bytecode bundles compress ~2.6x with Brotli/Gzip

#### Platform-Specific Optimization
```javascript
// Conditional platform imports
import { Platform } from 'react-native';

if (Platform.OS === 'ios') {
  // iOS-only code - removed from Android bundle
}
```

**Evidence from Research:**
- Hermes engine provides ~2.6x compression ratio (10MB → 3.85MB)
- Web bundle splitting with async imports reduces initial load time
- `getItemLayout` for FlatList skips measurement, critical for large lists

### Hermes Engine Best Practices

**Configuration (app.json):**
```json
{
  "expo": {
    "jsEngine": "hermes",  // Default for SDK 51+
    "android": {
      "enableProguard": true
    },
    "ios": {
      "jsEngine": "hermes"  // Can override per platform
    }
  }
}
```

**Benefits:**
- Faster startup time (bytecode vs JS parsing)
- Reduced memory footprint
- Improved garbage collection

**Monitoring Hermes:**
```bash
# Check Hermes debugger availability
curl http://127.0.0.1:8081/json/list
```

### Memory Leak Prevention

#### Common Sources
1. **Event listeners not cleaned up**
2. **Timers/intervals not cleared**
3. **Subscriptions not unsubscribed**
4. **Circular references in closures**
5. **Large data retained in component state**

#### Prevention Patterns
```typescript
// ✅ CORRECT: Cleanup in useEffect
useEffect(() => {
  let subscription: any;
  let timer: any;
  let listener: any;

  const init = async () => {
    const client = getSupabaseClient();
    subscription = client
      .channel('realtime-updates')
      .on('postgres_changes', { event: '*', schema: 'public' }, handleChange)
      .subscribe();
  };

  init();
  timer = setInterval(syncOfflineQueue, 30000);
  listener = DeviceEventEmitter.addListener('event', handler);

  return () => {
    subscription?.unsubscribe();
    clearInterval(timer);
    listener?.remove();
  };
}, []);

// ✅ CORRECT: Memoize expensive computations
const processedData = useMemo(() => {
  return expensiveDataTransform(rawData);
}, [rawData]);

// ✅ CORRECT: Memoize callbacks
const handlePress = useCallback(() => {
  navigation.navigate('Details', { id });
}, [id, navigation]);
```

**Tools for Detection:**
- React DevTools (Memory tab)
- Chrome DevTools (Heap snapshots)
- Flipper (Memory inspector)
- Xcode Instruments (iOS)
- Android Studio Profiler

**Testing:**
```bash
# Run production mode locally to test
npx expo start --no-dev --minify
```

### Rendering Performance (FlatList, Re-renders)

#### FlatList Optimization
```typescript
// ✅ CRITICAL: Implement getItemLayout for fixed-height items
const ITEM_HEIGHT = 80;
const getItemLayout = (data: any, index: number) => ({
  length: ITEM_HEIGHT,
  offset: ITEM_HEIGHT * index,
  index,
});

// ✅ CORRECT: Optimize FlatList props
<FlatList
  data={deployments}
  renderItem={renderDeploymentItem}
  keyExtractor={item => item.id}
  // Performance props
  getItemLayout={getItemLayout}
  removeClippedSubviews={true}
  maxToRenderPerBatch={10}
  updateCellsBatchingPeriod={50}
  initialNumToRender={10}
  windowSize={21}
  // Memoization
  extraData={selectedId} // Only re-render when this changes
/>
```

**Performance Props Explained:**
- `removeClippedSubviews`: Detaches off-screen views (reduces main thread work)
- `maxToRenderPerBatch`: Items per render batch (10 = good balance)
- `updateCellsBatchingPeriod`: Delay between batches in ms (50ms default)
- `initialNumToRender`: Items on first render (match screen height)
- `windowSize`: Viewport height multiplier (21 = 10 screens above + 10 below + 1 visible)

#### Memoization Strategies
```typescript
// ✅ CORRECT: Memoize list item components
const DeploymentItem = React.memo(
  ({ deployment, onPress }: Props) => (
    <TouchableOpacity onPress={() => onPress(deployment.id)}>
      <Text>{deployment.location}</Text>
    </TouchableOpacity>
  ),
  (prevProps, nextProps) => {
    // Custom comparison - only re-render if deployment changed
    return prevProps.deployment.id === nextProps.deployment.id &&
           prevProps.deployment.updated_at === nextProps.deployment.updated_at;
  }
);

// ✅ CORRECT: Memoize renderItem
const renderItem = useCallback(({ item }: { item: Deployment }) => (
  <DeploymentItem deployment={item} onPress={handlePress} />
), [handlePress]);
```

**React.memo() vs useMemo vs useCallback:**
- `React.memo()`: Prevents component re-renders
- `useMemo()`: Caches computed values
- `useCallback()`: Caches function references

### Offline Data Caching Strategies

#### SQLite Query Optimization
```typescript
// ✅ CORRECT: Use indexes for frequently queried columns
await db.execAsync(`
  CREATE INDEX IF NOT EXISTS idx_deployments_user_id
  ON deployments(user_id);

  CREATE INDEX IF NOT EXISTS idx_deployments_status_created
  ON deployments(status, created_at);

  CREATE INDEX IF NOT EXISTS idx_sync_queue_status_retry
  ON sync_queue(status, retry_count);
`);

// ✅ CORRECT: Use transactions for batch operations
await db.withTransactionAsync(async () => {
  for (const deployment of pendingDeployments) {
    await db.runAsync(
      'INSERT INTO deployments (id, user_id, data) VALUES (?, ?, ?)',
      [deployment.id, deployment.user_id, JSON.stringify(deployment)]
    );
  }
});

// ✅ CORRECT: Use prepared statements
const stmt = await db.prepareAsync(
  'SELECT * FROM deployments WHERE user_id = ? AND status = ?'
);
const results = await stmt.executeAsync([userId, 'active']);
await stmt.finalizeAsync();
```

**Indexing Strategy for Wildlife Watcher:**
```sql
-- User data access
CREATE INDEX idx_deployments_user_created ON deployments(user_id, created_at DESC);
CREATE INDEX idx_cameras_deployment ON cameras(deployment_id);

-- Sync operations
CREATE INDEX idx_sync_queue_status ON sync_queue(status, created_at);
CREATE INDEX idx_sync_queue_entity ON sync_queue(entity_type, entity_id);

-- Search/filtering
CREATE INDEX idx_deployments_location ON deployments(location_name);
CREATE INDEX idx_cameras_status ON cameras(status, last_sync);
```

#### Cache Invalidation
```typescript
// ✅ CORRECT: Implement cache TTL
interface CachedData<T> {
  data: T;
  timestamp: number;
  ttl: number; // milliseconds
}

const getCachedData = async <T>(key: string): Promise<T | null> => {
  const cached = await AsyncStorage.getItem(key);
  if (!cached) return null;

  const { data, timestamp, ttl } = JSON.parse(cached) as CachedData<T>;

  if (Date.now() - timestamp > ttl) {
    await AsyncStorage.removeItem(key);
    return null;
  }

  return data;
};

// ✅ CORRECT: Invalidate on sync
const syncToSupabase = async () => {
  const syncedData = await performSync();

  // Invalidate related caches
  await AsyncStorage.multiRemove([
    'cache:deployments',
    'cache:cameras',
    'cache:sync_status'
  ]);

  return syncedData;
};
```

---

## Security Best Practices

### Secure Storage for Credentials

**CRITICAL: Never use AsyncStorage for sensitive data**

#### Recommended: expo-secure-store
```typescript
import * as SecureStore from 'expo-secure-store';

// ✅ CORRECT: Store authentication tokens
export const storeAuthToken = async (token: string) => {
  await SecureStore.setItemAsync('auth_token', token, {
    keychainAccessible: SecureStore.WHEN_UNLOCKED, // iOS only
  });
};

export const getAuthToken = async (): Promise<string | null> => {
  return await SecureStore.getItemAsync('auth_token');
};

// ✅ CORRECT: Store Supabase session
export const storeSession = async (session: Session) => {
  await SecureStore.setItemAsync('supabase_session', JSON.stringify(session));
};
```

**Platform Implementation:**
- **iOS**: Uses Keychain Services (256-bit AES encryption)
- **Android**: Uses EncryptedSharedPreferences (AES-256 encryption)

**⚠️ Known Limitations:**
- Keychain is NOT cleared on app uninstall (iOS)
- Some memory leaks detected with expo-secure-store (Xcode profiler)

#### Alternative: react-native-encrypted-storage
```typescript
import EncryptedStorage from 'react-native-encrypted-storage';

// Store encrypted data
await EncryptedStorage.setItem('user_credentials', JSON.stringify({
  username: 'user@example.com',
  password: 'encrypted_password_hash'
}));

// Retrieve encrypted data
const credentials = await EncryptedStorage.getItem('user_credentials');
```

### API Key Management in Expo

// ⚠️ DEPRECATED: Standard app.config.js for static variables
// MODERN: Use app.config.ts + src/config/environments.ts

// Accessing settings in feature code:
import { getEnvironmentConfig } from "../config/EnvironmentManager";

const config = await getEnvironmentConfig();
const supabaseUrl = config.supabaseUrl;

**Environment Files:**
```bash
# .env.local (gitignored)
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
GOOGLE_MAPS_API_KEY_ANDROID=your-android-key
GOOGLE_MAPS_API_KEY_IOS=your-ios-key

# .env.production
EXPO_PUBLIC_SUPABASE_URL=https://prod-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=prod-anon-key

# .env.staging
EXPO_PUBLIC_SUPABASE_URL=https://staging-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=staging-anon-key
```

**Accessing Env Config (New Pattern):**
```typescript
import { getEnvironmentConfig } from "../config/EnvironmentManager";

// Type-safe access
const config = await getEnvironmentConfig();
const { supabaseUrl, supabaseAnonKey } = config;
```

### RLS Policy Patterns in Supabase

**CRITICAL: All tables MUST have RLS enabled for production**

#### User-Owned Data Pattern
```sql
-- Enable RLS
ALTER TABLE deployments ENABLE ROW LEVEL SECURITY;

-- ✅ CORRECT: Users can only access their own deployments
CREATE POLICY "Users can view their own deployments"
ON deployments
FOR SELECT
TO authenticated
USING (user_id = (SELECT auth.uid()));

-- ✅ CORRECT: Users can insert their own deployments
CREATE POLICY "Users can create deployments"
ON deployments
FOR INSERT
TO authenticated
WITH CHECK (user_id = (SELECT auth.uid()));

-- ✅ CORRECT: Users can update their own deployments
CREATE POLICY "Users can update own deployments"
ON deployments
FOR UPDATE
TO authenticated
USING (user_id = (SELECT auth.uid()))
WITH CHECK (user_id = (SELECT auth.uid()));
```

#### Organization Multi-Tenancy Pattern
```sql
-- ✅ CORRECT: Team-based access with performance optimization
CREATE POLICY "Users can access org data"
ON deployments
FOR SELECT
TO authenticated
USING (
  organisation_id IN (
    SELECT organisation_id
    FROM organisation_members
    WHERE user_id = (SELECT auth.uid())
  )
);

-- ✅ CRITICAL: Add indexes for RLS performance
CREATE INDEX idx_org_members_user_org
ON organisation_members(user_id, organisation_id);

CREATE INDEX idx_deployments_org
ON deployments(organisation_id);
```

#### Role-Based Access Pattern (Wildlife Watcher)
```sql
-- ✅ CORRECT: Check user role from JWT app_metadata
CREATE POLICY "Admins have full access"
ON deployments
FOR ALL
TO authenticated
USING (
  -- Extract role from JWT app_metadata
  (SELECT auth.jwt() -> 'app_metadata' ->> 'role') = 'ww_admin'
);

-- ✅ CORRECT: Project-specific access
CREATE POLICY "Project members can view deployments"
ON deployments
FOR SELECT
TO authenticated
USING (
  project_id IN (
    SELECT project_id
    FROM project_members
    WHERE user_id = (SELECT auth.uid())
  )
);
```

#### Performance-Optimized RLS Patterns
```sql
-- ✅ CORRECT: Wrap auth.uid() in SELECT for caching
CREATE POLICY "Optimized user data access"
ON deployments
FOR SELECT
TO authenticated
USING ((SELECT auth.uid()) = user_id);

-- ❌ WRONG: Direct function call (called per row)
CREATE POLICY "Slow user data access"
ON deployments
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- ✅ CORRECT: Use security definer function for complex checks
CREATE FUNCTION private.user_can_access_deployment(deployment_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER -- Runs with creator's privileges, bypasses RLS on helper tables
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM project_members pm
    JOIN deployments d ON d.project_id = pm.project_id
    WHERE pm.user_id = auth.uid()
    AND d.id = deployment_id
  );
END;
$$;

CREATE POLICY "Access via security definer"
ON deployments
FOR SELECT
TO authenticated
USING (private.user_can_access_deployment(id));
```

**RLS Performance Best Practices:**
1. **Always specify roles**: Use `TO authenticated` to prevent RLS evaluation for `anon` users
2. **Add indexes**: Index ALL columns used in RLS policies
3. **Wrap functions**: `(SELECT auth.uid())` instead of `auth.uid()`
4. **Use security definer**: For complex multi-table checks
5. **Always add filters**: Never run `SELECT *` without WHERE clauses

### Certificate Pinning Considerations

**⚠️ Decision Point: Certificate Pinning for Supabase**

**Pros:**
- Prevents MITM attacks by ensuring app only trusts specific certificates
- Additional security layer for API communications

**Cons:**
- Supabase certificates rotate regularly
- Requires app updates when certificates change
- Can cause app breakage if not managed carefully
- Expo/EAS builds make this more complex

**Recommendation for Wildlife Watcher:**
- **SKIP** certificate pinning for Supabase (they manage certificates)
- **IMPLEMENT** certificate pinning for custom backend APIs (if any)
- **RELY ON** HTTPS + proper RLS policies for Supabase security

**If Implementing Certificate Pinning:**
```typescript
// Using react-native-ssl-pinning (requires custom dev client)
import { fetch } from 'react-native-ssl-pinning';

const response = await fetch('https://api.wildlifewatcher.com/data', {
  method: 'GET',
  headers: {
    'Authorization': `Bearer ${token}`,
  },
  // Certificate hashes (Base64 encoded)
  sslPinning: {
    certs: [
      'sha256/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=',
      'sha256/BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB='
    ]
  }
});
```

### Offline Data Encryption

**Critical for Wildlife Watcher:** Camera deployment data may contain sensitive location information.

#### SQLCipher for SQLite Encryption
```typescript
// ✅ CORRECT: Use SQLCipher with react-native-sqlcipher-storage
import SQLCipher from 'react-native-sqlcipher-storage';

const db = await SQLCipher.openDatabase({
  name: 'wildlife_watcher.db',
  key: encryptionKey, // 256-bit AES key from secure storage
  location: 'default',
});

// All queries are automatically encrypted/decrypted
const deployments = await db.executeSql(
  'SELECT * FROM deployments WHERE user_id = ?',
  [userId]
);
```

**Key Management:**
```typescript
import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';

// Generate encryption key on first launch
const getOrCreateEncryptionKey = async (): Promise<string> => {
  let key = await SecureStore.getItemAsync('db_encryption_key');

  if (!key) {
    // Generate 256-bit key
    key = await Crypto.getRandomBytesAsync(32).then(bytes =>
      Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('')
    );
    await SecureStore.setItemAsync('db_encryption_key', key);
  }

  return key;
};
```

**⚠️ Important:**
- Key is stored in Keychain/EncryptedSharedPreferences
- If key is lost, database cannot be decrypted
- Consider key backup strategy for account recovery

### Authentication Token Handling

#### Supabase Session Management
```typescript
import { Session } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';

// ✅ CORRECT: Secure session persistence
export const persistSession = async (session: Session) => {
  await SecureStore.setItemAsync(
    'supabase_session',
    JSON.stringify(session)
  );
};

export const retrieveSession = async (): Promise<Session | null> => {
  const sessionJson = await SecureStore.getItemAsync('supabase_session');
  return sessionJson ? JSON.parse(sessionJson) : null;
};

// ✅ CORRECT: Auto-refresh token handling
supabase.auth.onAuthStateChange(async (event, session) => {
  if (event === 'TOKEN_REFRESHED') {
    await persistSession(session!);
  } else if (event === 'SIGNED_OUT') {
    await SecureStore.deleteItemAsync('supabase_session');
  }
});

// ✅ CORRECT: Initialize with stored session
const initializeAuth = async () => {
  const session = await retrieveSession();
  if (session) {
    await supabase.auth.setSession(session);
  }
};
```

#### Token Expiry & Refresh
```typescript
// ✅ CORRECT: Check token expiry before critical operations
const ensureValidSession = async (): Promise<boolean> => {
  const { data: { session }, error } = await supabase.auth.getSession();

  if (!session) {
    // Redirect to login
    return false;
  }

  // Check if token expires soon (within 5 minutes)
  const expiresAt = session.expires_at! * 1000; // Convert to ms
  const now = Date.now();
  const fiveMinutes = 5 * 60 * 1000;

  if (expiresAt - now < fiveMinutes) {
    // Refresh token proactively
    const { data: { session: newSession }, error: refreshError } =
      await supabase.auth.refreshSession();

    if (refreshError || !newSession) {
      return false;
    }

    await persistSession(newSession);
  }

  return true;
};
```

#### Network Request Interceptors
```typescript
// ✅ CORRECT: Add auth headers to all API requests
import axios from 'axios';

const apiClient = axios.create({
  baseURL: config.apiBaseUrl,
});

apiClient.interceptors.request.use(async (config) => {
  const session = await retrieveSession();
  if (session?.access_token) {
    config.headers.Authorization = `Bearer ${session.access_token}`;
  }
  return config;
});

// ✅ CORRECT: Handle 401 responses
apiClient.interceptors.response.use(
  response => response,
  async (error) => {
    if (error.response?.status === 401) {
      // Token expired, try refresh
      const { data: { session }, error: refreshError } =
        await supabase.auth.refreshSession();

      if (refreshError || !session) {
        // Redirect to login
        navigation.navigate('Login');
        return Promise.reject(error);
      }

      // Retry original request
      error.config.headers.Authorization = `Bearer ${session.access_token}`;
      return apiClient.request(error.config);
    }
    return Promise.reject(error);
  }
);
```

---

## Build Optimization

### OTA Update Strategies

**EAS Update Deployment Patterns:**

#### 1. Staging → Production Flow (Safest)
```bash
# Step 1: Deploy to staging
eas update --branch staging --message "New camera sync algorithm"

# Step 2: Test on staging builds
# Distribute via: eas build --profile staging --auto-submit

# Step 3: Promote tested update to production
eas update:republish --destination-channel production

# Step 4: Gradual rollout
eas update --channel production --rollout-percentage 10
eas update:edit # Increase rollout percentage
```

**Configuration (eas.json):**
```json
{
  "build": {
    "production": {
      "channel": "production",
      "distribution": "store"
    },
    "staging": {
      "channel": "staging",
      "distribution": "internal"
    },
    "preview": {
      "channel": "preview",
      "distribution": "internal"
    }
  }
}
```

#### 2. Gradual Rollout Strategy
```bash
# Start with 5% of users
eas update --channel production --rollout-percentage 5

# Monitor error rates/crash reports for 24-48 hours

# Increase to 25%
eas update:edit --rollout-percentage 25

# Monitor again

# Full rollout to 100%
eas update:edit --rollout-percentage 100
```

#### 3. Code Signing for Updates
```bash
# Generate code signing key pair
eas update:configure

# Set up code signing
eas update --branch production --message "Signed update" --auto
```

**Benefits:**
- Ensures updates are from trusted source
- Prevents man-in-the-middle update injection
- Required for compliance in some industries

### Bundle Splitting

**Expo Metro (SDK 50+) Automatic Splitting:**
```typescript
// index.tsx - Entry point
import '@expo/metro-runtime'; // Required for bundle splitting

// ✅ CORRECT: Async imports create separate chunks (web only)
const CameraSetupModule = React.lazy(() => import('./features/camera-setup'));
const DeploymentMapModule = React.lazy(() => import('./features/deployment-map'));

// ✅ CORRECT: Wrap in Suspense
<Suspense fallback={<LoadingScreen />}>
  <CameraSetupModule />
</Suspense>
```

**Manual Code Splitting (Advanced):**
```typescript
// ✅ CORRECT: Split by route
const CameraSetup = React.lazy(() =>
  import(/* webpackChunkName: "camera-setup" */ './screens/CameraSetup')
);

const DeploymentWizard = React.lazy(() =>
  import(/* webpackChunkName: "deployment" */ './screens/DeploymentWizard')
);

// ✅ CORRECT: Split large libraries
const loadMapLibrary = async () => {
  const mapLibrary = await import('react-native-maps');
  return mapLibrary;
};
```

**Limitations:**
- Bundle splitting works **only for web** in Expo
- Native apps use single bundle (Hermes bytecode)

### Asset Optimization

```bash
# ✅ CORRECT: Optimize images
npx expo-optimize --quality 90

# Manual optimization for specific assets
npx sharp-cli --input ./assets/images/ --output ./assets/optimized/ \
  --format webp --quality 85
```

**Image Optimization Best Practices:**
```typescript
// ✅ CORRECT: Use appropriate image formats
// - WebP for photos (better compression than JPEG)
// - PNG for icons/logos (transparency support)
// - SVG for vector graphics (scalable)

// ✅ CORRECT: Lazy load images
import { Image } from 'expo-image';

<Image
  source={{ uri: deployment.thumbnail }}
  placeholder={blurhash}
  contentFit="cover"
  transition={200}
/>

// ✅ CORRECT: Use caching
<Image
  source={{ uri: cameraImage }}
  cachePolicy="memory-disk"
/>
```

### Platform-Specific Optimizations

#### Android (ProGuard/R8)
```groovy
// android/app/build.gradle
android {
  buildTypes {
    release {
      minifyEnabled true
      shrinkResources true
      proguardFiles getDefaultProguardFile('proguard-android-optimize.txt'), 'proguard-rules.pro'
    }
  }
}
```

**ProGuard Rules (proguard-rules.pro):**
```proguard
# Keep Hermes
-keep class com.facebook.hermes.** { *; }

# Keep Supabase
-keep class io.supabase.** { *; }

# Keep React Native
-keep class com.facebook.react.** { *; }
```

#### iOS (Bitcode & App Thinning)
```json
// app.json
{
  "expo": {
    "ios": {
      "buildNumber": "1.0.0",
      "bitcode": false, // Deprecated in Xcode 14+
      "requireFullScreen": false
    }
  }
}
```

**iOS Optimization:**
- App Thinning: Automatically done by App Store Connect
- On-Demand Resources: Not directly supported in Expo
- Asset Catalogs: Expo manages automatically

---

## Monitoring & Error Tracking

### Crash Reporting Setup

**Recommended: Sentry for React Native**

```bash
# Install Sentry
npx expo install @sentry/react-native

# Configure with EAS
eas secret:create --scope project --name SENTRY_AUTH_TOKEN --value <your-token>
```

**Configuration:**
```typescript
// app/_layout.tsx or App.tsx
import * as Sentry from '@sentry/react-native';

Sentry.init({
  dsn: 'https://your-sentry-dsn@sentry.io/project-id',
  environment: __DEV__ ? 'development' : 'production',
  enableAutoSessionTracking: true,
  enableOutOfMemoryTracking: true,

  // Performance monitoring
  tracesSampleRate: 1.0, // 100% in production (adjust based on volume)

  // Filter sensitive data
  beforeSend(event, hint) {
    // Remove sensitive information
    if (event.request) {
      delete event.request.cookies;
      delete event.request.headers?.Authorization;
    }
    return event;
  },
});

// Wrap root component
const App = Sentry.wrap(AppContent);
```

**Custom Error Boundaries:**
```typescript
import * as Sentry from '@sentry/react-native';

class ErrorBoundary extends React.Component<Props, State> {
  static getDerivedStateFromError(error: Error) {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    Sentry.captureException(error, { contexts: { react: errorInfo } });
  }

  render() {
    if (this.state.hasError) {
      return <ErrorFallbackScreen />;
    }
    return this.props.children;
  }
}
```

### Performance Monitoring

**React Native Performance Profiler:**
```typescript
import { enableScreens } from 'react-native-screens';
import { Profiler } from 'react';

// Enable native screens for better performance
enableScreens();

// Profile component rendering
<Profiler id="DeploymentList" onRender={(id, phase, actualDuration) => {
  if (actualDuration > 16) { // 60fps = 16ms per frame
    console.warn(`Slow render: ${id} took ${actualDuration}ms`);
    Sentry.captureMessage(`Slow render: ${id}`, {
      level: 'warning',
      extra: { phase, actualDuration }
    });
  }
}}>
  <DeploymentList />
</Profiler>
```

**Custom Performance Metrics:**
```typescript
// Track critical user flows
const trackDeploymentCreation = async () => {
  const transaction = Sentry.startTransaction({
    name: 'Create Deployment',
    op: 'user.action',
  });

  try {
    const span1 = transaction.startChild({ op: 'camera.scan' });
    await scanForCameras();
    span1.finish();

    const span2 = transaction.startChild({ op: 'location.capture' });
    await captureLocation();
    span2.finish();

    const span3 = transaction.startChild({ op: 'deployment.save' });
    await saveDeployment();
    span3.finish();
  } catch (error) {
    transaction.setStatus('internal_error');
    throw error;
  } finally {
    transaction.finish();
  }
};
```

### User Analytics (Privacy-Compliant)

**Expo Analytics (Anonymous):**
```bash
npx expo install expo-analytics
```

```typescript
import Analytics from 'expo-analytics';

const analytics = new Analytics('UA-XXXXXXXXX-X');

// Track screen views
const trackScreenView = (screenName: string) => {
  analytics.hit('screenview', { screenName })
    .catch(err => console.error('Analytics error:', err));
};

// Track events (privacy-compliant)
const trackEvent = (category: string, action: string) => {
  analytics.event({
    category,
    action,
    label: 'user-initiated',
  });
};

// ✅ CORRECT: Track user actions without PII
trackEvent('Deployment', 'Created');
trackEvent('Camera', 'Scanned');
trackEvent('Offline', 'SyncCompleted');

// ❌ WRONG: Never track PII
// trackEvent('User', user.email); // NO!
```

**GDPR/Privacy Compliance:**
```typescript
// Request user consent
const requestAnalyticsConsent = async () => {
  const consent = await AsyncStorage.getItem('analytics_consent');

  if (consent === null) {
    // Show consent dialog
    const userConsent = await showConsentDialog();
    await AsyncStorage.setItem('analytics_consent', userConsent.toString());
    return userConsent;
  }

  return consent === 'true';
};

// Initialize analytics only with consent
if (await requestAnalyticsConsent()) {
  initializeAnalytics();
}
```

### Error Boundaries and Recovery

**Network Error Recovery:**
```typescript
import NetInfo from '@react-native-community/netinfo';

// ✅ CORRECT: Automatic retry with exponential backoff
const fetchWithRetry = async (
  fn: () => Promise<any>,
  maxRetries = 3,
  initialDelay = 1000
) => {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      const isLastAttempt = i === maxRetries - 1;
      const isNetworkError = error.message?.includes('network');

      if (isLastAttempt || !isNetworkError) {
        throw error;
      }

      // Exponential backoff: 1s, 2s, 4s
      const delay = initialDelay * Math.pow(2, i);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
};

// ✅ CORRECT: Queue failed operations for retry
const queueFailedSync = async (operation: SyncOperation) => {
  await db.runAsync(
    'INSERT INTO sync_queue (operation, data, retry_count, created_at) VALUES (?, ?, ?, ?)',
    [operation.type, JSON.stringify(operation.data), 0, Date.now()]
  );
};

// ✅ CORRECT: Network state monitoring
NetInfo.addEventListener(state => {
  if (state.isConnected && state.isInternetReachable) {
    // Network restored, process sync queue
    processSyncQueue();
  }
});
```

---

## Production Readiness Checklist

### Critical Security Checks

- [ ] **All sensitive data stored in SecureStore/Keychain** (not AsyncStorage)
- [ ] **Environment variables configured** (no hardcoded credentials)
- [ ] **All Supabase tables have RLS enabled**
- [ ] **RLS policies tested** for all user roles (ww_admin, project_admin, project_member, anon)
- [ ] **Auth token refresh implemented** with proper error handling
- [ ] **Network requests use HTTPS only**
- [ ] **API keys not committed to Git** (check with `git log -S "secret_key"`)
- [ ] **Deep links validated** (no sensitive data in URL schemes)
- [ ] **Input validation** on all user inputs (prevent injection attacks)
- [ ] **Offline SQLite database encrypted** (if storing sensitive location data)

### Performance Checks

- [ ] **Console statements removed** from production builds
- [ ] **Hermes engine enabled** (`jsEngine: "hermes"` in app.json)
- [ ] **FlatList optimized** with `getItemLayout`, `removeClippedSubviews`, etc.
- [ ] **Components memoized** where appropriate (React.memo, useMemo, useCallback)
- [ ] **Images optimized** (WebP format, appropriate resolutions)
- [ ] **Bundle size analyzed** (`npx expo export --source-maps`)
- [ ] **Memory leaks checked** (event listeners, timers, subscriptions cleaned up)
- [ ] **SQLite indexes created** for frequently queried columns
- [ ] **Production builds tested** (`npx expo start --no-dev --minify`)
- [ ] **Large lists virtualized** (FlatList, not ScrollView)

### Build Configuration

- [ ] **EAS build configured** with production profile
- [ ] **App version incremented** (iOS buildNumber, Android versionCode)
- [ ] **Code signing certificates** uploaded to EAS
- [ ] **ProGuard enabled** for Android release builds
- [ ] **Splash screen & icon** configured
- [ ] **App permissions justified** in app stores (location, camera, storage)
- [ ] **Privacy policy URL** added to app.json
- [ ] **Terms of service URL** added to app.json

### Expo EAS Production Checklist

- [ ] **EAS Update configured** (`eas update:configure`)
- [ ] **Code signing enabled** for updates
- [ ] **Staging environment tested** before production deployment
- [ ] **Rollout strategy defined** (gradual rollout percentages)
- [ ] **Update channels configured** (production, staging, preview)
- [ ] **Rollback plan documented**
- [ ] **EAS Secrets configured** (Sentry tokens, API keys)

### App Store/Play Store Requirements

#### iOS (App Store Connect)
- [ ] **App Privacy details** completed (data collection disclosure)
- [ ] **Screenshots** for all device sizes (5.5", 6.5", 12.9")
- [ ] **App Store icon** (1024x1024 PNG, no transparency)
- [ ] **App description** written (promotional text, description, keywords)
- [ ] **Age rating** selected
- [ ] **TestFlight beta testing** completed
- [ ] **Submission notes** for review team

#### Android (Google Play Console)
- [ ] **Privacy policy URL** added
- [ ] **Data safety section** completed
- [ ] **Screenshots** for phone and tablet
- [ ] **Feature graphic** (1024x500)
- [ ] **App description** written (short & full description)
- [ ] **Content rating** completed (IARC questionnaire)
- [ ] **Internal testing track** completed
- [ ] **Target API level** meets Google requirements (API 34+ for 2024)

### Monitoring Setup

- [ ] **Sentry configured** with DSN and environment
- [ ] **Error boundaries** implemented
- [ ] **Performance monitoring enabled**
- [ ] **Custom error tracking** for critical flows
- [ ] **Analytics consent** implemented (GDPR compliance)
- [ ] **Crash-free rate target** defined (e.g., >99.5%)

### Privacy & Compliance

- [ ] **Privacy policy published** (required for app stores)
- [ ] **Terms of service published**
- [ ] **GDPR compliance** (if EU users): data consent, right to delete, data export
- [ ] **CCPA compliance** (if California users): data disclosure, opt-out
- [ ] **Analytics opt-out** available
- [ ] **Data retention policy** defined
- [ ] **User data deletion** implemented

### Offline Functionality

- [ ] **Offline data sync** tested thoroughly
- [ ] **Conflict resolution** tested (last-write-wins, manual override)
- [ ] **Network state monitoring** implemented
- [ ] **Sync queue retry logic** tested
- [ ] **Offline UI indicators** visible to users
- [ ] **Data persistence** tested across app restarts

### Final Pre-Launch

- [ ] **Production build tested** on real devices (iOS & Android)
- [ ] **All critical user flows** tested end-to-end
- [ ] **Push notifications** tested (if applicable)
- [ ] **Deep linking** tested
- [ ] **Location permissions** tested
- [ ] **Camera permissions** tested
- [ ] **Bluetooth permissions** tested (for camera scanning)
- [ ] **Network error scenarios** tested
- [ ] **App Store/Play Store assets** uploaded
- [ ] **Release notes** written
- [ ] **Support contact** info added (email, website)
- [ ] **Monitoring dashboards** configured (Sentry, EAS)

---

## Additional Resources

### Official Documentation
- [Expo Production Checklist](https://docs.expo.dev/deploy/build-project/)
- [React Native Security](https://reactnative.dev/docs/security)
- [Supabase RLS Performance](https://supabase.com/docs/guides/troubleshooting/rls-performance-and-best-practices-Z5Jjwv)
- [EAS Build Configuration](https://docs.expo.dev/build/eas-json/)

### Performance Tools
- [React DevTools](https://react.dev/learn/react-developer-tools)
- [Flipper](https://fbflipper.com/)
- [Sentry for React Native](https://docs.sentry.io/platforms/react-native/)
- [source-map-explorer](https://www.npmjs.com/package/source-map-explorer)

### Security Tools
- [expo-secure-store](https://docs.expo.dev/versions/latest/sdk/securestore/)
- [react-native-encrypted-storage](https://github.com/emeraldsanto/react-native-encrypted-storage)
- [SQLCipher](https://www.zetetic.net/sqlcipher/)

---

**Last Updated:** 2025-10-22
**Maintained By:** Research Agent (Claude Code)
**Project:** Wildlife Watcher Mobile App
**Stack:** React Native + Expo SDK 51 + Supabase
