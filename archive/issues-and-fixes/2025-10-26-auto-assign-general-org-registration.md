# Auto-Assign Users to 'General' Organization on Registration

**Date**: 2025-10-26
**Status**: ASSESSMENT COMPLETE - Implementation Required
**Priority**: MEDIUM
**Complexity**: LOW

---

## Current State Analysis

### 1. Registration Flow

**Mobile App** (`src/services/auth.ts:267-317`)
```typescript
export const register = async (credentials: RegisterRequest): Promise<AuthResponse> => {
  const { data, error } = await supabase.auth.signUp({
    email: credentials.email,
    password: credentials.password,
    options: {
      data: {
        username: credentials.username,
        organization: credentials.organization, // User-provided org name (optional)
      },
      emailRedirectTo: 'wildlifewatcher://auth/callback',
    },
  });
  // ... handles response
}
```

**Registration UI** (`src/navigation/screens/Register.tsx:130-147`)
- Includes an **optional** "Organization" text field
- User can enter organization name (not used for auto-assignment currently)
- This field is just stored in user metadata, not linked to database orgs

### 2. Database Trigger (Backend)

**Current Trigger** (`supabase/schemas/public/triggers/01_auth_user_trigger.sql`)
```sql
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- ✅ Creates public.users entry
  INSERT INTO public.users (id, name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'name', NEW.email));

  -- ❌ DOES NOT create user_organisations entry
  -- ❌ DOES NOT assign to 'General' org

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

**What Happens Now:**
1. User submits registration form
2. Supabase Auth creates `auth.users` record
3. Trigger fires → creates `public.users` record
4. **User has NO organization** → mobile app fails to load properly

### 3. Existing 'General' Organization

**Seed Data** (`supabase/seeds/local/data.sql`)
```sql
general_org_id uuid := 'b0000000-0000-0000-0000-000000000001';

INSERT INTO organisations (id, name, slug, created_by, is_active, metadata)
VALUES (
  general_org_id,
  'General',
  'general',
  alice_id,
  true,
  '{"description": "Default organisation for new users (unassigned pool)", "type": "default"}'::jsonb
);
```

**Status**: ✅ 'General' org already exists in seed data with well-known UUID

---

## Problem Statement

**New users are not automatically assigned to any organization**, causing:
1. ❌ `fetchUserOrganisations()` returns empty array
2. ❌ Mobile app cannot load (requires at least one org)
3. ❌ Users cannot create projects (projects require org_id)
4. ❌ Poor UX - users are "orphaned" until manually assigned

---

## Proposed Solution

### Option 1: Database Trigger Auto-Assignment (RECOMMENDED)

**Pros:**
- ✅ Automatic - works for all registration methods (app, admin console, etc.)
- ✅ Backend-enforced business logic
- ✅ No mobile app changes required
- ✅ Works even if mobile app is bypassed

**Cons:**
- ⚠️ Requires backend migration
- ⚠️ Need to handle cloud vs local UUID differences

**Implementation:**

```sql
-- Update: supabase/schemas/public/triggers/01_auth_user_trigger.sql

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  default_org_id uuid;
BEGIN
  -- Create public.users entry
  INSERT INTO public.users (id, name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'name', NEW.email));

  -- Get the 'General' organisation ID
  -- Try by slug first (more reliable), fallback to name
  SELECT id INTO default_org_id
  FROM public.organisations
  WHERE slug = 'general' AND is_active = true AND deleted_at IS NULL
  LIMIT 1;

  -- If General org exists, assign user to it
  IF default_org_id IS NOT NULL THEN
    INSERT INTO public.user_organisations (user_id, organisation_id)
    VALUES (NEW.id, default_org_id);

    RAISE NOTICE 'User % auto-assigned to General organisation', NEW.email;
  ELSE
    RAISE WARNING 'General organisation not found - user % not assigned to any org', NEW.email;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

**Migration Steps:**
1. Backend team creates new migration file
2. Test on local Supabase
3. Deploy to cloud dev instance
4. Verify with new user registration

### Option 2: Mobile App Post-Registration (NOT RECOMMENDED)

**Pros:**
- ✅ No backend changes

**Cons:**
- ❌ Only works for mobile app registrations
- ❌ Doesn't work if user registered via admin console
- ❌ Race condition - user might try to use app before org assignment
- ❌ Additional network call = slower registration
- ❌ Mobile app needs to handle assignment failures

**Why Not Recommended:** Backend-enforced business logic is more reliable and works universally.

### Option 3: Supabase Edge Function (MIDDLE GROUND)

**Pros:**
- ✅ Works for all Supabase Auth methods
- ✅ Can include additional logic (welcome email, etc.)

**Cons:**
- ⚠️ More complex than trigger
- ⚠️ Requires edge function deployment
- ⚠️ Need to hook into auth webhook

**Implementation:** (If desired later)
```typescript
// supabase/functions/on-user-created/index.ts
import { createClient } from '@supabase/supabase-js'

Deno.serve(async (req) => {
  const { record } = await req.json()

  // Get General org
  const { data: org } = await supabase
    .from('organisations')
    .select('id')
    .eq('slug', 'general')
    .single()

  // Assign user
  if (org) {
    await supabase
      .from('user_organisations')
      .insert({ user_id: record.id, organisation_id: org.id })
  }

  return new Response(JSON.stringify({ ok: true }))
})
```

---

## Recommended Implementation Plan

### Phase 1: Backend Changes (REQUIRED)

**Task for Backend Team:**

1. **Update Trigger Function**
   - File: `supabase/schemas/public/triggers/01_auth_user_trigger.sql`
   - Add org assignment logic (see Option 1 code above)

2. **Ensure 'General' Org Exists in All Environments**
   - Local: Already in `supabase/seeds/local/data.sql` ✅
   - Cloud Dev: Need to verify/seed
   - Production: Need to seed before trigger update

3. **Create Migration**
   ```bash
   cd ~/dev/wildlifeai/wildlife-watcher-backend
   npx supabase db diff -f update_user_trigger_auto_assign_general_org
   ```

4. **Test Migration**
   - Reset local: `npx supabase db reset`
   - Register new test user via mobile app
   - Verify user_organisations entry created:
     ```sql
     SELECT u.email, uo.organisation_id, o.name
     FROM auth.users u
     JOIN public.user_organisations uo ON u.id = uo.user_id
     JOIN public.organisations o ON uo.organisation_id = o.id
     WHERE u.email = 'newuser@test.com';
     ```

5. **Deploy to Cloud**
   ```bash
   npx supabase db push --linked
   ```

### Phase 2: Mobile App Changes (OPTIONAL UX IMPROVEMENT)

**Current State:**
- Registration form has "Organization (Optional)" field
- This field value is stored in user metadata but not used

**Options:**

**A. Remove Organization Field (RECOMMENDED)**
- Since all users auto-assigned to 'General', field is redundant
- Simplifies registration form
- Users can be moved to proper orgs later by admins

**B. Keep Field for Future Use**
- Could be used for "request organization creation" feature
- Admin could review and create org based on user input
- Keeps UX flexibility

**C. Make it an Org Selection Dropdown (FUTURE)**
- Allow users to request joining existing public orgs
- Requires org discovery API
- More complex UX

### Phase 3: Verification (REQUIRED)

**Test Cases:**

1. **New User Registration**
   ```
   ✅ User registers via mobile app
   ✅ auth.users entry created
   ✅ public.users entry created
   ✅ user_organisations entry created (org_id = General)
   ✅ User can log in
   ✅ fetchUserOrganisations() returns [General]
   ✅ User can create projects in General org
   ```

2. **Edge Cases**
   ```
   ⚠️ General org doesn't exist → User created but warning logged
   ⚠️ General org soft-deleted → Trigger should skip deleted orgs
   ⚠️ Multiple General orgs exist → Take first active one
   ```

3. **Existing Users**
   ```
   ℹ️ Trigger only fires for NEW users
   ℹ️ Existing users unaffected
   ℹ️ Manual migration needed if want to backfill
   ```

---

## Impact Assessment

### Backend Changes
- **Complexity**: LOW (15-line trigger update)
- **Risk**: LOW (trigger is atomic, won't break existing users)
- **Testing**: 30 minutes (local + cloud verification)
- **Deployment**: 5 minutes

### Mobile App Changes
- **Complexity**: NONE (works with existing code)
- **Risk**: NONE (no mobile changes needed)
- **Testing**: Verify registration flow works

### Database
- **New Table**: None
- **New Column**: None
- **New Trigger Logic**: Yes (extends existing trigger)
- **Data Migration**: None (only affects new users)

---

## Rollback Plan

If issues occur:

```sql
-- Revert to original trigger
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'name', NEW.email));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

Then manually assign any affected users:
```sql
-- Find users with no org
SELECT u.id, u.name, au.email
FROM public.users u
JOIN auth.users au ON u.id = au.id
LEFT JOIN public.user_organisations uo ON u.id = uo.user_id
WHERE uo.user_id IS NULL;

-- Assign them to General
INSERT INTO public.user_organisations (user_id, organisation_id)
SELECT u.id, 'b0000000-0000-0000-0000-000000000001'::uuid
FROM public.users u
LEFT JOIN public.user_organisations uo ON u.id = uo.user_id
WHERE uo.user_id IS NULL;
```

---

## Alternative: Backfill Existing Users (OPTIONAL)

If you want to assign **existing** unassigned users to General:

```sql
-- Find orphaned users
WITH orphaned_users AS (
  SELECT u.id, au.email
  FROM public.users u
  JOIN auth.users au ON u.id = au.id
  LEFT JOIN public.user_organisations uo ON u.id = uo.user_id
  WHERE uo.user_id IS NULL
)
-- Assign to General
INSERT INTO public.user_organisations (user_id, organisation_id)
SELECT
  ou.id,
  (SELECT id FROM public.organisations WHERE slug = 'general' AND is_active = true LIMIT 1)
FROM orphaned_users ou;
```

---

## Recommendation Summary

✅ **RECOMMENDED: Option 1 - Database Trigger Auto-Assignment**

**Why:**
- Automatic and universal (works for all registration methods)
- Backend-enforced business logic (can't be bypassed)
- No mobile app changes required
- Low complexity, low risk
- Works with existing 'General' org in seed data

**Action Items:**
1. Backend team updates `01_auth_user_trigger.sql`
2. Backend team creates migration and tests locally
3. Backend team deploys to cloud dev
4. Mobile team verifies new registrations work
5. (Optional) Mobile team removes "Organization" field from registration form

**Estimated Time:**
- Backend implementation: 30 minutes
- Testing: 30 minutes
- Deployment: 5 minutes
- **Total: ~1 hour**

---

## Questions for Stakeholders

1. **Should we remove the "Organization (Optional)" field from the registration form?**
   - Pro: Simpler UX
   - Con: Lose potential org creation requests

2. **Should we backfill existing orphaned users into General org?**
   - Need to identify how many users are affected
   - Run query above to check

3. **Should General org admin rights be auto-assigned too?**
   - Currently: User gets into org but has no specific role
   - Could auto-assign 'project_member' role at org level

4. **Long-term: Should we allow org selection during registration?**
   - Would require public org discovery
   - More complex UX and backend logic

---

## Related Files

**Mobile App:**
- `src/services/auth.ts:267-317` - register() function
- `src/navigation/screens/Register.tsx` - Registration form UI
- `src/services/auth.ts:50-196` - fetchUserOrganisations()

**Backend:**
- `supabase/schemas/public/triggers/01_auth_user_trigger.sql` - User creation trigger
- `supabase/seeds/local/data.sql` - General org seed data (UUID: b0000000-0000-0000-0000-000000000001)

---

**Status**: ASSESSMENT COMPLETE - Ready for backend team implementation
