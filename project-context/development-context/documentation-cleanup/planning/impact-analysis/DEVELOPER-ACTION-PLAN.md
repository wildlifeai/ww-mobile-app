# Developer Action Plan - Requirements Changes

**Date**: January 27, 2025
**Purpose**: Step-by-step execution guide for implementing requirement changes
**Prerequisites**: Read `EXECUTIVE-SUMMARY-REQUIREMENTS-CHANGES.md` first

---

## 🎯 Quick Start

**Before You Begin:**
1. ✅ Read Executive Summary (5 min)
2. ✅ Review full analysis sections relevant to your work
3. ✅ Coordinate with backend/hardware teams
4. ✅ Tag current codebase: `git tag v1.4-baseline`

---

## 🗓️ Week-by-Week Execution Plan

### WEEK 1: Foundation Layer (6.5-9.5 hours)

#### Day 1: Backend Migrations (Backend Team - 2-3 hours)

**Step 1.1: Create Migration Files**
```bash
cd ~/dev/wildlifeai/wildlife-watcher-backend
npx supabase migration new mvp2_requirements_update
```

**Step 1.2: Add Migration SQL**

Create 4 migrations in order:

**Migration A: General Organisation**
```sql
-- 001_seed_general_organisation.sql
INSERT INTO organisations (id, name, description, created_at)
VALUES
  ('00000000-0000-0000-0000-000000000001', 'General', 'Default organisation for MVP2 users', NOW())
ON CONFLICT (id) DO NOTHING;

-- Assign existing users
INSERT INTO user_organisations (user_id, organisation_id, created_at)
SELECT id, '00000000-0000-0000-0000-000000000001', NOW()
FROM auth.users
WHERE NOT EXISTS (
  SELECT 1 FROM user_organisations WHERE user_id = auth.users.id
)
ON CONFLICT DO NOTHING;

-- Assign existing projects
UPDATE projects
SET organisation_id = '00000000-0000-0000-0000-000000000001'
WHERE organisation_id IS NULL;
```

**Migration B: Project Settings**
```sql
-- 002_enhanced_project_settings.sql
ALTER TABLE projects ADD COLUMN IF NOT EXISTS is_baited BOOLEAN DEFAULT false;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS monitoring_marked BOOLEAN DEFAULT false;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS capture_method TEXT
  CHECK (capture_method IN ('motion', 'timelapse'));
ALTER TABLE projects ADD COLUMN IF NOT EXISTS motion_sensitivity TEXT
  CHECK (motion_sensitivity IN ('low', 'medium', 'high'));
ALTER TABLE projects ADD COLUMN IF NOT EXISTS timelapse_interval INTEGER;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS default_ai_model_id UUID
  REFERENCES ai_models(id) ON DELETE SET NULL;

-- Convert sampling_design to array (if not already)
DO $$
BEGIN
  IF (SELECT data_type FROM information_schema.columns
      WHERE table_name = 'projects' AND column_name = 'sampling_design') != 'ARRAY' THEN
    ALTER TABLE projects ALTER COLUMN sampling_design TYPE TEXT[]
      USING CASE WHEN sampling_design IS NULL THEN NULL ELSE ARRAY[sampling_design] END;
  END IF;
END $$;
```

**Migration C: Project Invitations**
```sql
-- 003_project_invitations.sql
CREATE TABLE IF NOT EXISTS project_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  inviter_id UUID REFERENCES auth.users(id),
  invitee_email TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('project_admin', 'project_member')),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  responded_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_invitations_email ON project_invitations(invitee_email);
CREATE INDEX IF NOT EXISTS idx_invitations_status ON project_invitations(status);

-- RLS
ALTER TABLE project_invitations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view their invitations" ON project_invitations
  FOR SELECT USING (invitee_email = auth.email());

CREATE POLICY "Admins create invitations" ON project_invitations
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM project_members
      WHERE project_id = project_invitations.project_id
        AND user_id = auth.uid()
        AND role = 'project_admin'
        AND removed_at IS NULL
    )
  );

CREATE POLICY "Users update their invitations" ON project_invitations
  FOR UPDATE USING (invitee_email = auth.email());
```

**Migration D: User Preferences**
```sql
-- 004_user_preferences.sql
CREATE TABLE IF NOT EXISTS user_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  sync_on_wifi_only BOOLEAN DEFAULT false,
  ask_before_syncing BOOLEAN DEFAULT false,
  auto_sync BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own preferences" ON user_preferences
  FOR ALL USING (user_id = auth.uid());
```

**Step 1.3: Apply Migrations**
```bash
npx supabase db push
npx supabase db reset # if local dev
```

**Step 1.4: Regenerate Types**
```bash
npm run db:types:update
git add project-context/database.types.ts
git commit -m "chore(db): regenerate types after MVP2 requirements update"
```

**Step 1.5: Verify**
```bash
# Check migrations applied
npx supabase migration list

# Test queries
npx supabase db execute "SELECT * FROM organisations WHERE id = '00000000-0000-0000-0000-000000000001';"
npx supabase db execute "SELECT column_name FROM information_schema.columns WHERE table_name = 'projects' AND column_name IN ('is_baited', 'monitoring_marked');"
```

---

#### Day 2: Mobile Type Sync (Mobile Team - 0.5 hours)

**Step 2.1: Pull Backend Changes**
```bash
cd ~/dev/wildlifeai/wildlife-watcher-backend
git pull origin main

cd ~/dev/wildlifeai/wildlife-watcher-mobile-app
```

**Step 2.2: Regenerate Mobile Types**
```bash
npm run types:local
```

**Step 2.3: Verify TypeScript**
```bash
npm run type-check
# Should compile with 0 errors
```

**Step 2.4: Commit**
```bash
git add src/types/supabase.ts
git commit -m "chore(types): sync types after MVP2 requirements update"
```

---

#### Day 3: SQLite Schema Updates (Mobile Team - 2-3 hours)

**Step 3.1: Update DatabaseService Schema**

**File**: `src/services/offline/DatabaseService.ts`

Add to `createTables()` method:

```typescript
// Add to existing createTables method

// User preferences table
await db.execAsync(`
  CREATE TABLE IF NOT EXISTS user_preferences (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL UNIQUE,
    sync_on_wifi_only INTEGER DEFAULT 0,
    ask_before_syncing INTEGER DEFAULT 0,
    auto_sync INTEGER DEFAULT 1,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    synced INTEGER DEFAULT 0
  );
`);

// Project invitations table
await db.execAsync(`
  CREATE TABLE IF NOT EXISTS project_invitations (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    inviter_id TEXT NOT NULL,
    invitee_email TEXT NOT NULL,
    role TEXT NOT NULL,
    status TEXT DEFAULT 'pending',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    responded_at TEXT,
    synced INTEGER DEFAULT 0,
    FOREIGN KEY (project_id) REFERENCES projects(id)
  );

  CREATE INDEX IF NOT EXISTS idx_invitations_email_local
    ON project_invitations(invitee_email);
`);

// Update projects table schema
await db.execAsync(`
  ALTER TABLE projects ADD COLUMN is_baited INTEGER DEFAULT 0;
  ALTER TABLE projects ADD COLUMN monitoring_marked INTEGER DEFAULT 0;
  ALTER TABLE projects ADD COLUMN capture_method TEXT;
  ALTER TABLE projects ADD COLUMN motion_sensitivity TEXT;
  ALTER TABLE projects ADD COLUMN timelapse_interval INTEGER;
  ALTER TABLE projects ADD COLUMN default_ai_model_id TEXT;
`);
```

**Step 3.2: Add CRUD Methods**

Add to DatabaseService:

```typescript
// User Preferences
async saveUserPreferences(prefs: UserPreferences): Promise<void> {
  await this.db.runAsync(
    `INSERT OR REPLACE INTO user_preferences
     (id, user_id, sync_on_wifi_only, ask_before_syncing, auto_sync, updated_at, synced)
     VALUES (?, ?, ?, ?, ?, datetime('now'), 0)`,
    [prefs.id, prefs.user_id, prefs.sync_on_wifi_only ? 1 : 0,
     prefs.ask_before_syncing ? 1 : 0, prefs.auto_sync ? 1 : 0]
  );
}

async getUserPreferences(userId: string): Promise<UserPreferences | null> {
  const result = await this.db.getFirstAsync<UserPreferences>(
    'SELECT * FROM user_preferences WHERE user_id = ?',
    [userId]
  );
  return result || null;
}

// Project Invitations
async saveProjectInvitation(invitation: ProjectInvitation): Promise<void> {
  await this.db.runAsync(
    `INSERT OR REPLACE INTO project_invitations
     (id, project_id, inviter_id, invitee_email, role, status, created_at, synced)
     VALUES (?, ?, ?, ?, ?, ?, ?, 0)`,
    [invitation.id, invitation.project_id, invitation.inviter_id,
     invitation.invitee_email, invitation.role, invitation.status,
     invitation.created_at]
  );
}

async getPendingInvitations(email: string): Promise<ProjectInvitation[]> {
  return await this.db.getAllAsync<ProjectInvitation>(
    `SELECT * FROM project_invitations
     WHERE invitee_email = ? AND status = 'pending'
     ORDER BY created_at DESC`,
    [email]
  );
}
```

**Step 3.3: Test Migration**
```bash
# Reset app data
npm run android -- --reset-cache

# Launch app and check database
npx react-native log-android # Watch for migration logs
```

**Step 3.4: Commit**
```bash
git add src/services/offline/DatabaseService.ts
git commit -m "feat(db): add user preferences and invitations tables"
```

---

#### Day 4-5: Redux Enhancement (Mobile Team - 2-3 hours)

**Step 4.1: Create New Slices**

**File**: `src/redux/slices/notificationsSlice.ts`
```typescript
import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface NotificationsState {
  invitations: ProjectInvitation[];
  unreadCount: number;
  isLoading: boolean;
  error: string | null;
}

const initialState: NotificationsState = {
  invitations: [],
  unreadCount: 0,
  isLoading: false,
  error: null
};

const notificationsSlice = createSlice({
  name: 'notifications',
  initialState,
  reducers: {
    setInvitations(state, action: PayloadAction<ProjectInvitation[]>) {
      state.invitations = action.payload;
      state.unreadCount = action.payload.filter(i => i.status === 'pending').length;
    },
    acceptInvitation(state, action: PayloadAction<string>) {
      const invitation = state.invitations.find(i => i.id === action.payload);
      if (invitation) {
        invitation.status = 'accepted';
        state.unreadCount--;
      }
    },
    declineInvitation(state, action: PayloadAction<string>) {
      const invitation = state.invitations.find(i => i.id === action.payload);
      if (invitation) {
        invitation.status = 'declined';
        state.unreadCount--;
      }
    },
    setLoading(state, action: PayloadAction<boolean>) {
      state.isLoading = action.payload;
    },
    setError(state, action: PayloadAction<string | null>) {
      state.error = action.payload;
    }
  }
});

export const notificationsActions = notificationsSlice.actions;
export default notificationsSlice.reducer;
```

**File**: `src/redux/slices/settingsSlice.ts`
```typescript
import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface SettingsState {
  syncOnWifiOnly: boolean;
  askBeforeSyncing: boolean;
  autoSync: boolean;
  isLoading: boolean;
}

const initialState: SettingsState = {
  syncOnWifiOnly: false,
  askBeforeSyncing: false,
  autoSync: true,
  isLoading: false
};

const settingsSlice = createSlice({
  name: 'settings',
  initialState,
  reducers: {
    updateSettings(state, action: PayloadAction<Partial<SettingsState>>) {
      Object.assign(state, action.payload);
    },
    setLoading(state, action: PayloadAction<boolean>) {
      state.isLoading = action.payload;
    }
  }
});

export const settingsActions = settingsSlice.actions;
export default settingsSlice.reducer;
```

**File**: `src/redux/slices/feedbackSlice.ts`
```typescript
import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface FeedbackState {
  isSubmitting: boolean;
  lastSubmission: string | null;
  error: string | null;
}

const initialState: FeedbackState = {
  isSubmitting: false,
  lastSubmission: null,
  error: null
};

const feedbackSlice = createSlice({
  name: 'feedback',
  initialState,
  reducers: {
    submitStart(state) {
      state.isSubmitting = true;
      state.error = null;
    },
    submitSuccess(state, action: PayloadAction<string>) {
      state.isSubmitting = false;
      state.lastSubmission = action.payload;
    },
    submitFailure(state, action: PayloadAction<string>) {
      state.isSubmitting = false;
      state.error = action.payload;
    }
  }
});

export const feedbackActions = feedbackSlice.actions;
export default feedbackSlice.reducer;
```

**Step 4.2: Register in Store**

**File**: `src/redux/store.ts`
```typescript
import notificationsReducer from './slices/notificationsSlice';
import settingsReducer from './slices/settingsSlice';
import feedbackReducer from './slices/feedbackSlice';

export const store = configureStore({
  reducer: {
    // ... existing reducers
    notifications: notificationsReducer,
    settings: settingsReducer,
    feedback: feedbackReducer
  },
  // ... middleware
});
```

**Step 4.3: Test Redux**
```bash
npm run type-check
npm test src/redux/slices/
```

**Step 4.4: Commit**
```bash
git add src/redux/slices/*.ts src/redux/store.ts
git commit -m "feat(redux): add notifications, settings, and feedback slices"
```

---

### WEEK 2: UI Enhancements (17-21 hours)

#### Days 1-2: Authentication Screens (8-10 hours)

**See full analysis Section 3.3 for detailed implementation**

Key files to create:
- `src/navigation/screens/auth/SignUpScreen.tsx`
- `src/navigation/screens/auth/ForgotPasswordScreen.tsx`
- Update `src/navigation/screens/auth/LoginScreen.tsx`

**Checklist**:
- [ ] Sign Up screen UI complete
- [ ] Supabase signup integration working
- [ ] Email verification flow tested
- [ ] Forgot Password screen complete
- [ ] Password reset email sends
- [ ] Login links to new screens
- [ ] "Remember me" persists

---

#### Days 3-4: Profile & Settings Screens (4-5 hours)

**See full analysis Section 3.4 for detailed implementation**

Key files to create:
- `src/navigation/screens/ProfileScreen.tsx`
- `src/navigation/screens/SettingsScreen.tsx`

**Checklist**:
- [ ] Profile screen shows user data
- [ ] Name editing works
- [ ] Reset password button functional
- [ ] Settings toggles persist
- [ ] Sync preferences apply

---

#### Day 5: Notifications Screen (3-4 hours)

**See full analysis Section 3.6 for detailed implementation**

Key file to create:
- `src/navigation/screens/NotificationsScreen.tsx`

**Checklist**:
- [ ] Invitations list displays
- [ ] Accept invitation works
- [ ] Decline invitation works
- [ ] Badge counter accurate
- [ ] Empty state shown

---

#### Day 5: Feedback Screen (2 hours)

Key file to create:
- `src/navigation/screens/FeedbackScreen.tsx`

**Checklist**:
- [ ] Text input functional
- [ ] Email sends to support
- [ ] Success message shows
- [ ] Error handling works

---

### WEEK 3: Project Management Updates (8-9 hours)

**See full analysis Sections 3.5 and 3.6**

---

### WEEKS 4-5: Device & BLE (34 hours)

**See full analysis Section 2.11 (BLE) and 2.6 (Workbench)**

---

### WEEK 6: Deployment Workflows (31 hours)

**See full analysis Section 2.5 (Deployment)**

---

### WEEK 7: Testing & Polish (18 hours)

**See full analysis Section 4.8**

---

## 🔧 Useful Commands

### Type Synchronization
```bash
# Backend: Regenerate types
cd ~/dev/wildlifeai/wildlife-watcher-backend
npm run db:types:update

# Mobile: Sync types from backend
cd ~/dev/wildlifeai/wildlife-watcher-mobile-app
npm run types:local

# Verify
npm run type-check
```

### Database Inspection
```bash
# Backend: Check migrations
npx supabase migration list
npx supabase db execute "SELECT * FROM organisations;"

# Mobile: Inspect SQLite (requires running app)
adb shell run-as com.wildlife.wildlifewatcher.expo
sqlite3 databases/wildlife_watcher.db
.schema projects
.schema user_preferences
```

### Testing
```bash
# Unit tests
npm test

# Type check
npm run type-check

# Build verification
npm run prebuild:check

# E2E tests (after Maestro setup)
npm run test:maestro
```

### Development
```bash
# Start dev server
npm start

# Run on Android
npm run android

# Clear cache
npm start -- --reset-cache
```

---

## 📋 Daily Checklist Template

```markdown
## [Date] - [Phase] Day [X]

### Planned Work (X hours)
- [ ] Task 1 (X.X hrs)
- [ ] Task 2 (X.X hrs)

### Actual Work Log
- [Time] Started Task 1
- [Time] Completed Task 1 (actual: X.X hrs)
- [Time] Blocker: [description]

### Commits
- `git commit -m "feat: description"`
- `git commit -m "fix: description"`

### Metrics
- Estimated: X hrs
- Actual: X hrs
- Variance: +/- X hrs

### Tomorrow's Plan
- [ ] Continue Task X
- [ ] Start Task Y
- [ ] Team sync on Z
```

---

## 🚨 Troubleshooting

### Types Not Syncing
```bash
# 1. Verify backend types exist
ls ~/dev/wildlifeai/wildlife-watcher-backend/project-context/database.types.ts

# 2. Check Supabase is running
npx supabase status

# 3. Regenerate manually
cd ~/dev/wildlifeai/wildlife-watcher-backend
npx supabase gen types typescript --local > project-context/database.types.ts

cd ~/dev/wildlifeai/wildlife-watcher-mobile-app
npm run types:local
```

### SQLite Migration Fails
```bash
# Reset app data
adb uninstall com.wildlife.wildlifewatcher.expo
npm run android

# Check logs
adb logcat *:E | grep SQLite
```

### Redux State Issues
```bash
# Enable Redux DevTools
# Add to src/redux/store.ts:
export const store = configureStore({
  // ...
  devTools: __DEV__
});
```

---

## 📞 Need Help?

**Full Documentation**:
- `REQUIREMENTS-CHANGE-IMPACT-ANALYSIS.md` - Complete 122.5KB analysis
- `EXECUTIVE-SUMMARY-REQUIREMENTS-CHANGES.md` - Quick reference
- `app-screen-guide.md` - UI specifications
- `ble-lorawan-communication-spec.md` - Hardware integration

**Team Contacts**:
- Backend: [Team Slack Channel]
- Hardware: [Team Slack Channel]
- PM: [Name / Contact]

---

**Last Updated**: January 27, 2025
**Version**: 1.0
