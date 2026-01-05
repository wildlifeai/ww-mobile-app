# Expo Environment Variables & Configuration

This document outlines how environment variables and system configurations are managed in the Wildlife Watcher project.

## ⚠️ Modern Pattern: Dynamic Environment Manager

We have transitioned from static environment variables to a **Dynamic Environment Manager** that supports runtime switching between environments (Local, Cloud-Dev, Cloud-Prod).

**Do not access `process.env` directly in feature code.** Instead, use the configuration registry.

### 1. Configuration Registry (`src/config/environments.ts`)
This file contains the hardcoded development credentials and build-time lookups for production.
- **Local:** WSL/Localhost Supabase
- **Cloud-Dev:** Staging/Shared development database
- **Cloud-Prod:** Production instance (populated via EAS Secrets)

### 2. Runtime Access Pattern
```typescript
import { getEnvironmentConfig } from "../config/EnvironmentManager";

// Inside an async function or service
const config = await getEnvironmentConfig();
console.log(config.supabaseUrl);
```

---

## Variable Types (Legacy/Build-time)

### 1. Build-time Variables (Server-side/Internal)
These are injected via `eas.json` or `.env` during the build process:
- `GOOGLE_MAPS_API_KEY_ANDROID` - Android Maps API key
- `GOOGLE_MAPS_API_KEY_IOS` - iOS Maps API key

### 2. Client-side Variables (`EXPO_PUBLIC_` prefix)
These are embedded in the client bundle and serve as **fallbacks** for the Environment Manager:
- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`

---

## Configuration Files

### `app.config.ts` (Dynamic Config)
The `app.config.ts` file dynamically resolves the project name, bundle IDs, and "extra" configuration based on the `APP_VARIANT` environment variable.

```typescript
// app.config.ts example
const IS_DEV = process.env.APP_VARIANT === 'development';
const BUNDLE_ID = IS_DEV ? 'com.wildlife.wildlifewatcher.expo' : 'com.wildlife.wildlifewatcher';
```

## Security Notes
- **EAS Secrets**: Production credentials must be stored as EAS Secrets, NOT committed to the repository.
- **Environment manager restriction**: Environment switching is restricted to **Development Builds** (`__DEV__`) only. Production and Preview builds use fixed configurations for safety.

## Required for Development
To get started locally, you typically need a `.env.local` file with:
1. `EXPO_PUBLIC_SUPABASE_URL` - Your local or dev Supabase URL
2. `EXPO_PUBLIC_SUPABASE_ANON_KEY` - Your local or dev Anon key
3. `GOOGLE_MAPS_API_KEY_*` - Keys for map tiles
