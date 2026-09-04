# Decide: an organisation manager sees only project-scoped roles in the app, and the backend RLS agrees

#### File: explanation.md
#### Author: Claude (Fable 5.1), with Victor Anton at the bench
#### 4 September 2026

Labels: `review-finding`, decision, app, backend.

## 1. What is the problem

The seed makes `tama@ww.org` the `organisation_manager` of the General organisation. The
website's role table says an organisation manager sees "Org projects". Neither the app nor the
database implements that.

- The app's project query treats an organisation-scope `project_admin` or `ww_admin` as full
  access to the organisation. `organisation_manager` is not in that list, and the local
  `UserRole` type does not even name it, so a manager falls through to the project-scoped
  roles.
- The `projects` SELECT policy grants a row only to `ww_admin` or to a user with a
  project-scoped role on that row. An organisation manager with no project role gets nothing
  from Supabase either, so the app could not show more even if it wanted to.

On the bench this was masked by finding A: once tama's roles synced, the app showed four
projects, all through project-scoped roles or `created_by`. A manager who has not been added
to a project sees that project nowhere.

## 2. How to reproduce

1. Sign in as `tama@ww.org` on the website. Note the project list.
2. Remove tama's `project_admin` role on Sinbad Skink Survey (or pick an org project tama has
   no project role on).
3. Website and app both drop that project, although tama manages the organisation.

## 3. Where in the code

- App full-access check:
  [`ProjectService.ts:140-144`](../../../../src/services/ProjectService.ts#L140-L144);
  role type [`UserRole.ts:8`](../../../../src/database/models/UserRole.ts#L8).
- Backend policy `projects_select_policy`,
  `supabase/migrations/20260610030000_squashed_baseline.sql:6845` in ww-backend.
- Website expectation, `documentation/resources/testing-with-seed-users.md` in ww-website,
  role table and the "Org manager sees own org projects" test row, which the current policy
  would fail.

## 4. Suggested fix

This is a contract decision, not a one-repo fix. Either the product rule is "managers see all
projects in their organisation", in which case the RLS policy and the app query both add an
`has_organisation_role(..., 'organisation_manager')` branch, or the rule is "project access is
always explicit", in which case the website document and the seed's expectations change and
the app's `project_admin`-at-org-scope branch is dead code to remove. Decide first, then land
the change with backend, app and website in view.

## Evidence

| What | Where |
|---|---|
| Seed roles for tama | the dev seed (`seeds/dev/data.sql` under `supabase` in ww-backend), lines 909, 989, 1393 |
| App query with tama's roles after the reset | [`flow_bench.txt`](../flow_bench.txt), `[00:34.096` to `[00:34.274` |
