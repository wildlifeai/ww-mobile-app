# Maestro E2E Testing Guide

> **Related**: [Testing-Guide.md](../setup/Testing-Guide.md) (Jest unit/integration tests), [00-GETTING-STARTED.md](../onboarding/00-GETTING-STARTED.md) (project overview).

## Overview

[Maestro](https://maestro.mobile.dev/) provides declarative YAML-based E2E testing for the mobile app. Tests run against a real device or emulator, validating actual user flows.

**Version**: `maestro` v2.1.1 (devDependency in `package.json`)
**Requires**: Java 17+, ADB, connected Android device or emulator

## Quick Start

```bash
# 1. Connect Android device/emulator
adb devices

# 2. Run all E2E tests
npm run test:maestro

# 3. Run auth tests only
npm run test:maestro:auth

# 4. Run a single test file
maestro test tests/maestro/auth-workflow.yaml

# 5. Interactive debug mode
maestro studio tests/maestro/auth-workflow.yaml
```

## Existing Test Flows

| File | Lines | Purpose | Status |
|------|-------|---------|--------|
| `tests/maestro/auth-workflow.yaml` | 104 | RBAC login flows for all 3 roles + multi-org switching | ⚠️ Some assertions commented out |
| `tests/maestro/app-startup-debug.yaml` | 5 | Launch app + capture startup screenshot | ✅ Minimal |
| `tests/maestro/project-crud-workflow.yaml` | 58 | Create, read, update, delete project flow | ⚠️ Uses text selectors (fragile) |

### npm Scripts

```json
{
  "test:maestro": "maestro test tests/maestro/",
  "test:maestro:auth": "maestro test tests/maestro/auth-workflow.yaml",
  "test:maestro:offline": "maestro test tests/maestro/offline/complete-offline-workflow.yaml"
}
```

> [!WARNING]
> `test:maestro:offline` points to a non-existent file (`tests/maestro/offline/` does not exist). Update or remove this script.

## Device Setup

### Option A: Direct Device (Simplest)

```bash
# Enable USB debugging on device, connect via USB
adb devices   # Should show your device
npm run test:maestro:auth
```

### Option B: Android Emulator

```bash
emulator -list-avds
emulator -avd <name> &
adb devices   # Should show emulator
```

### Option C: WSL2 → Windows Emulator Bridge

If developing in WSL2 with the emulator running on Windows:

```bash
# 1. Start emulator on Windows (via Android Studio)
# 2. In WSL2:
export ADB_SERVER_SOCKET=tcp:$(cat /etc/resolv.conf | grep nameserver | awk '{print $2}'):5037
adb devices

# If connection fails, add firewall rule in Windows PowerShell (Admin):
# New-NetFirewallRule -DisplayName "ADB for WSL2" -Direction Inbound -Action Allow -Protocol TCP -LocalPort 5037
```

## Writing Tests

### Use testIDs (not text selectors)

```yaml
# ❌ Fragile — breaks with text changes
- tapOn: "Login"

# ✅ Stable — tied to component testID prop
- tapOn:
    id: "login-button"
```

Add `testID` props in components:
```tsx
<TextInput testID="email-input" />
<Pressable testID="login-button" />
```

### Wait for elements

```yaml
# ❌ Assumes immediate availability
- tapOn: "Submit"

# ✅ Wait first
- waitForVisible: "Submit"
- tapOn: "Submit"
```

### Clean state between tests

```yaml
- launchApp:
    clearState: true
```

### Environment variables

```bash
maestro test --env TEST_USER_EMAIL=admin@example.com tests/maestro/
```

```yaml
- inputText: ${TEST_USER_EMAIL}
```

## Maestro Cloud (Optional)

100 free tests/month. Useful for CI/CD without device setup:

```bash
maestro login
maestro cloud tests/maestro/auth-workflow.yaml
```

## Installation

Maestro is already in `devDependencies`. For the CLI tool itself:

```bash
curl -Ls "https://get.maestro.mobile.dev" | bash
```

Or use the project's WSL2 install script:
```bash
./scripts/install-maestro-wsl2.sh
```

## Troubleshooting

| Problem | Solution |
|---------|----------|
| `adb devices` empty | `adb kill-server && adb start-server`, check USB debugging |
| Maestro can't find device | Verify `adb devices` first; try `maestro test --device <id>` |
| `maestro: command not found` | `source ~/.bashrc` or reinstall: `curl -Ls "https://get.maestro.mobile.dev" \| bash` |
| Java version error | Install Java 17+: `sudo apt install -y openjdk-17-jdk` |
| "Element not found" | Add `waitForVisible` before `tapOn`; use testID instead of text |
| Flaky tests | Use `launchApp: clearState: true`; disable animations in test mode |

## Official Resources

- [Maestro docs](https://maestro.mobile.dev/)
- [Expo + Maestro](https://expo.dev/blog/testing-with-maestro)
- [react-native-maps installation](https://github.com/mobile-dev-inc/Maestro)

---

**Last Updated**: 2026-02-19
