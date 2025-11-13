# AADF Work Smart Execution Plan: T-010
**Task**: Remove hardcoded API keys and migrate to EAS secrets
**Created**: 2025-11-06
**Framework**: AI Agentic Development Framework (AADF)
**Priority**: P0 (Critical Security)
**Stream**: Stream B (Code Review Blockers)

---

## 🎯 OBJECTIVE

Eliminate all hardcoded API keys from the Wildlife Watcher mobile app codebase and migrate to secure EAS secrets management, following industry best practices for React Native + Expo applications.

---

## 🔬 PHASE 1: EVIDENCE-BASED RESEARCH ✅ COMPLETE

### Research Completed
- ✅ **Context7**: Expo EAS Secrets documentation retrieved
- ✅ **Web Search**: React Native API key security best practices (2024)
- ✅ **Documentation**: Created comprehensive research summary

**Deliverable**: `2025-11-06-T016-api-key-security-research.md` (10-part guide)

**Key Findings**:
1. `EXPO_PUBLIC_` variables are NOT secure (embedded in bundle)
2. EAS Secrets are for build-time injection only
3. True API secrets require backend proxy pattern
4. Gitleaks recommended for git history scanning
5. 90-day key rotation industry standard

---

## 🔍 PHASE 2: TASK ANALYSIS ✅ COMPLETE

### Security Audit Results

**CRITICAL FINDINGS**:
1. **2 exposed API keys in `.env.local`**:
   - `ANTHROPIC_API_KEY`: Real key (requires rotation)
   - `GOOGLE_API_KEY`: Real key (requires rotation)

2. **Hardcoded Supabase credentials** (src/config/environments.ts):
   - Cloud-dev URL: `https://nuhwmubvygxyddkycmpa.supabase.co` ✅ Accepted (RLS protected)
   - Cloud-dev anon key: `sb_publishable_...` ✅ Accepted (designed for public)

3. **6 unused AI provider keys**: Placeholders (not mobile-relevant, remove)

4. **Test credentials**: `testpassword123` (low risk, dev-only)

**GOOD PRACTICES FOUND**:
- ✅ `.env.local` properly gitignored
- ✅ `app.config.js` dynamic config working
- ✅ `EXPO_PUBLIC_` prefix used correctly
- ✅ RLS policies protecting Supabase data

**Deliverable**: `2025-11-06-T010-security-audit-findings.md` (comprehensive report)

---

## 📋 PHASE 3: TASK BREAKDOWN

### Atomic Tasks (Sequential Execution)

**Task 3.1**: Rotate Exposed API Keys (15 min)
- **What**: Generate new keys, revoke old keys
- **Where**: Anthropic dashboard, Google Cloud Console
- **Quality Gate**: Old keys revoked, new keys functional

**Task 3.2**: Clean `.env.local` (5 min)
- **What**: Remove unused AI provider keys
- **Where**: `.env.local` file
- **Quality Gate**: Only mobile-relevant keys remain

**Task 3.3**: Update `.env.example` (10 min)
- **What**: Document EAS secret setup commands
- **Where**: `.env.example` file
- **Quality Gate**: Clear instructions for future developers

**Task 3.4**: Configure EAS Secrets (15 min)
- **What**: Create project-scoped secrets for Google Maps keys
- **Where**: EAS CLI
- **Quality Gate**: `eas secret:list` shows 2 secrets

**Task 3.5**: Test Build with EAS Secrets (20 min)
- **What**: Build dev profile, verify key injection
- **Where**: EAS Build
- **Quality Gate**: Build succeeds, keys redacted in logs

**Task 3.6**: Validate Security (5 min)
- **What**: Run gitleaks, grep for hardcoded keys
- **Where**: Codebase root
- **Quality Gate**: 0 leaks detected

**Task 3.7**: Functional Testing (5 min)
- **What**: Launch app, test Google Maps + Auth
- **Where**: Physical device or emulator
- **Quality Gate**: All features working

**Task 3.8**: Documentation Update (10 min)
- **What**: Update CLAUDE.md with secret management workflow
- **Where**: Root CLAUDE.md
- **Quality Gate**: Future developers have clear guidance

---

## ⚙️ PHASE 4: AGENT SELECTION & MCP TOOLS

### Agent Assignments (Parallel Execution Not Possible - Sequential Security Tasks)

**Agent**: `quality-assurance-engineer` (Primary)
- **Rationale**: Security-focused, testing expertise, quality gates
- **MCP Tools**: None required (manual key rotation + CLI commands)
- **Scope**: All 8 tasks (sequential execution)

**No Sub-Agents Required**: Task is linear security remediation

---

## 🎯 PHASE 5: QUALITY GATES

### Security Gates (MUST PASS)
- [ ] ✅ Zero hardcoded API keys in source code
- [ ] ✅ All secrets configured as EAS secrets
- [ ] ✅ Gitleaks scan: 0 leaks detected
- [ ] ✅ `.env.local` contains no real API keys
- [ ] ✅ Old API keys revoked in cloud services

### Functional Gates (MUST PASS)
- [ ] ✅ `npm run type-check`: 0 errors
- [ ] ✅ EAS build succeeds with secrets
- [ ] ✅ Google Maps loads in app
- [ ] ✅ Authentication flows working
- [ ] ✅ Supabase connectivity verified

### Documentation Gates (MUST PASS)
- [ ] ✅ `.env.example` updated with EAS commands
- [ ] ✅ Security remediation logged
- [ ] ✅ CLAUDE.md reflects new workflow

---

## 📊 PHASE 6: EXECUTION METRICS

### Time Estimates
**Total**: 1.5 hours (90 minutes)

| Task | Duration | Type |
|------|----------|------|
| 3.1 Key Rotation | 15 min | Manual |
| 3.2 Clean .env.local | 5 min | Code |
| 3.3 Update .env.example | 10 min | Docs |
| 3.4 Configure EAS | 15 min | CLI |
| 3.5 Test Build | 20 min | Build |
| 3.6 Security Scan | 5 min | Validation |
| 3.7 Functional Test | 5 min | QA |
| 3.8 Documentation | 10 min | Docs |
| **Buffer** | 5 min | Contingency |

**Critical Path**: Sequential (all tasks block next task)
**Parallelization**: Not applicable (security tasks require sequential validation)

---

## 🚀 PHASE 7: EXECUTION SEQUENCE

### Pre-Execution Checklist
- [x] Research complete (Context7 + web search)
- [x] Security audit complete
- [x] Exposed keys identified
- [x] Remediation plan documented
- [ ] **User approval to proceed** ⬅️ REQUIRED

### Execution Flow
```
1. User Approves Plan
   ↓
2. Task 3.1: Rotate Keys (Anthropic, Google)
   ↓
3. Task 3.2: Clean .env.local
   ↓
4. Task 3.3: Update .env.example
   ↓
5. Task 3.4: Configure EAS Secrets
   ↓
6. Task 3.5: Test EAS Build
   ↓
7. Task 3.6: Security Validation (Gitleaks)
   ↓
8. Task 3.7: Functional Testing
   ↓
9. Task 3.8: Documentation
   ↓
10. Quality Gates Validation
   ↓
11. Task Complete ✅
```

---

## 📈 SUCCESS METRICS

### Before (Current State)
- **Exposed Keys**: 2 (Anthropic, Google)
- **Unused Keys**: 6 (AI providers)
- **Hardcoded Credentials**: 2 (Supabase, accepted)
- **EAS Secrets**: 0
- **Security Score**: 4/10

### After (Target State)
- **Exposed Keys**: 0
- **Unused Keys**: 0
- **Hardcoded Credentials**: 2 (Supabase, accepted with RLS)
- **EAS Secrets**: 2 (Google Maps Android + iOS)
- **Security Score**: 9/10

### Improvement
- **Security**: +125% (4/10 → 9/10)
- **Compliance**: 100% (T-010 exit criteria met)
- **Risk Reduction**: 100% (all critical keys secured)

---

## 🔐 SECURITY CONSIDERATIONS

### Accepted Risks (LOW)
1. **Supabase anon keys hardcoded**: Industry standard for Supabase, protected by RLS
2. **Local Supabase credentials**: Localhost only, reset on every start
3. **Test passwords**: Dev screens only, excluded from production builds

### Mitigated Risks (HIGH → LOW)
1. **Google Maps API keys**: EAS secrets + bundle ID restriction
2. **AI provider keys**: Removed (not used in mobile app)

### Eliminated Risks (CRITICAL → NONE)
1. **Anthropic API key**: Rotated + removed from filesystem
2. **Google API key**: Rotated + EAS secret

---

## 📁 DELIVERABLES

### Research
- ✅ `2025-11-06-T016-api-key-security-research.md` (10-part guide)

### Analysis
- ✅ `2025-11-06-T010-security-audit-findings.md` (comprehensive findings)

### Planning
- ✅ `2025-11-06-T010-execution-plan.md` (this document)

### Implementation (After User Approval)
- [ ] Updated `.env.local` (cleaned)
- [ ] Updated `.env.example` (with EAS commands)
- [ ] EAS secrets configured (2 secrets)
- [ ] Gitleaks scan results (0 leaks)
- [ ] Build logs (successful EAS build)
- [ ] Functional test results (all features working)

---

## ⏭️ NEXT STEPS

**Awaiting User Approval**:
1. Review security audit findings
2. Approve key rotation plan (Anthropic + Google)
3. Approve EAS secret migration strategy
4. Confirm acceptance of hardcoded Supabase credentials (RLS protected)

**Upon Approval**:
- Execute Tasks 3.1 → 3.8 sequentially
- Validate all quality gates
- Archive execution plan
- Update AADF framework learnings

---

**Status**: ⏸️ READY FOR EXECUTION (Awaiting User Approval)
**Estimated Completion**: 1.5 hours from approval
**Risk Level**: LOW (well-researched, evidence-based plan)
**Confidence**: 95% (clear path, proven tools)
