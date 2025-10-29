# EAS Secrets Configuration Guide

## Overview

This document provides instructions for securely configuring environment variables for EAS (Expo Application Services) builds using EAS Secrets. This replaces the insecure practice of hardcoding secrets in `eas.json`.

## Why EAS Secrets?

- Secrets are stored securely on EAS servers (not in git)
- Different secrets per environment (development/preview/production)
- Accessed via `process.env` in `app.config.js` during build
- No risk of accidentally committing sensitive keys

## Prerequisites

1. Install EAS CLI: `npm install -g eas-cli`
2. Login to EAS: `eas login`
3. Link project: `eas init` (if not already linked)

## Setup Commands

### Initial Configuration

Run these commands once to configure all required secrets for the project:

```bash
# Supabase Configuration
eas secret:create --scope project --name EXPO_PUBLIC_SUPABASE_URL --value "https://nuhwmubvygxyddkycmpa.supabase.co" --type string
eas secret:create --scope project --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value "your_actual_anon_key_here" --type string

# Google Maps API Keys
eas secret:create --scope project --name GOOGLE_MAPS_API_KEY_ANDROID --value "your_android_key_here" --type string
eas secret:create --scope project --name GOOGLE_MAPS_API_KEY_IOS --value "your_ios_key_here" --type string

# Optional: Client-side variants
eas secret:create --scope project --name EXPO_PUBLIC_GOOGLE_MAPS_API_KEY_ANDROID --value "your_android_key_here" --type string
eas secret:create --scope project --name EXPO_PUBLIC_GOOGLE_MAPS_API_KEY_IOS --value "your_ios_key_here" --type string
```

### Environment-Specific Secrets (Optional)

To set different secrets for development/preview/production:

```bash
# Development environment
eas secret:create --scope project --name EXPO_PUBLIC_SUPABASE_URL --value "dev_url" --type string --env development

# Preview environment
eas secret:create --scope project --name EXPO_PUBLIC_SUPABASE_URL --value "preview_url" --type string --env preview

# Production environment
eas secret:create --scope project --name EXPO_PUBLIC_SUPABASE_URL --value "prod_url" --type string --env production
```

## Managing Secrets

### List All Secrets

```bash
# View all project secrets
eas secret:list

# View secrets for specific environment
eas secret:list --env production
```

### Update Existing Secret

```bash
# Update a secret (use --force to overwrite)
eas secret:create --scope project --name EXPO_PUBLIC_SUPABASE_URL --value "new_value" --type string --force
```

### Delete Secret

```bash
eas secret:delete --name SECRET_NAME
```

### Push Multiple Secrets from File

Create a `.env.eas` file (DO NOT COMMIT):

```bash
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_key_here
GOOGLE_MAPS_API_KEY_ANDROID=your_key_here
GOOGLE_MAPS_API_KEY_IOS=your_key_here
```

Then push:

```bash
eas secret:push --scope project --env-file .env.eas
```

## Verification

### Check Secrets Are Loaded

```bash
# Build with verbose output
eas build --profile development --platform android --local

# Verify secrets in build logs (values will be masked)
```

### Test Build Locally

```bash
# Create .env.local with your secrets for local development
cp .env.example .env.local
# Edit .env.local with actual values

# Run local development
npm start
```

## Key Rotation Required (CRITICAL)

**The following keys were exposed in git and MUST be rotated immediately before production deployment:**

### 1. Supabase Keys

**Exposed Values** (DO NOT USE):
- URL: `https://nuhwmubvygxyddkycmpa.supabase.co`
- Anon Key: `sb_publishable_SZ5M-5IzbkTs74QgD7c9wg_7EUyWzsd` (COMPROMISED)

**Rotation Steps**:

1. Go to Supabase Dashboard → Your Project → Settings → API
2. Click "Generate New Anon Key"
3. Update EAS secret:
   ```bash
   eas secret:create --scope project --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value "NEW_KEY_HERE" --type string --force
   ```
4. Update local `.env.local` file
5. Test authentication flow
6. Once verified, revoke old key in Supabase dashboard

### 2. Google Maps API Keys

**Exposed Values** (DO NOT USE):
- Android/iOS: `AIzaSyD4GgP2HPVqgEOIbOiA1QF6AfTaSBg4vfI` (COMPROMISED)

**Rotation Steps**:

1. Go to Google Cloud Console → APIs & Services → Credentials
2. Generate new API keys (separate for Android and iOS recommended)
3. **Restrict keys by application**:
   - Android: Restrict to package name `com.wildlife.wildlifewatcher`
   - iOS: Restrict to bundle ID `com.wildlife.wildlifewatcher`
4. Update EAS secrets:
   ```bash
   eas secret:create --scope project --name GOOGLE_MAPS_API_KEY_ANDROID --value "NEW_ANDROID_KEY" --type string --force
   eas secret:create --scope project --name GOOGLE_MAPS_API_KEY_IOS --value "NEW_IOS_KEY" --type string --force
   ```
5. Update local `.env.local` file
6. Test map functionality on both platforms
7. Once verified, delete old keys in Google Cloud Console

### 3. Service Role Key (Backend Only)

**Exposed Value** (DO NOT USE):
- Service Role: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU` (COMPROMISED)

**Note**: This key should NEVER be in the mobile app. Only used in backend services.

**Rotation Steps**:

1. Coordinate with backend team
2. Generate new service role key in Supabase
3. Update backend environment variables
4. Remove from mobile `.env.local` (not needed for mobile app)

## Rotation Priority

**Critical (Rotate Immediately)**:
- Supabase Anon Key (exposed in git, high risk)
- Service Role Key (exposed in git, critical risk - backend only)

**High Priority (Rotate Before Production)**:
- Google Maps API Keys (exposed in git, moderate risk with restrictions)

**Timeline**:
- Critical keys: Within 24 hours
- High priority keys: Before production deployment

## Security Checklist

Before production deployment, verify:

- [ ] All secrets removed from `eas.json` ✅
- [ ] All secrets configured in EAS (`eas secret:list`)
- [ ] Exposed Supabase anon key rotated
- [ ] Exposed service role key rotated (backend)
- [ ] Google Maps API keys rotated
- [ ] Google Maps API keys restricted by bundle ID/package name
- [ ] `.env.local` in `.gitignore` ✅
- [ ] `.env.example` created with template ✅
- [ ] Test builds work with EAS secrets
- [ ] Authentication flow tested with new keys
- [ ] Map functionality tested with new keys

## Troubleshooting

### Secret Not Available During Build

**Problem**: `process.env.VAR_NAME` is undefined during EAS build

**Solutions**:
1. Verify secret exists: `eas secret:list`
2. Check secret name matches exactly (case-sensitive)
3. Ensure scope is `project` (not `account`)
4. For environment-specific, use `--env` flag when creating

### Local Development Not Working

**Problem**: App crashes or features don't work locally

**Solutions**:
1. Verify `.env.local` exists and has all required values
2. Copy from `.env.example` as starting point
3. Restart Metro bundler after changing `.env.local`
4. Check `app.config.js` reads from correct `process.env` variables

### Build Works But App Crashes

**Problem**: EAS build succeeds but app crashes at runtime

**Solutions**:
1. Check app expects secrets via `Constants.expoConfig.extra`
2. Verify `app.config.js` passes secrets through `extra` object
3. Enable debug logging in app to verify values are loaded
4. Check for typos in secret names

## Additional Resources

- [EAS Secrets Documentation](https://docs.expo.dev/build-reference/variables/)
- [Expo Environment Variables](https://docs.expo.dev/guides/environment-variables/)
- [Supabase Security Best Practices](https://supabase.com/docs/guides/api/api-keys)
- [Google Maps API Key Security](https://developers.google.com/maps/api-key-best-practices)

## Support

For issues with:
- EAS Secrets: Expo Discord or support
- Supabase Keys: Check backend team documentation
- Google Maps Keys: Verify restrictions in Google Cloud Console
