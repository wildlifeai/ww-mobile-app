# Developer Documentation

This directory contains development guides and documentation for the Wildlife Watcher mobile app.

## 📚 Available Guides

### [EAS Development Guide](./EAS-Development-Guide.md)
Essential guide for using Expo Application Services (EAS) during development after the Expo migration.

**Quick Start:**
- Build development client: `eas build --profile development --platform android`
- Start development: `npx expo start --dev-client`
- Manage environment variables: `eas env:list --environment development`

## 🔄 Migration Status

**Current Status:** ✅ Migrated to Expo SDK 51 + EAS Build
- **From:** Bare React Native + Fastlane + GitHub Actions
- **To:** Expo SDK 51 + EAS Build + Development Client
- **Architecture:** Hybrid (native modules preserved)

## 🚀 Getting Started (New Developers)

1. **Prerequisites:**
   ```bash
   npm install -g @expo/cli
   npx expo login
   ```

2. **Development Setup:**
   ```bash
   npm install
   eas build --profile development --platform android  # One-time
   npx expo start --dev-client                         # Daily development
   ```

3. **Read the guides** in this directory for detailed workflows

## 📋 Documentation Structure

```
documentation/
└── developer-docs/
    ├── README.md                  # This file
    ├── EAS-Development-Guide.md   # EAS workflow guide
    └── [Future guides...]         # To be expanded
```

## 🎯 Next Documentation

Future guides to be added:
- [ ] BLE Development Guide (using react-native-ble-manager)
- [ ] DFU Implementation Guide (Nordic DFU integration)
- [ ] Maps Integration Guide (react-native-maps)
- [ ] Redux State Management Guide
- [ ] Testing Guide
- [ ] CI/CD with EAS Guide
- [ ] Production Deployment Guide

---

*This documentation grows with the project - contribute improvements as you discover better workflows!*