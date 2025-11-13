# Supabase Client Migration Guide

## Overview

This guide helps you migrate from the old singleton Supabase client pattern to the new factory pattern that supports dynamic environment switching.

**Why this change?**
- Runtime environment switching (local ↔ cloud-dev ↔ cloud-prod)
- Proper client lifecycle management
- Memory leak prevention
- React component integration
- Backward compatibility maintained

## Quick Start

### Old Pattern (Deprecated)
```typescript
import { supabase } from './services/supabase';

// Singleton - created once at module load
const { data } = await supabase.from('users').select();
```

### New Pattern (Recommended)
```typescript
import { getSupabaseClient } from './services/supabase';

// Factory - gets current client instance
const client = getSupabaseClient();
const { data } = await client.from('users').select();
```

## Migration Paths

### Path 1: Service Files (Recommended)

**Pattern**: Create local helper function

```typescript
// services/myService.ts
import { getSupabaseClient } from './supabase';

// Create local helper
const supabase = () => getSupabaseClient();

// Use everywhere
export async function fetchData() {
  const { data } = await supabase().from('table').select();
  return data;
}
```

**Benefits**:
- Minimal code changes
- Works with existing code structure
- Clear upgrade path

**Example**: `src/services/auth.ts` (already migrated)

### Path 2: React Components (Recommended)

**Pattern**: Use `useSupabaseClient` hook

```typescript
// components/ProjectList.tsx
import { useSupabaseClient } from '../hooks/useSupabaseClient';

function ProjectList() {
  const client = useSupabaseClient();

  const fetchProjects = async () => {
    const { data } = await client.from('projects').select();
    setProjects(data);
  };

  // Hook automatically updates when environment changes
}
```

**Optional Loading State**:
```typescript
import { useSupabaseClientOptional } from '../hooks/useSupabaseClient';

function ProjectList() {
  const client = useSupabaseClientOptional();

  if (!client) {
    return <LoadingSpinner />;
  }

  // Use client safely
}
```

### Path 3: RTK Query (No Changes Required)

RTK Query endpoints that use auth service functions **don't need updates**:

```typescript
// Already compatible - no changes needed
export const authApi = api.injectEndpoints({
  endpoints: (builder) => ({
    login: builder.mutation<AuthResponse, LoginRequest>({
      queryFn: async (credentials) => {
        const result = await login(credentials); // Uses getSupabaseClient internally
        return { data: result };
      },
    }),
  }),
});
```

## Backward Compatibility

### Legacy Exports Still Work

The old `supabase` export still works but logs deprecation warnings:

```typescript
import { supabase } from './services/supabase';

// Still works (with warning in dev mode)
const { data } = await supabase.from('users').select();
// ⚠️ DEPRECATED: Direct 'supabase' export is deprecated.
// Use getSupabaseClient() instead.
```

**When to migrate**: Migrate when you touch the file for other reasons. No rush.

## Environment Switching Workflow

### 1. User Changes Environment

```typescript
import { setEnvironment } from './config/EnvironmentManager';
import { reconnectSupabase } from './services/supabase';

// Step 1: Update environment preference
await setEnvironment('local');

// Step 2: Reconnect client
await reconnectSupabase();

// Step 3: Components automatically re-render with new client
```

### 2. React Components Update Automatically

```typescript
function ProjectList() {
  const client = useSupabaseClient();

  // Hook listens for client changes
  // Automatically re-renders when reconnectSupabase() is called

  useEffect(() => {
    fetchData();
  }, [client]); // Re-fetch when client changes
}
```

### 3. Manual Listening (Advanced)

```typescript
import { onSupabaseClientChange } from './services/supabase';

// Register callback
const unsubscribe = onSupabaseClientChange(() => {
  console.log('Client changed - refetch data');
  refetchAllData();
});

// Cleanup
unsubscribe();
```

## Common Patterns

### Pattern: Initialize on App Start

```typescript
// App.tsx
import { initializeSupabaseClient } from './services/supabase';

export default function App() {
  useEffect(() => {
    // Initialize client with current environment
    initializeSupabaseClient()
      .then(() => console.log('Supabase initialized'))
      .catch((error) => console.error('Init failed:', error));
  }, []);

  return <NavigationContainer>...</NavigationContainer>;
}
```

### Pattern: Environment Switcher UI

```typescript
// components/EnvironmentSwitcher.tsx
import { useState } from 'react';
import { setEnvironment, getEnvironment } from '../config/EnvironmentManager';
import { reconnectSupabase } from '../services/supabase';

function EnvironmentSwitcher() {
  const [loading, setLoading] = useState(false);

  const handleSwitch = async (env: 'local' | 'cloud-dev' | 'cloud-prod') => {
    setLoading(true);
    try {
      await setEnvironment(env);
      await reconnectSupabase();
      Alert.alert('Success', `Switched to ${env}`);
    } catch (error) {
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View>
      <Button title="Local" onPress={() => handleSwitch('local')} />
      <Button title="Cloud Dev" onPress={() => handleSwitch('cloud-dev')} />
      <Button title="Cloud Prod" onPress={() => handleSwitch('cloud-prod')} />
    </View>
  );
}
```

### Pattern: Service with Environment Awareness

```typescript
// services/ProjectService.ts
import { getSupabaseClient, getCurrentEnvironment } from './supabase';

const supabase = () => getSupabaseClient();

export async function fetchProjects() {
  const env = getCurrentEnvironment();
  console.log('Fetching from:', env?.displayName);

  const { data } = await supabase().from('projects').select();
  return data;
}
```

## Testing

### Unit Tests

```typescript
import { initializeSupabaseClient, resetSupabaseClient } from '../services/supabase';

describe('MyService', () => {
  beforeEach(() => {
    // Reset to clean state
    resetSupabaseClient();

    // Mock environment config
    jest.mock('../config/EnvironmentManager', () => ({
      getEnvironmentConfig: jest.fn().mockResolvedValue({
        supabaseUrl: 'http://test.supabase.co',
        supabaseAnonKey: 'test-key',
        // ...
      }),
    }));
  });

  it('should fetch data', async () => {
    await initializeSupabaseClient();
    const data = await fetchData();
    expect(data).toBeDefined();
  });
});
```

### Integration Tests

```typescript
import { reconnectSupabase } from '../services/supabase';
import { setEnvironment } from '../config/EnvironmentManager';

it('should switch environments', async () => {
  // Initial state
  await setEnvironment('local');
  await initializeSupabaseClient();

  // Switch environment
  await setEnvironment('cloud-dev');
  await reconnectSupabase();

  // Verify new environment
  const env = getCurrentEnvironment();
  expect(env?.displayName).toBe('Cloud Development');
});
```

## API Reference

### Core Functions

#### `initializeSupabaseClient(options?)`
```typescript
/**
 * Initializes Supabase client with current environment config
 * @param options - Optional client configuration overrides
 * @returns Promise<SupabaseClient>
 */
```

#### `getSupabaseClient()`
```typescript
/**
 * Gets current Supabase client instance
 * @returns SupabaseClient
 * @throws Error if client not initialized
 */
```

#### `reconnectSupabase()`
```typescript
/**
 * Recreates client with current environment
 * Cleans up old client and emits change event
 * @returns Promise<SupabaseClient>
 */
```

#### `onSupabaseClientChange(callback)`
```typescript
/**
 * Registers callback for client changes
 * @param callback - Function to call on change
 * @returns Unsubscribe function
 */
```

#### `getCurrentEnvironment()`
```typescript
/**
 * Gets current environment configuration
 * @returns EnvironmentConfig | null
 */
```

### React Hooks

#### `useSupabaseClient()`
```typescript
/**
 * Hook for Supabase client access
 * Auto-updates when environment changes
 * @returns SupabaseClient
 * @throws Error if client not initialized
 */
```

#### `useSupabaseClientOptional()`
```typescript
/**
 * Hook variant that returns null during init
 * @returns SupabaseClient | null
 */
```

## Troubleshooting

### Error: "Supabase client not initialized"

**Cause**: Trying to use client before initialization

**Solution**:
```typescript
// App.tsx - Initialize early
useEffect(() => {
  initializeSupabaseClient();
}, []);

// OR use hook in components
const client = useSupabaseClient();
```

### Error: "Call initializeSupabaseClient() first"

**Cause**: Using `getSupabaseClient()` before initialization

**Solution**:
```typescript
// Initialize in App.tsx or use hook
await initializeSupabaseClient();

// Then use getter
const client = getSupabaseClient();
```

### Warning: "Direct 'supabase' export is deprecated"

**Cause**: Using old singleton export

**Solution**: Migrate to new pattern (see Migration Paths above)

### Memory Leaks After Environment Switches

**Cause**: Not unsubscribing from client change listeners

**Solution**:
```typescript
useEffect(() => {
  const unsubscribe = onSupabaseClientChange(callback);
  return unsubscribe; // Cleanup on unmount
}, []);
```

## Migration Checklist

- [ ] Initialize client in App.tsx
- [ ] Update service files with helper function
- [ ] Convert React components to use hook
- [ ] Test environment switching flow
- [ ] Verify no memory leaks
- [ ] Update tests to reset client state
- [ ] Document environment switcher UI
- [ ] Remove deprecation warnings from dev mode

## Performance Considerations

### Client Creation Overhead
- Client creation is fast (~5ms)
- AsyncStorage read is async but cached
- No performance impact on normal use

### Memory Management
- Old clients are cleaned up automatically
- Subscriptions removed on reconnection
- No memory leaks with proper hook usage

### React Rendering
- Hook updates trigger re-render
- Use `useMemo` for expensive computations
- Cache queries at RTK Query level

## Security Considerations

### Environment Switching Permission
- Only allowed in development builds
- Production builds use fixed environment
- Prevents accidental production access

### Credential Management
- Development credentials in code (safe)
- Production credentials via EAS secrets
- Never log anon keys in production

## Future Improvements

### Planned Features
- [ ] Automatic retry on connection failure
- [ ] Client health monitoring
- [ ] Environment validation UI
- [ ] Migration progress tracking
- [ ] Deprecation warning removal (v2.0)

## Support

**Questions?** See:
- `src/services/supabase.ts` - Implementation
- `src/hooks/useSupabaseClient.ts` - React hook
- `src/config/EnvironmentManager.ts` - Environment config

**Issues?** Check:
- Console logs for initialization errors
- AsyncStorage for persisted environment
- Network connectivity to Supabase URL
- Environment configuration completeness
