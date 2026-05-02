# API Key Security Research for React Native + Expo (2024)

**Research Date**: 2025-11-06
**Task**: T-010 - API Key Security Best Practices Investigation
**Sources**: Expo Official Docs, Context7 Library Documentation, Web Security Resources 2024
**Evidence Quality**: ✅ Official Expo documentation + verified 2024 security sources

---

## Executive Summary

**Critical Findings**:
1. **Environment variables with `EXPO_PUBLIC_` prefix are NOT secure** - they are embedded in JavaScript bundle and visible in plain text to anyone who decompiles the app
2. **EAS Secrets are for build-time use only** - they do NOT provide runtime security for values embedded in app code
3. **True secrets must NEVER be in client-side code** - use backend proxy/BFF pattern
4. **Mobile apps are harder to update than web apps** - key rotation requires user app updates

**Recommended Strategy for Wildlife Watcher Mobile App**:
- ✅ Use EAS Secrets for build-time credentials (NPM_TOKEN, Sentry API key, Google Services JSON)
- ✅ Move sensitive API keys to backend proxy (Supabase Edge Functions)
- ✅ Use `expo-secure-store` for user tokens (not API keys)
- ✅ Implement git history scanning with TruffleHog/Gitleaks
- ✅ Establish 90-day key rotation schedule

---

## Part 1: EAS Secrets Management

### What EAS Secrets Are (and Are NOT)

**✅ Correct Use Cases** (Official Expo Documentation):
- `NPM_TOKEN` - Installing private npm packages during build
- `SENTRY_AUTH_TOKEN` - Creating Sentry releases and uploading sourcemaps
- `GOOGLE_SERVICES_JSON` - Passing Firebase/Google Services config files as file variables
- Build-time configuration values (not embedded in app bundle)

**❌ Incorrect Use Cases**:
- AWS access keys embedded in app code
- Private API keys that need to be called from client
- Database credentials
- OAuth client secrets

**Why**: From Expo docs:
> "EAS Secrets do not provide any additional security for values that you end up embedding in your application itself, such as an AWS access key or other private keys. Always remember that anything that is included in your client side code should be considered public and readable to any individual that can run the application."

### EAS CLI Commands Reference

```bash
# Create environment variable (interactive)
eas env:create

# Create with explicit parameters
eas env:create --name API_KEY \
               --value "your-key-value" \
               --environment production \
               --visibility secret \
               --scope project

# List all environment variables
eas env:list --environment production

# List with sensitive values shown
eas env:list --environment production --include-sensitive

# Update existing variable
eas env:update production \
               --variable-name API_KEY \
               --value "new-value"

# Delete variable
eas env:delete production --variable-name API_KEY

# Pull variables to local .env file for development
eas env:pull --environment development --path .env.local

# Push variables from .env file to EAS
eas env:push --environment production --path .env.production

# Execute command with environment variables loaded
eas env:exec production 'echo $APP_VARIANT'
eas env:exec production 'npx sentry-expo-upload-sourcemaps dist'
```

### Variable Visibility Levels

**Plaintext** (visible to all team members):
- App variant identifiers
- Non-sensitive configuration URLs
- Feature flags

**Sensitive** (masked in UI, accessible during builds):
- API endpoints
- Non-critical service identifiers

**Secret** (not readable outside EAS servers):
- NPM_TOKEN
- Sentry auth tokens
- Private certificates (base64 encoded)

### Environment Types

EAS supports three environments:

1. **development** - Local dev builds, rapid iteration
2. **preview** - Internal testing, stakeholder review
3. **production** - App Store/Play Store releases

### File Variables (Advanced)

For binary files like `google-services.json`:

```bash
# Create file variable (automatically base64 encoded)
eas env:create --name GOOGLE_SERVICES_JSON \
               --type file \
               --value "$(cat google-services.json)" \
               --visibility secret \
               --environment production
```

Usage in `app.config.js`:

```javascript
export default {
  android: {
    googleServicesFile: process.env.GOOGLE_SERVICES_JSON ?? '/local/path/to/google-services.json',
  },
};
```

---

## Part 2: Environment Variables Best Practices

### The EXPO_PUBLIC_ Prefix

**How It Works**:
```javascript
// .env file
EXPO_PUBLIC_API_URL=https://staging.example.com

// Access in code
const apiUrl = process.env.EXPO_PUBLIC_API_URL;
```

**Critical Security Warning** (Official Expo Docs):
> "Variables prefixed with EXPO_PUBLIC_ are bundled into JavaScript code and visible in plain text. Never store sensitive information in these variables."

### Environment Variable Priority Order

1. EAS Secrets (when using `eas build`)
2. Shell environment variables (`export VAR=value`)
3. `.env.local` (gitignored, highest local priority)
4. `.env.{environment}.local` (e.g., `.env.production.local`)
5. `.env.{environment}` (e.g., `.env.production`)
6. `.env` (committed to repo)

### .gitignore Configuration

```gitignore
# Local environment files (NEVER commit)
.env*.local

# Sensitive configuration (NEVER commit)
.env.production
google-services.json
GoogleService-Info.plist
credentials.json
```

### Dynamic Configuration in app.config.js

```javascript
const IS_DEV = process.env.APP_VARIANT === 'development';
const IS_PREVIEW = process.env.APP_VARIANT === 'preview';

const getUniqueIdentifier = () => {
  if (IS_DEV) return 'com.wildlifeai.watcher.dev';
  if (IS_PREVIEW) return 'com.wildlifeai.watcher.preview';
  return 'com.wildlifeai.watcher';
};

export default {
  name: IS_DEV ? 'Wildlife Watcher (Dev)' : 'Wildlife Watcher',
  ios: {
    bundleIdentifier: getUniqueIdentifier(),
  },
  android: {
    package: getUniqueIdentifier(),
  },
};
```

### Build Profile Configuration (eas.json)

```json
{
  "build": {
    "development": {
      "environment": "development",
      "env": {
        "APP_VARIANT": "development"
      }
    },
    "preview": {
      "environment": "preview",
      "distribution": "internal",
      "env": {
        "APP_VARIANT": "preview"
      }
    },
    "production": {
      "environment": "production",
      "env": {
        "APP_VARIANT": "production"
      }
    }
  }
}
```

---

## Part 3: Secure Storage for User Credentials

### expo-secure-store (Official Expo Package)

**For**: User authentication tokens, session data, user-specific credentials
**Not For**: API keys (those should be on backend)

```bash
npx expo install expo-secure-store
```

```javascript
import * as SecureStore from 'expo-secure-store';

// Store authentication token
async function saveUserToken(token) {
  await SecureStore.setItemAsync('userToken', token);
}

// Retrieve token
async function getUserToken() {
  return await SecureStore.getItemAsync('userToken');
}

// Delete token (logout)
async function deleteUserToken() {
  await SecureStore.deleteItemAsync('userToken');
}
```

**Platform Implementation**:
- **iOS**: Keychain Services (hardware-backed encryption)
- **Android**: EncryptedSharedPreferences + Keystore
- **Web**: LocalStorage (fallback, not secure)

**Security Notes**:
- Keys stored in Secure Enclave on iOS (cannot be extracted)
- Biometric authentication can be required for access
- Automatically cleared when app is uninstalled

---

## Part 4: Backend Proxy Pattern (Recommended)

### The Problem

From security research (2024):
> "When you deploy a mobile app, all of its code — including any embedded API keys — gets packaged and distributed to users' devices, which means anyone can extract your API keys through decompilation."

### The Solution: Backend-for-Frontend (BFF)

**Architecture**:
```
Mobile App → Supabase Edge Function → External API (with secret key)
```

**Benefits**:
- API keys never touch client code
- Server-side key rotation (no app updates required)
- Rate limiting and abuse prevention
- Request logging and monitoring

### Implementation Example (Supabase Edge Function)

```typescript
// supabase/functions/google-maps-proxy/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

serve(async (req) => {
  const { query } = await req.json();

  // Secret key stored in Supabase Edge Function secrets
  const GOOGLE_MAPS_API_KEY = Deno.env.get('GOOGLE_MAPS_API_KEY');

  const response = await fetch(
    `https://maps.googleapis.com/maps/api/geocode/json?address=${query}&key=${GOOGLE_MAPS_API_KEY}`
  );

  const data = await response.json();
  return new Response(JSON.stringify(data), {
    headers: { 'Content-Type': 'application/json' },
  });
});
```

**Client-side usage**:
```typescript
// Mobile app - no API key needed
const response = await supabase.functions.invoke('google-maps-proxy', {
  body: { query: 'Sydney, Australia' }
});
```

### When to Use Backend Proxy

**✅ Always proxy**:
- Payment processing keys (Stripe, PayPal)
- Analytics API keys (Google Analytics, Mixpanel)
- AI/ML service keys (OpenAI, Anthropic)
- Third-party API keys with rate limits

**✅ Can embed** (with restrictions):
- Google Maps API key (with API key restrictions enabled)
- Firebase/Supabase anon keys (with RLS policies)
- Sentry DSN (public by design)

---

## Part 5: API Key Rotation Procedures

### Rotation Frequency (Industry Standard 2024)

- **Minimum**: Every 90 days
- **Recommended**: Every 30 days (if automated)
- **Immediate**: After security incident or team member departure

### Rotation Checklist

#### 1. **Pre-Rotation Preparation**
- [ ] Document all locations where key is used
- [ ] Identify affected applications and services
- [ ] Schedule maintenance window (if downtime required)
- [ ] Prepare rollback plan

#### 2. **Generate New Key**
- [ ] Create new key in service provider dashboard
- [ ] Test new key in non-production environment
- [ ] Verify new key has same permissions as old key

#### 3. **Update Backend Services**
```bash
# Update Supabase Edge Function secret
supabase secrets set GOOGLE_MAPS_API_KEY=new-key-value

# Update EAS secret
eas env:update production \
  --variable-name GOOGLE_MAPS_API_KEY \
  --value "new-key-value"
```

#### 4. **Update Mobile App** (if key was embedded)
```bash
# Update .env.production
echo "EXPO_PUBLIC_API_KEY=new-key" > .env.production

# Build and submit new version
eas build --platform all --profile production
eas submit --platform all
```

#### 5. **Gradual Rollout**
- Deploy to 10% of users first
- Monitor error rates and API calls
- Expand to 100% over 7 days

#### 6. **Deprecate Old Key**
- Wait for 95%+ user adoption (check app version analytics)
- Revoke old key in service provider dashboard
- Monitor for errors (some users may not update)

### Mobile App Update Challenges

From security research:
> "Mobile apps are much harder to update than web apps, since your customers must update their apps before the new keys can be used."

**Mitigation Strategies**:
1. Use backend proxy pattern (no app updates needed)
2. Implement forced update mechanism for security-critical changes
3. Support multiple active keys during transition period (dual-key approach)
4. Monitor app version adoption rates

---

## Part 6: Git History Scanning Tools

### Overview

**Problem**: Developers accidentally commit secrets to git history. Even if later removed, secrets remain in git history forever (unless rewritten).

**Solution**: Automated secret scanning tools

### TruffleHog vs Gitleaks Comparison

| Feature | TruffleHog | Gitleaks |
|---------|-----------|----------|
| **Secret Types** | 800+ detectors | Fewer detectors, uses entropy |
| **Verification** | Yes (makes API calls to verify) | No (pattern matching only) |
| **Scan Targets** | Git, S3, Docker, local files | Git repositories only |
| **Performance** | Slower (deep scanning) | Faster (lightweight) |
| **Best For** | Complex multi-environment projects | Simple, fast CI/CD integration |
| **Classification** | Excellent (specific secret types) | Basic (generic secrets) |
| **Open Source** | Yes | Yes |

### TruffleHog Setup

**Installation**:
```bash
# macOS
brew install trufflesecurity/trufflehog/trufflehog

# Linux
curl -sSfL https://raw.githubusercontent.com/trufflesecurity/trufflehog/main/scripts/install.sh | sh -s -- -b /usr/local/bin

# Docker
docker pull trufflesecurity/trufflehog:latest
```

**Scan Entire Repository History**:
```bash
# Scan current repo
trufflehog git file://. --json > trufflehog-results.json

# Scan remote repo
trufflehog git https://github.com/wildlifeai/wildlife-watcher-mobile-app.git

# Scan with verification (makes API calls)
trufflehog git file://. --json --verify

# Scan since specific commit
trufflehog git file://. --since-commit abc123
```

**CI/CD Integration** (GitHub Actions):
```yaml
name: Secret Scanning

on: [push, pull_request]

jobs:
  trufflehog:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0  # Full history needed

      - name: TruffleHog Secret Scan
        uses: trufflesecurity/trufflehog@main
        with:
          path: ./
          base: ${{ github.event.repository.default_branch }}
          head: HEAD
```

### Gitleaks Setup

**Installation**:
```bash
# macOS
brew install gitleaks

# Linux
wget https://github.com/gitleaks/gitleaks/releases/download/v8.18.0/gitleaks_8.18.0_linux_x64.tar.gz
tar -xvf gitleaks_8.18.0_linux_x64.tar.gz
sudo mv gitleaks /usr/local/bin/

# Docker
docker pull zricethezav/gitleaks:latest
```

**Scan Commands**:
```bash
# Scan entire repo history
gitleaks detect --source . --report-format json --report-path gitleaks-report.json

# Scan uncommitted changes only
gitleaks protect --staged

# Scan with custom config
gitleaks detect --config .gitleaks.toml
```

**CI/CD Integration** (GitHub Actions):
```yaml
name: Gitleaks Scan

on: [push, pull_request]

jobs:
  gitleaks:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Gitleaks Scan
        uses: gitleaks/gitleaks-action@v2
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

### Custom Configuration (.gitleaks.toml)

```toml
title = "Wildlife Watcher Mobile App - Gitleaks Config"

[extend]
# Use default rules
useDefault = true

[[rules]]
id = "supabase-key"
description = "Supabase API Key"
regex = '''sb-[a-zA-Z0-9]{40}'''
keywords = ["supabase"]

[[rules]]
id = "expo-token"
description = "Expo Access Token"
regex = '''expo-[a-zA-Z0-9]{40}'''
keywords = ["expo"]

[allowlist]
description = "Allowed false positives"
paths = [
  '''\.env\.example$''',
  '''README\.md$'''
]
```

### Pre-Commit Hook Setup

**Install pre-commit framework**:
```bash
pip install pre-commit
```

**Create .pre-commit-config.yaml**:
```yaml
repos:
  - repo: https://github.com/gitleaks/gitleaks
    rev: v8.18.0
    hooks:
      - id: gitleaks
```

**Install hook**:
```bash
pre-commit install
```

Now gitleaks runs automatically before every commit.

---

## Part 7: Prevention Strategies

### 1. Pre-Commit Hooks

**Install Gitleaks Pre-Commit Hook**:
```bash
# In project root
cat > .git/hooks/pre-commit << 'EOF'
#!/bin/bash
gitleaks protect --staged --verbose
if [ $? -ne 0 ]; then
  echo "❌ Gitleaks found secrets in staged changes!"
  echo "Review the output above and remove secrets before committing."
  exit 1
fi
EOF

chmod +x .git/hooks/pre-commit
```

### 2. .gitignore Patterns

```gitignore
# Environment files
.env
.env.local
.env*.local
.env.production
.env.staging

# Credentials
*credentials*.json
*secrets*.json
*.pem
*.key
*.p12

# Mobile-specific
google-services.json
GoogleService-Info.plist
firebase.json

# Build artifacts that may contain secrets
*.apk
*.ipa
*.aab
```

### 3. Template Files

**Create .env.example** (safe to commit):
```bash
# .env.example
EXPO_PUBLIC_API_URL=https://api.example.com
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here

# Build-time secrets (set via EAS CLI)
# NPM_TOKEN=
# SENTRY_AUTH_TOKEN=
# GOOGLE_SERVICES_JSON=
```

### 4. Code Review Checklist

- [ ] No hardcoded API keys, passwords, or tokens
- [ ] All `.env` files are in `.gitignore`
- [ ] No `console.log()` statements with sensitive data
- [ ] No comments containing credentials
- [ ] Supabase RLS policies enabled
- [ ] API keys have restrictions enabled (Google Maps, Firebase)

### 5. Security Linting

**ESLint Plugin for Secret Detection**:
```bash
npm install --save-dev eslint-plugin-no-secrets
```

**Add to .eslintrc.js**:
```javascript
module.exports = {
  plugins: ['no-secrets'],
  rules: {
    'no-secrets/no-secrets': 'error'
  }
};
```

---

## Part 8: Incident Response Plan

### If API Key is Exposed

#### Immediate Actions (< 1 hour)

1. **Revoke Compromised Key**
   ```bash
   # Immediately revoke in service provider dashboard
   # Example: Google Cloud Console → Credentials → Delete API Key
   ```

2. **Generate New Key**
   ```bash
   # Create new key with same permissions
   # Update EAS secrets
   eas env:update production --variable-name API_KEY --value "new-key"
   ```

3. **Assess Exposure**
   ```bash
   # Check git history
   git log -S "exposed-key-value" --all

   # Check GitHub search
   # Go to: https://github.com/wildlifeai/wildlife-watcher-mobile-app/search?q=exposed-key
   ```

#### Short-term Actions (< 24 hours)

4. **Monitor Usage**
   - Check API provider dashboard for unusual activity
   - Review billing for unexpected charges
   - Analyze access logs for unauthorized requests

5. **Rewrite Git History** (if needed)
   ```bash
   # ⚠️ WARNING: This is destructive. Coordinate with team first.

   # Use BFG Repo-Cleaner
   brew install bfg

   # Create backup
   git clone --mirror git@github.com:wildlifeai/wildlife-watcher-mobile-app.git

   # Remove secret from history
   bfg --replace-text secrets.txt wildlife-watcher-mobile-app.git

   # Force push (requires admin rights)
   cd wildlife-watcher-mobile-app.git
   git reflog expire --expire=now --all && git gc --prune=now --aggressive
   git push --force
   ```

6. **Notify Team**
   - Inform all developers of key rotation
   - Update documentation with new procedures
   - Conduct post-mortem

#### Long-term Actions (< 1 week)

7. **Implement Preventive Measures**
   - Enable pre-commit hooks (see Part 7)
   - Add secret scanning to CI/CD
   - Conduct security training

8. **Audit Similar Keys**
   - Review all API keys in project
   - Rotate any keys that may have been exposed
   - Update key management procedures

---

## Part 9: Wildlife Watcher Mobile App Recommendations

### Current State Assessment

**Potential Exposure Points**:
1. Google Maps API keys (Android + iOS)
2. Supabase URL and anon key (public by design, but needs RLS)
3. Expo project credentials
4. EAS build secrets (NPM_TOKEN, etc.)

### Recommended Implementation Plan

#### Phase 1: Immediate (Week 1)

**Task 1: Audit Current Secrets**
```bash
# Run TruffleHog scan
trufflehog git file://. --json --verify > audit-results.json

# Review results
cat audit-results.json | jq '.[] | {type: .DetectorName, file: .SourceMetadata.Data.Filename}'
```

**Task 2: Setup .gitignore**
```bash
# Add to .gitignore
cat >> .gitignore << EOF

# Environment files (T-010)
.env
.env.local
.env*.local
.env.production

# Credentials (T-010)
*credentials*.json
*secrets*.json
google-services.json
GoogleService-Info.plist
EOF
```

**Task 3: Create .env.example**
```bash
# Copy current .env structure without sensitive values
cp .env .env.example
# Manually replace all values with placeholders
# Commit .env.example, ensure .env is gitignored
```

#### Phase 2: Short-term (Week 2)

**Task 4: Migrate to EAS Secrets**
```bash
# Google Maps Keys
eas env:create --name GOOGLE_MAPS_API_KEY_ANDROID \
               --value "$(cat google-maps-key-android.txt)" \
               --environment production \
               --visibility secret

eas env:create --name GOOGLE_MAPS_API_KEY_IOS \
               --value "$(cat google-maps-key-ios.txt)" \
               --environment production \
               --visibility secret

# Repeat for development and preview environments
```

**Task 5: Update app.config.js**
```javascript
export default {
  // ...
  android: {
    config: {
      googleMaps: {
        apiKey: process.env.GOOGLE_MAPS_API_KEY_ANDROID
      }
    }
  },
  ios: {
    config: {
      googleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY_IOS
    }
  }
};
```

**Task 6: Enable Pre-Commit Hooks**
```bash
# Install gitleaks
brew install gitleaks

# Create pre-commit hook
cat > .git/hooks/pre-commit << 'EOF'
#!/bin/bash
gitleaks protect --staged --verbose
if [ $? -ne 0 ]; then
  echo "❌ Secrets detected! Remove them before committing."
  exit 1
fi
EOF

chmod +x .git/hooks/pre-commit

# Test it
git add .
git commit -m "test: verify pre-commit hook"
```

#### Phase 3: Medium-term (Month 1)

**Task 7: Implement Backend Proxy for Sensitive APIs**
```bash
# Create Supabase Edge Function for Google Maps
cd ~/wildlife-watcher-backend
supabase functions new google-maps-proxy

# Add secret to Supabase
supabase secrets set GOOGLE_MAPS_API_KEY=your-key-here
```

**Task 8: Add CI/CD Secret Scanning**

Create `.github/workflows/security-scan.yml`:
```yaml
name: Security Scan

on:
  push:
    branches: [main, dev-*]
  pull_request:
    branches: [main]

jobs:
  trufflehog:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: TruffleHog Secret Scan
        uses: trufflesecurity/trufflehog@main
        with:
          path: ./
          base: ${{ github.event.repository.default_branch }}
          head: HEAD

  gitleaks:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Gitleaks Scan
        uses: gitleaks/gitleaks-action@v2
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

**Task 9: Document Rotation Procedures**

Create `project-context/procedures/api-key-rotation.md`:
- Include rotation checklist from Part 5
- Add contact information for key owners
- Document service-specific rotation steps

#### Phase 4: Long-term (Ongoing)

**Task 10: Quarterly Key Rotation**
```bash
# Schedule calendar reminders every 90 days
# Follow rotation checklist from Part 5
```

**Task 11: Security Training**
- Share this document with all developers
- Conduct workshop on secure key management
- Review incidents and lessons learned

**Task 12: Monitoring and Alerts**
- Enable billing alerts on Google Cloud Console
- Setup Supabase usage alerts
- Monitor Sentry for suspicious API activity

---

## Part 10: Key Takeaways

### Do's ✅

1. **Use EAS Secrets for build-time credentials**
   - NPM_TOKEN for private packages
   - Sentry auth tokens
   - CI/CD credentials

2. **Use backend proxy for sensitive API keys**
   - Supabase Edge Functions
   - AWS Lambda
   - Cloudflare Workers

3. **Use expo-secure-store for user credentials**
   - Authentication tokens
   - Session data
   - User-specific secrets

4. **Implement automated scanning**
   - Pre-commit hooks (Gitleaks)
   - CI/CD scanning (TruffleHog)
   - Quarterly full repo scans

5. **Follow rotation schedule**
   - Every 90 days minimum
   - After security incidents
   - When team members leave

### Don'ts ❌

1. **Never use EXPO_PUBLIC_ for sensitive data**
   - Not for API keys
   - Not for OAuth client secrets
   - Not for database credentials

2. **Never commit secrets to git**
   - Not even temporarily
   - Not even in feature branches
   - Not even commented out

3. **Never hardcode secrets in source code**
   - Not in constants files
   - Not in configuration files
   - Not in comments

4. **Never share secrets via insecure channels**
   - Not via Slack/email
   - Not via screenshots
   - Use password managers or EAS CLI

5. **Never assume mobile app updates are instant**
   - Plan for gradual rollout
   - Support dual-key transitions
   - Monitor version adoption

---

## References

### Official Documentation
- [Expo Security Documentation](https://docs.expo.dev/app-signing/security/)
- [Expo Environment Variables Guide](https://docs.expo.dev/guides/environment-variables/)
- [EAS Environment Variables](https://docs.expo.dev/eas/environment-variables/)
- [Expo SecureStore API](https://docs.expo.dev/versions/latest/sdk/securestore/)
- [EAS CLI Documentation](https://github.com/expo/eas-cli)

### Security Tools
- [TruffleHog Official Site](https://trufflesecurity.com/trufflehog)
- [Gitleaks GitHub](https://github.com/gitleaks/gitleaks)
- [OWASP Mobile Top 10 (2024)](https://owasp.org/www-project-mobile-top-10/)
- [Google Maps API Security](https://developers.google.com/maps/api-security-best-practices)

### Research Sources
- [Trunk.io: Gitleaks vs TruffleHog Comparison](https://trunk.io/learn/gitleaks-vs-trufflehog-comparing-secret-scanning-tools)
- [GitGuardian: API Key Rotation Best Practices](https://blog.gitguardian.com/api-key-rotation-best-practices/)
- [Approov: Securing API Keys in Mobile Apps](https://approov.io/blog/now-is-the-time-to-get-serious-about-securing-api-keys)

---

**Document Status**: ✅ Complete
**Last Updated**: 2025-11-06
**Next Review**: 2025-12-06 (monthly update with new security findings)
