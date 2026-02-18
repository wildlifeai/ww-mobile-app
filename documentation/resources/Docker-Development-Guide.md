# Docker Development Environment Guide

> **See also**: [00-GETTING-STARTED.md](../onboarding/00-GETTING-STARTED.md) (setup options), [01-TECHNOLOGY-STACK.md](../onboarding/01-TECHNOLOGY-STACK.md) (framework versions).

## Overview

Docker-based development environment that matches the project maintainer's exact tool versions. Eliminates version mismatch issues across the team.

**Files**: `Dockerfile.dev`, `docker-compose.dev.yml` (project root)

## Environment

| Tool | Version |
|------|---------|
| Node.js | 20.19.4 |
| npm | 10.8.2 |
| Expo CLI | 0.18.31 |
| EAS CLI | 16.17.3 |
| Base image | `node:20.19.4-bullseye` |
| JDK | OpenJDK 17 |

## Quick Start

```bash
# Clone and enter the project
git clone [REPO_URL] wildlife-watcher-mobile-app
cd wildlife-watcher-mobile-app
git checkout dev

# Start the Docker development environment
docker-compose -f docker-compose.dev.yml up -d wildlife-watcher-dev

# Enter the development container
docker-compose -f docker-compose.dev.yml exec wildlife-watcher-dev bash

# Inside the container:
npm install
npx expo start
```

## Services

### wildlife-watcher-dev (main)

| Port | Purpose |
|------|---------|
| 8081 | Metro bundler |
| 19000 | Expo DevTools |
| 19001 | Expo tunnel |
| 19002 | Expo web |

Volume mounts:
- `.:/app` — project folder
- `/app/node_modules` — isolated (prevents host override)
- `~/.expo:/home/developer/.expo` — shared Expo credentials

### adb-server (optional, Android profile)

```bash
# Start with ADB bridge for USB Android device access
docker-compose -f docker-compose.dev.yml --profile android up -d

# Inside main container, connect to ADB bridge
export ADB_SERVER_SOCKET=tcp:adb-server:5037
adb devices
```

## Daily Workflow

```bash
# Start containers
docker-compose -f docker-compose.dev.yml up -d

# Enter container
docker-compose -f docker-compose.dev.yml exec wildlife-watcher-dev bash

# Development
npx expo start           # Start dev server (hot reload works automatically)
npm test                 # Run Jest tests
npm run lint             # ESLint
eas build --profile development --platform android  # EAS cloud build
```

### Container Aliases

```bash
npm-start     # npm start
expo-start    # npx expo start
eas-build     # eas build --profile development --platform android
gs            # git status
ll            # ls -la
```

## Customisation

- **System packages**: edit `apt-get install` in `Dockerfile.dev`
- **CLI versions**: edit `npm install -g` in `Dockerfile.dev`
- **Aliases**: edit `.bashrc` setup in `Dockerfile.dev`
- **Services**: edit `docker-compose.dev.yml` (e.g. add database services)

## Docker vs Native

| Aspect | Docker | Native |
|--------|--------|--------|
| Setup time | ~5 min | 30+ min |
| Tool consistency | ✅ Identical | ❌ Varies |
| Performance | ⚠️ Slight overhead | ✅ Native speed |
| Resource usage | ⚠️ Higher memory | ✅ Lower |

**Use Docker** for team development, Windows environments, or when you need isolation.
**Use native** for solo work, maximum performance, or minimal resource usage.

## Troubleshooting

| Problem | Solution |
|---------|----------|
| Container won't start | `docker-compose -f docker-compose.dev.yml build wildlife-watcher-dev` |
| Port 8081 conflict | Check with `netstat -ano \| findstr :8081` (Windows) or `lsof -i :8081` (Mac/Linux) |
| Phone can't connect | Try `npx expo start --tunnel`, check firewall for ports 8081/19000-19002 |
| Volume mount issues (Windows) | Docker Desktop → Settings → Resources → File Sharing → add project drive |
| Hot reload broken | Press `r` in Metro terminal, or restart container |

---

**Last Updated**: 2026-02-19