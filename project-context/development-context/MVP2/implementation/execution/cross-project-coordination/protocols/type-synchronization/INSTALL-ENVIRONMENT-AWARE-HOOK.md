# Install Environment-Aware Pre-Commit Hook

## Quick Install (Recommended)

### Option 1: Symlink (Auto-Updates)
```bash
cd /home/adarsh/dev/wildlifeai/wildlife-watcher-mobile-app

# Backup existing hook (if any)
[ -f .git/hooks/pre-commit ] && mv .git/hooks/pre-commit .git/hooks/pre-commit.backup

# Create symlink to versioned template
ln -sf ../../scripts/pre-commit-hook.sh .git/hooks/pre-commit

# Verify installation
ls -la .git/hooks/pre-commit
# Expected: lrwxrwxrwx ... .git/hooks/pre-commit -> ../../scripts/pre-commit-hook.sh
```

**Benefits**:
- Updates automatically when template changes
- Team gets latest version
- Easier maintenance

### Option 2: Copy (Static)
```bash
cd /home/adarsh/dev/wildlifeai/wildlife-watcher-mobile-app

# Backup existing hook (if any)
[ -f .git/hooks/pre-commit ] && mv .git/hooks/pre-commit .git/hooks/pre-commit.backup

# Copy template
cp scripts/pre-commit-hook.sh .git/hooks/pre-commit

# Make executable
chmod +x .git/hooks/pre-commit

# Verify installation
ls -la .git/hooks/pre-commit
# Expected: -rwxr-xr-x ... .git/hooks/pre-commit
```

**Benefits**:
- Works on systems without symlink support
- Independent from template changes

## Verification

### Test Hook Execution
```bash
# Test manually (doesn't require actual commit)
.git/hooks/pre-commit

# Expected output:
# 🔍 Validating database types...
# 📍 Validating against LOCAL Supabase instance
# ✅ Types are synchronized with LOCAL Supabase
# ✅ Pre-commit checks passed
```

### Test Context Detection
```bash
# Test cloud keyword detection
echo "[cloud-dev] deploy: test" > .git/COMMIT_EDITMSG
.git/hooks/pre-commit
# Expected: Cloud context suggestion

# Clean up test
rm .git/COMMIT_EDITMSG
```

### Test Emergency Override
```bash
# Test bypass mechanism
SKIP_TYPE_CHECK=1 .git/hooks/pre-commit
# Expected: Warning about override, immediate exit
```

## Prerequisites

### Required
- ✅ Local Supabase instance running (localhost:54321)
- ✅ Backend repository available at `~/dev/wildlifeai/wildlife-watcher-backend`
- ✅ npm packages installed (`npm install`)
- ✅ Scripts executable: `chmod +x scripts/*.sh`

### Verify Prerequisites
```bash
# 1. Check local Supabase
curl http://localhost:54321/health
# Expected: {"date":"...","message":"ok"}

# 2. Check backend repo
ls ~/dev/wildlifeai/wildlife-watcher-backend
# Expected: Directory listing

# 3. Check npm scripts
npm run types:check-local -- --version
# Expected: Script executes

# 4. Check scripts are executable
ls -la scripts/*.sh | grep -E "^-rwxr"
# Expected: All scripts are executable
```

## Migration from Original Hook

### If Original Hook Exists
```bash
# 1. Backup original
cp .git/hooks/pre-commit .git/hooks/pre-commit.original

# 2. View differences
diff .git/hooks/pre-commit.original scripts/pre-commit-hook.sh

# 3. Install new hook (choose Option 1 or 2 above)

# 4. Test new hook
.git/hooks/pre-commit

# 5. If issues, restore original
# mv .git/hooks/pre-commit.original .git/hooks/pre-commit
```

### Key Differences
- ✅ Environment-aware context detection
- ✅ Cloud deployment support
- ✅ Emergency override mechanism
- ✅ Better error messages
- ✅ Health checks before validation
- ✅ Colored output

## Team Installation

### Share with Team
```bash
# Hook template is version-controlled
# Team members can install with:
git pull
ln -sf ../../scripts/pre-commit-hook.sh .git/hooks/pre-commit
```

### Onboarding Checklist
For new team members:

- [ ] Clone repository
- [ ] Install dependencies: `npm install`
- [ ] Start local Supabase: `cd ~/dev/wildlifeai/wildlife-watcher-backend && npx supabase start`
- [ ] Install hook: `ln -sf ../../scripts/pre-commit-hook.sh .git/hooks/pre-commit`
- [ ] Test hook: `.git/hooks/pre-commit`
- [ ] Verify validation: `npm run types:check-local`
- [ ] Read documentation: `Environment-Aware-Pre-Commit-Hook-Guide.md`

## Troubleshooting Installation

### Hook Not Executable
```bash
# Problem: Hook exists but doesn't run
chmod +x .git/hooks/pre-commit

# Verify
ls -la .git/hooks/pre-commit | grep "x"
```

### Symlink Broken
```bash
# Problem: Symlink points to wrong location
cd .git/hooks
ls -la pre-commit
# Check target path

# Fix if needed
rm pre-commit
ln -sf ../../scripts/pre-commit-hook.sh pre-commit
```

### Scripts Not Found
```bash
# Problem: Hook can't find validation scripts
cd /home/adarsh/dev/wildlifeai/wildlife-watcher-mobile-app

# Verify scripts exist
ls -la scripts/*.sh

# Make scripts executable
chmod +x scripts/*.sh
```

### Local Supabase Not Running
```bash
# Problem: Hook fails - can't reach local Supabase
cd ~/dev/wildlifeai/wildlife-watcher-backend
npx supabase start

# Verify
curl http://localhost:54321/health
```

## Advanced Configuration

### Change Default Behavior
Edit `scripts/pre-commit-hook.sh`:

```bash
# Example: Make cloud validation mandatory
# Find line ~100 (in main execution)
if [ "$CONTEXT" = "cloud" ]; then
  # Add actual cloud validation instead of suggestion
  npm run types:check-cloud-dev --silent
  if [ $? -ne 0 ]; then
    echo "❌ Cloud validation failed"
    exit 1
  fi
fi
```

### Add Custom Keywords
Edit `scripts/pre-commit-hook.sh` line ~60:

```bash
# Add your team's deployment keywords
if echo "$commit_msg" | grep -qiE "(cloud|preview|production|deploy|release|staging|YOUR_KEYWORD)"; then
```

### Adjust Performance
Edit `scripts/pre-commit-hook.sh`:

```bash
# Increase health check timeout (line ~120)
curl -s --max-time 5 http://localhost:54321/health

# Add caching for repeated checks
# Store last validation result temporarily
```

## Uninstallation

### Remove Hook
```bash
# Remove symlink or file
rm .git/hooks/pre-commit

# Restore original if backed up
[ -f .git/hooks/pre-commit.backup ] && mv .git/hooks/pre-commit.backup .git/hooks/pre-commit
```

### Verification
```bash
# Verify hook removed
ls .git/hooks/pre-commit
# Expected: No such file or directory

# Test commit works without hook
git commit --allow-empty -m "test: verify hook removed"
```

## Post-Installation

### First Commit Test
```bash
# Make a trivial change
echo "# Test" >> README.md
git add README.md

# Commit (hook should validate)
git commit -m "test: verify hook installation"

# Expected:
# 🔍 Validating database types...
# ✅ Types are synchronized with LOCAL Supabase
# ✅ Pre-commit checks passed

# Undo test commit
git reset HEAD~1
git checkout README.md
```

### Update Workflow
```bash
# When template changes:
# Option 1 (symlink): Automatically updated
# Option 2 (copy): Reinstall
cp scripts/pre-commit-hook.sh .git/hooks/pre-commit
```

## Support

### Getting Help
1. Read comprehensive guide: `Environment-Aware-Pre-Commit-Hook-Guide.md`
2. Test hook manually: `.git/hooks/pre-commit`
3. Check prerequisites (see above)
4. Review error messages (they're actionable)
5. Use emergency override if critical: `SKIP_TYPE_CHECK=1 git commit`

### Reporting Issues
Include in bug report:
- Hook version (check `scripts/pre-commit-hook.sh` header)
- Installation method (symlink or copy)
- Error output from `.git/hooks/pre-commit`
- Prerequisites verification results
- System info: `uname -a`

---

**Installation Status**: Ready for deployment
**Last Updated**: 2025-10-29
**Task**: 3.3 Environment-Aware Pre-Commit Hook
