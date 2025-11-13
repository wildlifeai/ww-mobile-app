# CLAUDE.md Optimization Plan

**Date**: 2025-11-10
**Purpose**: Reduce CLAUDE.md token usage from ~25-30K to ~10-15K tokens (50-65% reduction)
**Approach**: 8 token reduction techniques + Eric Provencher's RepoPrompt methods
**Status**: APPROVED - Ready for execution

---

## Executive Summary

**Current State**: 1,593 lines, ~25-30K tokens, mixing instructions/context
**Target State**: ~950 lines, ~10-15K tokens, separated context/instructions
**Expected Savings**: 50-65% token reduction, 70-90% session cost reduction (with caching)
**Zero Content Loss**: All information preserved inline or in referenced files

**Key Principles**:
- ✅ Content changes BEFORE structural changes (minimize risk)
- ✅ Option 6 uses EXISTING files only (no new file creation)
- ✅ Backup first, validate each phase
- ✅ Eric's methods: Separate context/instructions, instructions at bottom
- ✅ Combat "context rot" by removing spurious info

---

## Token Reduction Techniques (Options 1-8)

### Option 1: Prompt Caching Headers ⭐⭐⭐⭐⭐
- **Savings**: 70-90% session cost reduction
- **How**: Add Anthropic cache control headers to stable sections
- **Why**: Cached content doesn't count toward input token limits
- **Effort**: 1 hour

### Option 2: Remove Redundant Whitespace ⭐⭐⭐⭐
- **Savings**: 5-10% direct reduction
- **How**: Multiple blank lines → max 2, remove trailing spaces
- **Why**: BPE treats whitespace as part of tokens
- **Effort**: 2 hours (automated)

### Option 3: Expand Symbol Usage ⭐⭐⭐⭐⭐
- **Savings**: 15-20% in status/navigation sections
- **How**: ✅/❌/→/⚠️ instead of verbose text
- **Why**: Single Unicode characters = 1 token vs 2-3 tokens for words
- **Effort**: 1 hour

### Option 4: Abbreviate Repeated Terms ⭐⭐⭐⭐
- **Savings**: 10-15% for frequent terms
- **How**: Define legend, use consistently (WW Mobile, Type Sync, QG, etc.)
- **Why**: Shorter strings = fewer BPE tokens
- **Effort**: 4 hours

### Option 5: Concise Imperative Language ⭐⭐⭐
- **Savings**: 10-20% in instruction sections
- **How**: Active voice, remove filler words ("you should", "very", "really")
- **Why**: Removes unnecessary tokens
- **Effort**: 4 hours

### Option 6: Hierarchical Information Architecture ⭐⭐⭐⭐
- **Savings**: 30-50% by offloading details
- **How**: Keep summaries in CLAUDE.md, reference EXISTING files for details
- **Why**: Don't pre-stuff context window (Eric's method)
- **Effort**: 8 hours
- **CRITICAL**: Only reference EXISTING files, don't create new ones

### Option 7: XML Tag Structuring ⭐⭐⭐
- **Savings**: 10-15% by eliminating explanatory text
- **How**: Wrap sections in semantic tags (`<context>`, `<instructions>`, etc.)
- **Why**: Claude trained on XML structure, reduces need for preambles
- **Effort**: 4 hours

### Option 8: Normalize Capitalization ⭐⭐
- **Savings**: 2-5% by reducing ALL CAPS
- **How**: "CRITICAL" → "Critical" (preserve acronyms: AADF, API, TDD)
- **Why**: Different cases = different BPE tokens
- **Effort**: 1 hour

---

## Eric Provencher's RepoPrompt Methods

From `@project-context/reference/repoprompt-methods.md` and `reporpromot-template.md`:

### Method 1: Separate Context from Instructions
**Eric's #1 Technique**: "Build prompts that separate instructions from context"
- Context = read-only background (project overview, architecture, tech stack)
- Instructions = actionable directives (workflows, quality gates, decision trees)

### Method 2: Instructions at Bottom
**Eric's Finding**: "Works really well to place instructions at the bottom"
- Context loads first (background)
- Reference in middle (lookup)
- Instructions last (actionable)

### Method 3: Use XML Tags
**Eric's Structure**: "Use key XML tags to demarcate sections"
- `<context>`, `<reference>`, `<instructions>`, `<quality_gates>`, `<workflows>`

### Method 4: Stay Minimal for Claude
**Eric on Claude**: "Claude prefers to find what it needs (agentic model)"
- Give hints about where to find things
- Don't pre-stuff context window
- Let Claude load details on-demand

### Method 5: Combat Context Rot
**Eric's Warning**: "Too much garbage information leads to context rot"
- Remove spurious info
- Remove outdated task references
- Remove completed TODOs
- Keep only current, relevant information

### Method 6: Duplicate Critical Instructions
**Eric's Tip**: "Duplicating instructions actually helps a lot sometimes"
- Repeat critical rules 2-3x in relevant contexts
- Pre-commit hook enforcement
- Context7 research first
- Zero quality gate bypasses

---

## Phase 0: Preparation & Backup

**Duration**: 30 minutes
**Risk Level**: LOW

### Step 0.1: Create Backup
```bash
# Backup CLAUDE.md with timestamp
cp CLAUDE.md CLAUDE.md.backup-$(date +%Y%m%d-%H%M%S)

# Verify backup
diff CLAUDE.md CLAUDE.md.backup-* && echo "✅ Backup successful"
```

### Step 0.2: Setup Research Documentation
Token reduction research already exists at:
`@project-context/investigation/token-reduction-research-2025.md`

This plan saved at:
`@project-context/reference/claude-md-optimization-plan-2025-11-10.md`

### Step 0.3: Identify Existing Files for Option 6
```bash
# Extract all @-references from CLAUDE.md
grep -o '@[^)]*\.md' CLAUDE.md | sort -u > /tmp/existing-refs.txt

# Verify files exist
while read ref; do
  file="${ref#@}"
  if [ ! -f "$file" ]; then
    echo "⚠️ WARNING: Referenced file does not exist: $file"
  else
    echo "✅ $file exists"
  fi
done < /tmp/existing-refs.txt
```

**Expected Existing Files**:
- `@project-context/development-context/MVP2/implementation-spec-v1.4.md`
- `@project-context/learnings/type-drift-prevention-5-layer-defense.md`
- `@project-context/development-context/MVP2/implementation/guides/testing-standards.md`
- `@documentation/developer-docs/Stack-Best-Practices-Research-2024.md`
- And ~20 more existing referenced files

---

## Phase 1: Low-Risk Content Changes

**Duration**: 1-2 hours
**Estimated Savings**: 17-25%
**Risk Level**: LOW

### Step 1.1: Option 8 - Normalize Capitalization (2-5%)

**Changes**:
- ALL CAPS headers → Title Case
- "CRITICAL:", "MANDATORY:", "IMPORTANT:" → bold lowercase
- Preserve code blocks, proper nouns, acronyms (AADF, API, TDD, E2E, etc.)

**Example**:
```diff
- ## 🚨 CRITICAL: Concurrent Execution & File Management
+ ## 🚨 Critical: Concurrent Execution & File Management

- **ABSOLUTE RULES**:
+ **Absolute Rules**:

- **MANDATORY**: Follow Evidence-Based Development
+ **Mandatory**: Follow Evidence-Based Development
```

**Automation Script**:
```bash
# Backup for this step
cp CLAUDE.md CLAUDE.md.phase1-step1

# Normalize headers (preserve ##, ###, ####)
sed -i 's/^## \([A-Z][A-Z ]*\)$/## \L\1/g' CLAUDE.md

# Convert ALL CAPS emphasis to bold lowercase (preserve acronyms)
# Manual review required to preserve acronyms
```

**Validation**:
- [ ] Headers render correctly
- [ ] Acronyms unchanged (API, URL, AADF, TDD, BDD, etc.)
- [ ] Code blocks unchanged

### Step 1.2: Option 2 - Remove Redundant Whitespace (5-10%)

**Changes**:
- Remove trailing whitespace
- Multiple blank lines (3+) → max 2
- Standardize list spacing

**Automation Script**:
```bash
cp CLAUDE.md CLAUDE.md.phase1-step2

# Remove trailing whitespace
sed -i 's/[[:space:]]*$//' CLAUDE.md

# Collapse 3+ blank lines to 2
awk 'BEGIN{blank=0} /^$/{blank++; if(blank<=2) print; next} {blank=0; print}' CLAUDE.md > CLAUDE.md.tmp
mv CLAUDE.md.tmp CLAUDE.md
```

**Validation**:
- [ ] Markdown renders correctly
- [ ] Lists properly spaced
- [ ] Code blocks unchanged

### Step 1.3: Option 3 - Expand Symbol Usage (15-20%)

**Changes**:
- Replace verbose arrows: "then" → "→"
- Status indicators: "Completed" → "✅", "Failed" → "❌", "In Progress" → "🟡"
- Emphasis: "CRITICAL:" → "🔴", "WARNING:" → "⚠️", "Note:" → "📝"

**Example**:
```diff
- If the command fails, then run validation
+ If command fails → run validation

- Status: Completed
+ Status: ✅ Completed

- CRITICAL: Never bypass hooks
+ 🔴 Never bypass hooks
```

**Automation Script**:
```bash
cp CLAUDE.md CLAUDE.md.phase1-step3

# Replace arrows
sed -i 's/ then / → /g' CLAUDE.md

# Replace status indicators
sed -i 's/Status: Completed/Status: ✅/g' CLAUDE.md
sed -i 's/Status: In Progress/Status: 🟡/g' CLAUDE.md
sed -i 's/Status: Failed/Status: ❌/g' CLAUDE.md

# Replace emphasis (preserve context)
# Manual review recommended
```

**Validation**:
- [ ] Symbols render correctly
- [ ] Meaning unchanged
- [ ] Accessibility not impacted

---

## Phase 2: Medium-Risk Content Changes

**Duration**: 2-3 hours
**Estimated Savings**: +20-35% cumulative
**Risk Level**: MEDIUM

### Step 2.1: Option 4 - Abbreviate Repeated Terms (10-15%)

**Abbreviation Legend** (create at top of CLAUDE.md):
```markdown
## Abbreviations Reference
- AADF: AI Agentic Development Framework
- TDD: Test-Driven Development
- BDD: Behavior-Driven Development
- E2E: End-to-End
- RN: React Native
- RTK: Redux Toolkit
- RBAC: Role-Based Access Control
- XPC: Cross-Project Coordination
- QG: Quality Gate
- Type Sync: Type Synchronization
- WW Mobile: Wildlife Watcher Mobile App
```

**Changes**:
```diff
- Test-Driven Development workflow
+ TDD workflow

- End-to-End testing with Maestro
+ E2E testing with Maestro

- Cross-Project Coordination system
+ XPC system

- Quality Gate validation
+ QG validation
```

**Manual Review Required**:
- First usage in each major section: keep full term + abbreviation
- Code examples: NO abbreviations
- Section headers: can use abbreviations if clear

**Validation**:
- [ ] Abbreviations defined before first usage
- [ ] Clarity maintained
- [ ] Code examples unaffected

### Step 2.2: Option 5 - Concise Imperative Language (10-20%)

**Transformations**:
```diff
- You should always run tests before committing
+ Run tests before committing

- It is very important to ensure that you validate types
+ Validate types (critical)

- Make sure that you check the coordination inbox on a daily basis
+ Check coordination inbox daily

- The backend team may have sent schema changes
+ Backend may send schema changes
```

**Automation Script** (first pass):
```bash
cp CLAUDE.md CLAUDE.md.phase2-step2

# Remove filler words
sed -i 's/\bvery \b//g' CLAUDE.md
sed -i 's/\breally \b//g' CLAUDE.md
sed -i 's/\bjust \b//g' CLAUDE.md
sed -i 's/\bsimply \b//g' CLAUDE.md

# Convert to imperative
sed -i 's/You should //g' CLAUDE.md
sed -i 's/you should //g' CLAUDE.md
sed -i 's/Make sure that you //g' CLAUDE.md

# MANUAL REVIEW REQUIRED after automation
```

**Validation**:
- [ ] Tone remains professional
- [ ] Instructions clear
- [ ] No loss of critical nuance

---

## Phase 3: Structural Changes

**Duration**: 3-4 hours
**Estimated Savings**: +40-65% cumulative
**Risk Level**: MEDIUM-HIGH

### Step 3.1: Option 6 - Hierarchical Architecture (30-50%)

**Strategy**: Move details to EXISTING referenced files, keep summaries in CLAUDE.md

**Content Migration Map**:

| Current Section | Lines | Action | Destination |
|----------------|-------|--------|-------------|
| Type Synchronization Critical Path | 400 | Move details → summary | `@learnings/type-drift-prevention-5-layer-defense.md` (EXISTS) |
| Runtime Environment Switching | 200 | Move implementation → quick ref | `@execution/RUNTIME-ENVIRONMENT-SWITCHING-IMPLEMENTATION-PLAN.md` (EXISTS) |
| Testing Strategy | 150 | Move comprehensive → quick ref | `@guides/testing-standards.md` (EXISTS) |
| Quality Gates | 300 | Keep checklist, move rationale | Keep inline (critical) |
| AADF Documentation | 100 | Reference only | `@learnings/ai-agentic-development-framework.md` (EXISTS) |
| Agent Ecosystem | 200 | Move list → quick commands | `@investigation/aadf-work-smart/QUICK-REFERENCE-AGENT-INVENTORY.md` (EXISTS) |

**Example Transformation**:

**Before** (400 lines):
```markdown
## Type Synchronization Critical Path

**The Problem**: Backend schema changes → mobile TypeScript types become stale → runtime errors

**The Solution**: 5-layer defense-in-depth strategy (80% automated, 99% prevention rate)

**Architecture**:
[... 300 lines of detailed explanation ...]
```

**After** (50 lines):
```markdown
## Type Synchronization Critical Path

**Full Guide**: `@project-context/learnings/type-drift-prevention-5-layer-defense.md`

**TL;DR**: 5-layer defense (99% prevention rate)
- Layer 1: Backend pre-commit → blocks stale types
- Layer 2: Coordination messages (manual quality)
- Layer 3: Mobile inbox check (daily)
- Layer 4: Mobile pre-commit → blocks commits ✅
- Layer 5: GitHub Actions → blocks PR merge ✅

**Daily Command**:
```bash
npm run types:local  # 3 sec, hook validates automatically
```

**When to Deep-Dive**: Setting up new env, debugging drift, understanding architecture
```

**Validation**:
- [ ] All referenced files EXIST
- [ ] No content lost
- [ ] Summary preserves critical "must-know" info
- [ ] Cross-references accurate

### Step 3.2: Option 7 - XML Tag Structuring (10-15%)

**Tag Schema**:
```xml
<context>
  <!-- Project background, architecture, tech stack -->
</context>

<reference>
  <!-- Documentation index, agent commands, file locations -->
</reference>

<critical_rules>
  <!-- Zero-tolerance policies -->
</critical_rules>

<quality_gates>
  <!-- Validation checklists -->
</quality_gates>

<workflows>
  <!-- Daily workflows, session startup -->
</workflows>

<instructions>
  <!-- Actionable developer instructions (AT BOTTOM) -->
</instructions>
```

**Example**:
```diff
- ## Quality Control Standards
-
- ### Discovery Phase (MANDATORY BEFORE CODING)
+ <quality_gates>
+ <discovery_phase mandatory="true">
  1. Read type definitions in `/src/types/` FIRST
  2. Use Read tool to examine actual interfaces
  3. Never assume - always verify
+ </discovery_phase>
+
+ <test_integrity zero_tolerance="true">
  - Never skip, delete, or modify tests without approval
  - Never use `.skip()`, `.todo()` as shortcuts
+ </test_integrity>
+ </quality_gates>
```

**Validation**:
- [ ] Valid XML structure (no unclosed tags)
- [ ] Semantic tags match content
- [ ] Markdown still renders

### Step 3.3: Option 1 - Prompt Caching Headers (70-90% session savings)

**Implementation**:
```markdown
<!-- ANTHROPIC_CACHE: claude.md/context -->
<context>
  <!-- Stable context: architecture, tech stack, file structure -->
</context>
<!-- END_CACHE -->

<!-- ANTHROPIC_CACHE: claude.md/quality_gates -->
<quality_gates>
  <!-- Quality standards, enforcement rules -->
</quality_gates>
<!-- END_CACHE -->

<!-- Dynamic content (NO CACHE) -->
<current_status>
  <!-- Task status, coordination messages -->
</current_status>
```

**Cache Boundaries**:
- **Cacheable**: Architecture, quality gates, tech stack, testing standards, commands
- **Non-Cacheable**: Current task status, coordination messages, metrics

**Validation**:
- [ ] Cache headers properly formatted
- [ ] Static content inside cache blocks
- [ ] Dynamic content outside cache blocks

---

## Phase 4: Eric's Template Restructuring

**Duration**: 2-3 hours
**Estimated Savings**: +10-20% efficiency
**Risk Level**: HIGH (most transformative)

### Step 4.1: Separate Context from Instructions

**Current**: Mixed throughout
**Target**: Two distinct sections

**Structure**:
```markdown
# CLAUDE.md

## Part 1: Context (Read-Only Background)
<context>
- Project overview, tech stack, architecture
- File structure, existing components
- Reference documentation links
</context>

---

## Part 2: Instructions (Actionable Directives - AT BOTTOM)
<instructions>
- Critical rules (zero tolerance)
- Development workflow (step-by-step)
- Quality gates (validation checklists)
- Decision trees (when to use what)
</instructions>
```

**Validation**:
- [ ] All context in Part 1
- [ ] All instructions in Part 2
- [ ] No duplication

### Step 4.2: Move Instructions to Bottom

**Order**:
1. **Context** (top): Project overview, architecture
2. **Reference** (middle): Documentation links, commands
3. **Instructions** (bottom): Critical rules, workflows, quality gates

**Validation**:
- [ ] Context loads first
- [ ] Reference in middle
- [ ] Instructions at bottom

### Step 4.3: Give Hints, Don't Pre-Stuff

**Replace detailed sections with pointers**:

```diff
- ## Type Synchronization Critical Path
- [... 400 lines of detailed implementation ...]
+ ## Type Synchronization
+ **When to deep-dive**: Setting up, debugging, understanding
+ **Quick Ref**: 5-layer defense → `@learnings/type-drift-prevention-5-layer-defense.md`
+ **Daily Command**: `npm run types:local`
```

**Validation**:
- [ ] Hints point to correct files
- [ ] Critical info preserved inline
- [ ] User can find details easily

### Step 4.4: Combat Context Rot

**Audit & Remove**:
- [ ] Outdated task references
- [ ] Completed TODOs
- [ ] Redundant explanations
- [ ] Superseded workflows
- [ ] Update "Current State" sections to 2025-11-10

**Sections to Audit**:
- MVP2 Development Context
- Cross-Project Coordination
- Testing Strategy
- Agent Ecosystem

### Step 4.5: Duplicate Critical Instructions

**Sections to Duplicate** (2-3x in relevant contexts):

1. **Pre-Commit Hook Enforcement**: Critical Rules + Dev Workflow + Quality Gates
2. **Context7 Research First**: Critical Rules + Dev Workflow + Before Task
3. **Zero Quality Gate Bypasses**: Critical Rules + Git Standards + Quality Gates

**Validation**:
- [ ] Critical rules appear 2-3 times
- [ ] Each instance in relevant context
- [ ] No excessive duplication (>3x)

---

## Phase 5: Validation & Verification

**Duration**: 1-2 hours
**Objective**: Zero content loss, measure savings, verify readability

### Step 5.1: Zero Content Loss Verification

```bash
# Extract headers from original
grep -E '^##+ ' CLAUDE.md.backup-* | sort -u > /tmp/original-headers.txt

# Extract headers from optimized
grep -E '^##+ ' CLAUDE.md | sort -u > /tmp/optimized-headers.txt

# Find missing headers
comm -23 /tmp/original-headers.txt /tmp/optimized-headers.txt > /tmp/missing-headers.txt

# Review
if [ -s /tmp/missing-headers.txt ]; then
  echo "⚠️ WARNING: Some headers missing"
  cat /tmp/missing-headers.txt
else
  echo "✅ All headers accounted for"
fi
```

**Checklist**:
- [ ] All critical rules preserved
- [ ] All workflows documented
- [ ] All quality gates present
- [ ] All file references valid
- [ ] All command examples correct

### Step 5.2: Token Count Comparison

```bash
# Approximate token count (4 chars = 1 token)
original_chars=$(wc -c < CLAUDE.md.backup-*)
original_tokens=$((original_chars / 4))

optimized_chars=$(wc -c < CLAUDE.md)
optimized_tokens=$((optimized_chars / 4))

savings=$((original_tokens - optimized_tokens))
savings_pct=$((savings * 100 / original_tokens))

echo "Original: ~$original_tokens tokens"
echo "Optimized: ~$optimized_tokens tokens"
echo "Savings: ~$savings tokens ($savings_pct%)"
```

**Expected**:
- Baseline: 25-30K tokens
- Target: 10-15K tokens
- Savings: 50-65%

### Step 5.3: Readability Testing

**Human Review**:
- [ ] Instructions clear and actionable
- [ ] Context not overwhelming
- [ ] Navigation easy
- [ ] Critical rules prominent
- [ ] Examples helpful

**Claude Review** (meta-test):
- [ ] Claude reads referenced files correctly
- [ ] Claude follows workflows accurately
- [ ] Claude enforces quality gates
- [ ] Claude finds documentation easily

### Step 5.4: Git Review

```bash
# Summary
git diff --stat CLAUDE.md

# Detailed diff
git diff CLAUDE.md | less

# Verify deletions are intentional
git diff CLAUDE.md | grep -E '^\-' | wc -l
git diff CLAUDE.md | grep -E '^\+' | wc -l
```

**Questions**:
- [ ] Deletions intentional (moved to refs)?
- [ ] Additions meaningful?
- [ ] Line count reduction justified?

---

## Rollback Strategy

### Immediate Rollback
**Scenario**: Optimization broke critical functionality

```bash
# Restore from backup
cp CLAUDE.md CLAUDE.md.failed-optimization
cp CLAUDE.md.backup-* CLAUDE.md

# Verify
diff CLAUDE.md CLAUDE.md.backup-* && echo "✅ Rollback successful"
```

### Partial Rollback
**Scenario**: Specific phase problematic

```bash
# Restore to last successful phase
cp CLAUDE.md.phase2-step2 CLAUDE.md
```

### Incremental Recovery
**Scenario**: Specific sections missing

```bash
# Extract missing section from backup
sed -n "/## Section Start/,/## Section End/p" CLAUDE.md.backup-* > /tmp/missing.md

# Manually reintegrate
```

---

## Expected Results

### Token Savings Breakdown

| Technique | Savings | Lines Saved |
|-----------|---------|-------------|
| Option 1: Caching | 70-90% session cost | N/A |
| Option 2: Whitespace | 5-10% | ~80-160 |
| Option 3: Symbols | 15-20% | ~240-320 |
| Option 4: Abbreviations | 10-15% | ~160-240 |
| Option 5: Concise | 10-20% | ~160-320 |
| Option 6: Hierarchical | 30-50% | ~480-800 |
| Option 7: XML | 10-15% | ~160-240 |
| Option 8: Capitalization | 2-5% | ~32-80 |
| Eric's Methods | +10-20% | ~160-320 |
| **TOTAL** | **50-65%** | **~800-1,000** |

### File Size Reduction

| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| Lines | 1,593 | ~950 | 40% |
| Characters | ~120K | ~72K | 40% |
| Tokens | 25-30K | 10-15K | 50-65% |

### Before/After Structure

**Before**: Mixed context + instructions (1,593 lines)

**After**: Separated, optimized (~950 lines)
```
<context> - Project background, architecture (200 lines)
<reference> - Doc index, commands (160 lines)
<critical_rules> - Zero tolerance (50 lines)
<quality_gates> - Validation checklists (150 lines)
<workflows> - Daily workflows (70 lines)
<instructions> - Actionable directives (320 lines) ← AT BOTTOM
```

---

## Timeline

| Phase | Duration | Risk |
|-------|----------|------|
| Phase 0: Preparation | 30 min | Low |
| Phase 1: Low-Risk Content | 1-2 hours | Low |
| Phase 2: Medium-Risk Content | 2-3 hours | Medium |
| Phase 3: Structural Changes | 3-4 hours | Medium-High |
| Phase 4: Eric's Restructuring | 2-3 hours | High |
| Phase 5: Validation | 1-2 hours | Low |
| **TOTAL** | **9-14 hours** | **Medium-High** |

**Recommendation**: Execute over 2-3 sessions with validation checkpoints

---

## Execution Checklist

### Pre-Execution
- [ ] Backup CLAUDE.md with timestamp
- [ ] Identify all existing referenced files
- [ ] Verify all referenced files exist
- [ ] Set up rollback strategy

### Phase 1: Low-Risk
- [ ] Option 8: Normalize capitalization
- [ ] Option 2: Remove whitespace
- [ ] Option 3: Expand symbols
- [ ] Validate: Diff, token count

### Phase 2: Medium-Risk
- [ ] Option 4: Abbreviations (create legend)
- [ ] Option 5: Concise language
- [ ] Validate: Manual review

### Phase 3: Structural
- [ ] Option 6: Hierarchical (EXISTING files only)
- [ ] Option 7: XML tags
- [ ] Option 1: Caching headers
- [ ] Validate: Content mapping

### Phase 4: Eric's Methods
- [ ] Separate context/instructions
- [ ] Move instructions to bottom
- [ ] Give hints, don't pre-stuff
- [ ] Combat context rot
- [ ] Duplicate critical instructions
- [ ] Validate: User testing

### Phase 5: Validation
- [ ] Zero content loss verification
- [ ] Token count comparison
- [ ] Readability testing
- [ ] Git review
- [ ] Update research doc

### Post-Execution
- [ ] Commit optimized CLAUDE.md
- [ ] Archive backup
- [ ] Document learnings
- [ ] Test with real tasks
- [ ] Monitor for 1 week

---

## Success Criteria

**Quantitative**:
- ✅ Token reduction: 50-65% (10-15K vs 25-30K)
- ✅ Line reduction: 40-45% (~950 vs 1,593)
- ✅ Session cost reduction: 70-90% (via caching)

**Qualitative**:
- ✅ Zero content loss
- ✅ Improved readability
- ✅ Faster onboarding
- ✅ Easier maintenance

**Validation**:
- ✅ Claude follows accurately
- ✅ Developer finds answers quickly
- ✅ Critical rules prominent
- ✅ No functional regressions

---

## Related Documentation

- **Token Reduction Research**: `@project-context/investigation/token-reduction-research-2025.md`
- **Eric's Methods**: `@project-context/reference/repoprompt-methods.md`
- **Eric's Template**: `@project-context/reference/reporpromot-template.md`
- **Current CLAUDE.md**: `/home/adarsh/dev/wildlifeai/wildlife-watcher-mobile-app/CLAUDE.md`

---

**Status**: APPROVED - Ready for Phase 0 execution
**Next Step**: Execute Phase 0 (Preparation & Backup)
