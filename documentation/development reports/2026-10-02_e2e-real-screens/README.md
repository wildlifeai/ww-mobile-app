# Making the Maestro E2E flows run against the real app

#### File: documentation/development reports/2026-10-02_e2e-real-screens/README.md
#### Author: Claude, with Victor Anton
#### 2 October 2026

**Status:** open

## Outcome

Pending. The thread records how the E2E flows went from fiction to runs against the real
screens; what each flow proves and how to run them is in the
[Testing Guide](../../resources/Testing-Guide.md#maestro-e2e-testing).

## What was found

- The CI build for a PR into `dev` was the `ci` EAS profile, a development client. It carries no
  JavaScript, and with no Metro server on the runner every run stopped at Expo's "Development
  servers" launcher. Run [36836146016](https://github.com/wildlifeai/ww-mobile-app/actions/runs/36836146016)
  proved it: both screenshots showed the launcher, both flows failed on their first assertion.
  So the required smoke check proved only that the native launcher opened.
- `maestro test tests/maestro/` ran only the two top-level flows; the three under `offline/`
  never ran. Maestro needs a `config.yaml` with `flows:` globs to look in a subfolder.
- The flows were written against an app that does not exist: accounts like
  `admin@organisation1.com`, screens like "Manage Team" and "System Settings", a development
  menu with a "Test Mode", and JavaScript that called `Android.shell`, which Maestro has no API
  for.
- The npm devDependency `maestro@^2.1.1` was `maestro-framework`, an AWS Step Functions tool.
  Its shell postinstall was why `npm install` aborted on Windows, and because npm puts
  `node_modules/.bin` first on `PATH`, every `npm run test:maestro*` would have invoked it instead
  of the real CLI.
- The workflow passed the Supabase credentials to the build as `EXPO_PUBLIC_SUPABASE_URL_DEV`
  and `_PROD`, names nothing in `src/` reads; `src/config/environments.ts` reads
  `EXPO_PUBLIC_SUPABASE_URL`. The CI APK's credentials came from whatever the EAS environment
  held.
- `AndroidPermissionsProvider` renders nothing but a permissions screen until Bluetooth and
  location are granted, and `src/navigation/index.tsx` shows "Please enable Bluetooth" ahead of
  the login screen while the adapter is off. Both matter on a fresh emulator.

## Decision: a release-type `e2e` build, not Metro in CI

Two ways to get JavaScript into the smoke run were weighed. Starting `npx expo start --dev-client`
on the runner and opening the client through its deep link keeps the `ci` profile but adds a
Metro process, `adb reverse`, a subflow that dismisses the launcher, and tests a dev bundle rather
than the one users get. A release-type profile (`e2e`: `preview` with `buildType: apk`) needs no
new moving parts: the `staging` profile already built release-type on the runner with the same
`EXPO_TOKEN` and the debug keystore, nothing consumed the dev-client artifact (`grep` of the docs
and workflows found only the workflow itself), the package stays `com.wildlife.wildlifewatcher` on
every run so the `APP_ID` conditional in the workflow went, and every flow just does `launchApp`.
The `ci` profile was removed from `eas.json`; a developer who wants a dev client uses
`development`.

## Dispatches

Each dispatch is `gh workflow run native-build-validation.yml --ref feat/e2e-real-screens`, which
builds `e2e` and runs both E2E jobs.

| Run | What changed | What the screenshots and hierarchy showed | Result |
|---|---|---|---|
| (pending) | First push: `e2e` profile, real flows, test ids, scripts | | |

## Open items

- Seeded account for the flows: the `E2E_TEST_EMAIL` and `E2E_TEST_PASSWORD` secrets in the
  `development` environment (maintainer).
- Delete `tests/maestro/offline/setup-test-user.yaml`, superseded by `subflows/sign-in.yaml`
  (maintainer's call; a flow file).
