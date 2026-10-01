# Making the Maestro E2E flows run against the real app

#### File: documentation/development reports/2026-10-02_e2e-real-screens/README.md
#### Author: Claude, with Victor Anton
#### 2 October 2026

**Status:** closed, 1 October 2026

## Outcome

Every Maestro flow passes against the real app on run
[36934636431](https://github.com/wildlifeai/ww-mobile-app/actions/runs/36934636431): the
required smoke proves the release APK's JavaScript renders the login screen on a dev-branch
run, and E2E Full passes auth, project CRUD and the three-phase offline scenario, signed in as
the seeded `tama@ww.org`, in 10 minutes from a cached APK. Four dispatches got there, each
fixing what the previous run's screen hierarchy showed. CI builds the release-type `e2e` EAS
profile instead of a development client, which was the reason nothing could pass before. What
each flow proves and how to run them is in the
[Testing Guide](../../resources/Testing-Guide.md#maestro-e2e-testing). Landed in
[#378](https://github.com/wildlifeai/ww-mobile-app/pull/378).

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
| [36921573134](https://github.com/wildlifeai/ww-mobile-app/actions/runs/36921573134) (and the PR's own run [36921574932](https://github.com/wildlifeai/ww-mobile-app/actions/runs/36921574932), same commit) | First push: `e2e` profile, real flows, test ids, scripts | **The login screen rendered** from the release APK: `email-input`, `password-input`, `login-button` in the hierarchy, 6 s after launch. Sign-in as Tama, the tutorial skip and the tab change all worked, and the wrong-password alert "Login Failed" showed. Auth: the drawer opened but the sign-out tap at (82,580) hit the "Version v0.0.69" footer drawn over the button on the 320x640 default AVD. CRUD: the organisation had no projects, the empty-state button was tapped, then the second conditional looked for the FAB on the Create Project screen. Both offline flows: airplane mode turned Bluetooth off and the app showed "Please enable Bluetooth" under the offline indicator. | Build 29 min (no cache yet). **Smoke green.** Full: 0 of 4 |
| [36926971767](https://github.com/wildlifeai/ww-mobile-app/actions/runs/36926971767) | Pixel 6 profile; `bluetooth` out of `airplane_mode_radios`; the FAB branch checks the FAB | APK restored from the cache, build skipped, 12 min end to end. **auth-workflow passed**: sign out from the drawer landed on the login screen. CRUD: the project was created and listed, then the tap on its name (the text node, `clickable=false`) opened nothing and the hierarchy 30 s later still showed the list. Offline: both flows on "Please enable Bluetooth" again, so the radios setting does not keep Bluetooth on under API 33. | **Smoke green, auth green.** Full: 1 of 4 |
| [36929311218](https://github.com/wildlifeai/ww-mobile-app/actions/runs/36929311218) | Offline scenario in three phases around `adb`; the card tapped by its accessibility label | Rebuilt the APK (25 min): the Expo fingerprint covers `package.json`, and only an npm script had changed. Auth passed. CRUD created, listed and **renamed** its project. Offline phase 1 passed; phase 2 passed with `airplane_mode_on=1 bluetooth_on=1`: the cold start stayed signed in, the offline indicator showed, the project list came from the local database and a project created offline was listed at once; phase 3 saw the project after the network returned and a pull. Both the CRUD archive and the phase 3 archive then failed on "Project ,": the archive subflow's own `env: PROJECT_NAME: ""` default won over the caller's value. | **Smoke, auth, offline 1 and 2 green.** CRUD and offline 3 fail only at the archive step |
| [36934636431](https://github.com/wildlifeai/ww-mobile-app/actions/runs/36934636431) | No env default in the archive subflow | APK from the cache. Auth passed. CRUD created, listed, renamed and archived its project and saw it gone. Offline phases 1, 2 and 3 passed: the project created in airplane mode was listed again after the network returned and a pull, then archived. 5 test cases counted across the reports. | **Everything green.** Smoke 4 min, Full 10 min |

## Open items

- [#379](https://github.com/wildlifeai/ww-mobile-app/issues/379): the drawer's version footer
  covers "Sign out" on a 640 dp tall screen, found by the first run.
- Three projects the failed runs renamed but did not archive are left on cloud-dev
  (`E2E 1790889449637`, `E2E 1790892179812 edited`, `E2E 1790892194555 edited`, plus run 3's
  `E2E offline ...` one); the next ww-backend dev deploy reseeds them away.
- The offline phase files keep their old names (`complete-offline-workflow.yaml` for the
  offline phase, `database-operations.yaml` for the back-online phase); renaming a flow file
  is the maintainer's call.

The account is `tama@ww.org`, added to the `development` environment's secrets by the
maintainer on 1 October 2026 (`laura@ww.org`, the first choice, is no longer seeded).
`offline/setup-test-user.yaml` was deleted with the maintainer's agreement the same day.
