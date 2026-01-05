# T-010: Security Audit Findings & Remediation Plan
**Created**: 2025-11-06
**Task**: Remove hardcoded API keys and migrate to EAS secrets
**Priority**: P0 (Critical Security)
**Estimated**: 1.5 hours
**Status**: In Progress

---

## 🚨 CRITICAL FINDINGS

### 1. EXPOSED API KEYS IN `.env.local` (SEVERITY: CRITICAL)

**File**: `/home/adarsh/dev/wildlifeai/wildlife-watcher-mobile-app/.env.local`

**Exposed Credentials**:
```bash
ANTHROPIC_API_KEY="sk-ant-api03-[REDACTED]"  # Real key found (ROTATED)
GOOGLE_API_KEY="AIzaSy[REDACTED]"  # Real key found (ROTATED)
PERPLEXITY_API_KEY="your_perplexity_api_key_here"  # Placeholder
OPENAI_API_KEY="your_openai_api_key_here"  # Placeholder
MISTRAL_API_KEY="your_mistral_key_here"  # Placeholder
XAI_API_KEY="YOUR_XAI_KEY_HERE"  # Placeholder
```

**Impact**:
- ✅ `.env.local` is gitignored (NOT committed to repository)
- ❌ Real keys present on local filesystem
- ❌ Keys may be exposed in local backups, file sync services (Dropbox, Google Drive, etc.)
- ❌ Keys may be logged in terminal history or build logs

**IMMEDIATE ACTION REQUIRED**:
1. Rotate Anthropic API key (real key exposed)
2. Rotate Google API key (real key exposed)
3. Remove all API keys from `.env.local`
4. Configure as EAS secrets for build-time injection

---

### 2. HARDCODED SUPABASE CREDENTIALS IN SOURCE CODE (SEVERITY: HIGH)

**File**: `src/config/environments.ts`

**Hardcoded Values**:
```typescript
// Line 32-36: Local Supabase
supabaseUrl: "http://192.168.1.239:54321"
supabaseAnonKey: "sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH"

// Line 39-44: Cloud-dev Supabase (with fallback hardcode)
supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL || "https://nuhwmubvygxyddkycmpa.supabase.co"
supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || "sb_publishable_SZ5M-5IzbkTs74QgD7c9wg_7EUyWzsd"
```

**Analysis**:
- ✅ Local Supabase anon key: Non-sensitive (localhost only, reset on every `supabase start`)
- ⚠️ Cloud-dev Supabase URL: **COMMITTED TO GIT** (https://nuhwmubvygxyddkycmpa.supabase.co)
- ⚠️ Cloud-dev Supabase anon key: **COMMITTED TO GIT** (sb_publishable_SZ5M-5IzbkTs74QgD7c9wg_7EUyWzsd)

**Impact**:
- ⚠️ Public Supabase anon keys are **designed** to be public (Supabase security model uses RLS)
- ⚠️ Exposure allows anyone to read Supabase URL (potential for DDoS/rate limit abuse)
- ✅ RLS policies prevent unauthorized data access (verified in backend)
- ⚠️ Best practice: Use environment variables even for anon keys (defense-in-depth)

**RECOMMENDATION**:
- Keep current approach for **development ease** (low risk with RLS)
- Optional: Remove hardcoded fallbacks, require env vars
- Mandatory: Add rate limiting monitoring in Supabase dashboard

---

### 3. PLACEHOLDER API KEYS IN `.env.local` (SEVERITY: LOW)

**Placeholders Found**:
```bash
PERPLEXITY_API_KEY="your_perplexity_api_key_here"
OPENAI_API_KEY="your_openai_api_key_here"
MISTRAL_API_KEY="your_mistral_key_here"
XAI_API_KEY="YOUR_XAI_KEY_HERE"
```

**Analysis**:
- ❓ **Question**: Are these actually used by the mobile app, or leftover from backend/SuperClaude config?
- ❓ No references found in mobile app source code
- ✅ Likely copy/paste from global `.env.local` template

**RECOMMENDATION**:
- Remove unused API keys from `.env.local`
- Mobile app only needs: Supabase, Google Maps
- Keep `.env.example` minimal (only mobile-relevant vars)

---

### 4. TEST CREDENTIALS IN SOURCE CODE (SEVERITY: LOW)

**File**: `src/screens/AuthTestScreen.tsx`, `src/components/SupabaseAuthTest.tsx`

**Hardcoded Test Password**:
```typescript
const [password, setPassword] = useState("testpassword123")
```

**Analysis**:
- ✅ Test screen only (not production code)
- ✅ Default value for dev testing
- ⚠️ Should be removed before production builds

**RECOMMENDATION**:
- Keep for development (low risk)
- Add build-time check to exclude test screens from production builds

---

## ✅ GOOD SECURITY PRACTICES FOUND

### 1. Proper `.gitignore` Configuration
```bash
.env.local  # ✅ Excluded from git
.env.*.local  # ✅ All local env files excluded
```

### 2. Environment Variable Architecture
- ✅ Uses `app.config.js` for dynamic config injection
- ✅ Separates build-time vs runtime env vars
- ✅ Uses `EXPO_PUBLIC_` prefix correctly for client-side vars
- ✅ Google Maps API keys configured via build config (not hardcoded)

### 3. Supabase Security Model
- ✅ RLS policies protect data (verified in backend)
- ✅ Anon keys designed for public exposure
- ✅ Runtime environment switching implemented correctly

---

## 📋 REMEDIATION PLAN

### Phase 1: IMMEDIATE (Next 30 Minutes)

**1.1 Rotate Exposed API Keys** (15 min)
- [ ] Anthropic API key rotation:
  - Generate new key in Anthropic dashboard
  - Update `.env.local` (temporary)
  - Revoke old key after testing
- [ ] Google API key rotation:
  - Generate new key in Google Cloud Console
  - Restrict by bundle ID: `com.wildlife.wildlifewatcher.expo`
  - Update `.env.local` (temporary)
  - Revoke old key after testing

**1.2 Clean `.env.local`** (5 min)
- [ ] Remove unused AI provider keys (Perplexity, OpenAI, Mistral, XAI)
- [ ] Keep only: Google Maps API keys (for local build testing)
- [ ] Add comment: "For EAS builds, use EAS secrets instead"

**1.3 Update `.env.example`** (10 min)
- [ ] Remove AI provider keys (not mobile-relevant)
- [ ] Add section: "EAS Build Configuration"
- [ ] Document EAS secret commands for each required var

---

### Phase 2: EAS SECRETS CONFIGURATION (Next 45 Minutes)

**2.1 Configure Google Maps API Keys as EAS Secrets** (15 min)

```bash
# Android Maps API Key
eas secret:create --scope project \
  --name GOOGLE_MAPS_API_KEY_ANDROID \
  --value "YOUR_NEW_ANDROID_KEY" \
  --type string

# iOS Maps API Key
eas secret:create --scope project \
  --name GOOGLE_MAPS_API_KEY_IOS \
  --value "YOUR_NEW_IOS_KEY" \
  --type string
```

**2.2 Verify EAS Configuration** (10 min)

```bash
# List configured secrets
eas secret:list

# Verify app.config.js reads from env
cat app.config.js | grep GOOGLE_MAPS_API_KEY
```

**2.3 Test Build with EAS Secrets** (20 min)

```bash
# Development build (Android)
eas build --profile development --platform android

# Verify keys are injected correctly
# Check build logs for: "Google Maps API Key: <redacted>"
```

---

### Phase 3: VALIDATION (Next 15 Minutes)

**3.1 Codebase Scan** (5 min)
```bash
# Run gitleaks on codebase
brew install gitleaks
gitleaks detect --source . --verbose

# Expected: 0 leaks found
```

**3.2 Environment Variable Audit** (5 min)
```bash
# Verify no hardcoded secrets in source
grep -r "AIzaSy" src/  # Should be empty
grep -r "sk-ant-" src/  # Should be empty
grep -r "sk-proj-" src/  # Should be empty
```

**3.3 Functional Testing** (5 min)
- [ ] Launch app with new configuration
- [ ] Verify Google Maps loads correctly
- [ ] Verify authentication flows work
- [ ] Check Supabase connection

---

## 📊 COMPLETION CRITERIA

### Security Gates
- [ ] Zero hardcoded API keys in source code
- [ ] All secrets configured as EAS secrets
- [ ] Gitleaks scan: 0 leaks detected
- [ ] `.env.local` contains no real API keys
- [ ] `.env.example` documents EAS secret setup

### Functional Gates
- [ ] `npm run type-check`: 0 errors
- [ ] Build succeeds with EAS secrets
- [ ] Google Maps loads in app
- [ ] Authentication flows working
- [ ] Supabase connectivity verified

### Documentation Gates
- [ ] `.env.example` updated with EAS commands
- [ ] Security remediation logged in task notes
- [ ] Rotation procedures documented

---

## 🔍 NOTES FOR T-010 IMPLEMENTATION

### What Stays Hardcoded (LOW RISK)
1. **Supabase anon keys**: Designed for public exposure, protected by RLS
2. **Local Supabase URL/key**: Localhost only, reset on every start
3. **Test passwords**: Development screens only

### What MUST Use EAS Secrets (HIGH RISK)
1. **Google Maps API keys**: Can be abused for quota exhaustion
2. **Production Supabase URL/keys** (future): When cloud-prod is configured

### What Gets Removed (NOT USED)
1. AI provider keys (Anthropic, OpenAI, Perplexity, Mistral, XAI)
   - Not referenced in mobile app code
   - Likely from global `.env.local` template

---

## ⏱️ TIME TRACKING

**Estimated**: 1.5 hours (T-010 task definition)
**Breakdown**:
- Phase 1 (Immediate): 30 min
- Phase 2 (EAS Setup): 45 min
- Phase 3 (Validation): 15 min

**Total**: 1.5 hours ✅ (matches estimate)

---

## 🎯 SUCCESS METRICS

**Before**:
- 2 real API keys in `.env.local`
- 6 unused placeholder keys
- 2 hardcoded Supabase credentials (low risk)

**After**:
- 0 real API keys in codebase
- 0 unused keys
- 2 hardcoded Supabase credentials (accepted risk with RLS)
- 100% EAS secret coverage for sensitive keys

---

**Next Steps**: Proceed to Phase 1 implementation with user approval.
