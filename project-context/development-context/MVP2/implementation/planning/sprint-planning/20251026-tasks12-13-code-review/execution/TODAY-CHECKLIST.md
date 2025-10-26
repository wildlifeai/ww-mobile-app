# Today's Checklist - Tasks 12-13 Fix Sprint

**Date**: Oct 26, 2025
**Goal**: Victor can test working app by end of day
**Total Time**: 8 hours

---

## ⏰ Hour-by-Hour Plan

### **Hour 1: Diagnostic** (9:00 AM - 10:00 AM)

- [ ] **Open** `ONE-DAY-SPRINT-DIAGNOSTIC.md`
- [ ] **Run** `npm run type-check` → Document top 5 errors
- [ ] **Run** `npm start` → Check if app runs
- [ ] **Test** Login with `laura.admin@wildlife-research.org` / `test123`
- [ ] **Document** what's broken in diagnostic doc
- [ ] **Identify** top 3 blocking issues
- [ ] **Decide**: Can fix in 7 hours? YES/NO

**End of Hour 1**: Know EXACTLY what to fix

---

### **Hours 2-3: Fix Critical Errors** (10:00 AM - 12:00 PM)

Based on diagnostic, pick from:

**If TypeScript Errors**:
- [ ] Install missing type declarations (15 min)
- [ ] Fix `_id` → `id` in 5 files (30 min)
- [ ] Fix enum type constraints (20 min)
- [ ] Fix type re-exports (15 min)
- [ ] Use `// @ts-ignore` for rest (10 min)
- [ ] Run `npm run type-check` → Should be <5 errors

**If Login Broken**:
- [ ] Check `.env.local` has correct Supabase URL/keys
- [ ] Verify test user exists in backend
- [ ] Add console logs to auth code
- [ ] Fix auth state persistence
- [ ] Test login again

**If Projects Not Loading**:
- [ ] Check backend RLS policies
- [ ] Verify Laura's org membership in DB
- [ ] Add console logs to Redux API
- [ ] Fix query if needed
- [ ] Test project list appears

**End of Hour 3**: Top 2 issues fixed

---

### **Hours 4-5: Fix Remaining Issues** (12:00 PM - 2:00 PM)

- [ ] **Fix** Issue #3 from diagnostic
- [ ] **Test** end-to-end flow:
  - Login as Laura
  - See project list
  - Open a project
  - (If time) Create new project
- [ ] **Document** any remaining issues in `KNOWN-ISSUES.md`

**Lunch Break** (15 min while testing)

**End of Hour 5**: Core flows working

---

### **Hour 6: Member Management** (2:00 PM - 3:00 PM)

**Only if time permits!** Otherwise skip to Hour 7.

- [ ] **Check** member list shows in project details
- [ ] **Fix** import paths if broken
- [ ] **Test** member add/remove (if working)
- [ ] **Document** status (working / not working)

**End of Hour 6**: Member management status known

---

### **Hour 7: Validation & Prep** (3:00 PM - 4:00 PM)

- [ ] **Run** final checks:
  ```bash
  npm run type-check  # <5 errors OK
  npm run lint       # No critical errors
  npm test           # Most passing OK
  ```
- [ ] **Test** complete flow one more time
- [ ] **Create** `KNOWN-ISSUES.md` for Victor
- [ ] **Create** simple testing guide for Victor (5 min)
- [ ] **Start** APK build:
  ```bash
  eas build --profile development --platform android --non-interactive
  ```

**End of Hour 7**: APK building

---

### **Hour 8: Delivery** (4:00 PM - 5:00 PM)

- [ ] **Download** APK when build completes
- [ ] **Upload** to Google Drive/Dropbox
- [ ] **Email** Victor with:
  - APK link
  - Testing guide
  - Known issues doc
  - Your contact for questions
- [ ] **Call/Message** Victor: "New build ready, here's what's fixed"
- [ ] **Update** todo list with tomorrow's priorities

**End of Hour 8**: ✅ DONE!

---

## 🚨 If Things Go Wrong

**At Hour 3**: Still diagnosing issues?
→ **STOP**. Revise plan. Focus ONLY on login working.

**At Hour 5**: Major blocking issue found?
→ **DECIDE**: Continue or deliver partial build with known issues documented

**At Hour 7**: APK build failing?
→ **USE**: Previous APK if exists, document what you fixed in text

---

## ✅ Minimum Success Criteria

By end of day, Victor MUST be able to:
1. **Install** APK
2. **Login** with test account
3. **See** at least project list (even if empty)

Everything else is BONUS.

---

## 📞 Quick Reference

**Test Account**: laura.admin@wildlife-research.org / test123

**Diagnostic Doc**: `ONE-DAY-SPRINT-DIAGNOSTIC.md`

**Fix Playbook**: `ONE-DAY-SPRINT-FIX-PLAYBOOK.md`

**Backend Test Data**: ~/wildlife-watcher-backend/supabase/seeds/USER-CREDENTIALS-REFERENCE.md

---

**Start Time**: _____
**Currently on Hour**: _____
**Status**: _____
