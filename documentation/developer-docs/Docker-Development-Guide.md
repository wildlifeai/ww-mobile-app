# Docker Development Environment Guide

## Overview

This guide provides a Docker-based development environment that exactly matches the project maintainer's setup. This ensures all developers have identical tool versions and eliminates "works on my machine" issues.

## Environment Specifications

The Docker environment provides:
- **Node.js**: v20.19.4 (matches project maintainer)
- **npm**: v10.8.2
- **Expo CLI**: v0.18.31 (new CLI, not legacy)
- **EAS CLI**: v16.17.3
- **System**: Debian Bullseye with Android tools

## Prerequisites

1. **Docker & Docker Compose**
   - [Docker Desktop](https://www.docker.com/products/docker-desktop/) (Windows/macOS)
   - Or Docker Engine + Docker Compose (Linux)

2. **Android Phone** (for testing)
   - USB debugging enabled
   - Connected to the same network as your computer

## Quick Start

### 1. Start the Development Environment

```bash
# Clone and enter the project
git clone [REPO_URL] wildlife-watcher-mobile-app
cd wildlife-watcher-mobile-app
git checkout expo-migration

# Start the Docker development environment
docker-compose -f docker-compose.dev.yml up -d wildlife-watcher-dev

# Enter the development container
docker-compose -f docker-compose.dev.yml exec wildlife-watcher-dev bash
```

You're now inside a container with the exact environment setup!

### 2. Install Dependencies (Inside Container)

```bash
# Install project dependencies
npm install

# Verify environment matches
node --version    # Should show v20.19.4
npm --version     # Should show v10.8.2
npx @expo/cli --version  # Should show 0.18.31
eas --version     # Should show eas-cli/16.17.3
```

### 3. Start Development Server

```bash
# Start the Expo development server
npx expo start

# Or use the pre-configured alias
expo-start
```

### 4. Connect Your Phone

1. **Install Expo Go** on your phone (for basic testing)
2. **Or download the development build** from: https://expo.dev/accounts/apps_wildlife/projects/wildlife-watcher-expo/builds/12fa61c8-cf82-47c5-a8b1-f92fea0a04ca
3. **Scan the QR code** displayed in your terminal

## Docker Compose Services

### Main Development Service

```yaml
wildlife-watcher-dev:
  - Ports: 8081 (Metro), 19000-19002 (Expo)
  - Volume: Your project folder mounted to /app
  - Environment: Exact tool versions
```

### Optional ADB Service (Android Development)

```bash
# Start with ADB bridge for Android development
docker-compose -f docker-compose.dev.yml --profile android up -d

# This enables USB device access from within Docker
```

## Development Workflow

### Daily Development

```bash
# Start containers
docker-compose -f docker-compose.dev.yml up -d

# Enter development environment
docker-compose -f docker-compose.dev.yml exec wildlife-watcher-dev bash

# Start development server
npx expo start

# Make changes to code - hot reload will work automatically
```

### Building with EAS

```bash
# Inside the container
eas login  # First time only
eas build --profile development --platform android

# Or use the pre-configured alias
eas-build
```

### Running Tests

```bash
# Inside the container
npm test        # Jest tests
npm run lint    # ESLint
```

## Advantages of Docker Development

### ✅ Consistency
- Same Node.js, npm, Expo CLI, and EAS CLI versions for all developers
- No conflicts with your system's Node.js installation
- Reproducible builds across different machines

### ✅ Isolation
- Project dependencies don't affect your system
- Multiple projects can use different Node.js versions
- Clean environment every time

### ✅ Onboarding Speed
- New developers setup in 5 minutes
- No need to install/manage Node.js versions
- No CLI version conflicts

### ✅ Platform Support
- Works identically on Windows, macOS, and Linux
- WSL2 issues eliminated
- Consistent Android development tools

## Troubleshooting

### Container Won't Start

```bash
# Check Docker is running
docker --version
docker-compose --version

# Rebuild container if needed
docker-compose -f docker-compose.dev.yml build wildlife-watcher-dev
```

### Port Conflicts

```bash
# Check what's using port 8081
lsof -i :8081  # macOS/Linux
netstat -ano | findstr :8081  # Windows

# Kill conflicting processes or change ports in docker-compose.dev.yml
```

### Phone Can't Connect

```bash
# Inside container, check network configuration
ip addr show

# Ensure firewall allows connections on ports 8081, 19000-19002
# Try tunnel mode if network issues persist
npx expo start --tunnel
```

### Volume Mount Issues (Windows)

```bash
# Ensure Docker Desktop has access to your drive
# Settings → Resources → File Sharing → Add your project drive
```

### Hot Reload Not Working

```bash
# Restart the Metro bundler
# Press 'r' in the terminal running expo start
# Or restart the container:
docker-compose -f docker-compose.dev.yml restart wildlife-watcher-dev
```

### Android ADB Connection

```bash
# Start ADB bridge service
docker-compose -f docker-compose.dev.yml --profile android up -d adb-server

# Inside main container, connect to ADB bridge
export ADB_SERVER_SOCKET=tcp:adb-server:5037
adb devices
```

## Customization

### Modifying the Environment

Edit `Dockerfile.dev` to:
- Add system packages: Modify the `apt-get install` line
- Change CLI versions: Update the `npm install -g` line
- Add environment variables: Add `ENV` instructions

### Adding Services

Edit `docker-compose.dev.yml` to add:
- Database services (PostgreSQL, Redis, etc.)
- Additional development tools
- Testing services

### Development Aliases

The container includes helpful aliases:
```bash
npm-start     # npm start
expo-start    # npx expo start  
eas-build     # eas build --profile development --platform android
gs            # git status
ll            # ls -la
```

Add more aliases by modifying the `.bashrc` setup in `Dockerfile.dev`.

## Comparison: Docker vs Native Setup

| Aspect | Docker | Native |
|--------|--------|---------|
| **Setup Time** | 5 minutes | 30+ minutes |
| **Consistency** | ✅ Identical for all devs | ❌ Varies by system |
| **Tool Conflicts** | ✅ Isolated | ❌ Potential conflicts |
| **Multiple Projects** | ✅ Different versions | ❌ One Node.js version |
| **Performance** | ⚠️ Slight overhead | ✅ Native speed |
| **Resource Usage** | ⚠️ Higher memory | ✅ Lower |

## When to Use Docker vs Native

### Use Docker When:
- Multiple developers need identical environments
- You have multiple React Native projects with different tool versions
- You're on Windows and want to avoid WSL2 complexity
- You want to avoid polluting your system with development tools

### Use Native When:
- You're the only developer
- Performance is critical
- You prefer minimal resource usage
- You're comfortable managing tool versions manually

## Production Builds

The Docker environment can also create production builds:

```bash
# Inside container
eas build --profile production --platform android
eas build --profile production --platform ios

# Submit to app stores
eas submit --platform android
eas submit --platform ios
```

## Conclusion

The Docker development environment provides a consistent, isolated, and quickly-setupable development experience that matches the project maintainer's exact tool versions. It's especially valuable for teams where developers use different operating systems or have varying levels of React Native experience.

Choose the approach that best fits your team's needs and development workflow!

---

*For native setup instructions, see [Developer-Onboarding-Guide.md](./Developer-Onboarding-Guide.md)*