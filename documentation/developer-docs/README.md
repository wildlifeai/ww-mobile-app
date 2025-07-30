# Developer Documentation

This directory contains development guides and documentation for the Wildlife Watcher mobile app.

## 📚 Available Guides

### 🚀 Getting Started

#### [Developer Onboarding Guide](./Developer-Onboarding-Guide.md)
**Start here!** Complete step-by-step guide for new developers to get the Wildlife Watcher app running on their phone. Covers everything from installing Node.js to testing BLE functionality.

#### [Quick Start Checklist](./Quick-Start-Checklist.md)
Condensed setup guide for experienced React Native/Expo developers who want to get up and running quickly.

### 🛠️ Development & Deployment

#### [EAS Development Guide](./EAS-Development-Guide.md)
Essential guide for using Expo Application Services (EAS) during development after the Expo migration.

#### [EAS Concepts and Keystores](./EAS-Concepts-and-Keystores.md)
Comprehensive guide explaining EAS concepts, Android keystore management, and development client workflow.

### 🔧 Technical Analysis

#### [BLE-DFU Technical Analysis](./BLE-DFU-Technical-Analysis.md)
Deep technical analysis of the current BLE management and Nordic DFU implementation.

#### [BLE-DFU High Level Report](./BLE-DFU-High-Level-Report.md)
Executive summary of BLE and DFU capabilities for hardware team collaboration.

#### [BLE-DFU Dependencies and Relationships](./BLE-DFU-Dependencies-and-Relationships.md)
Detailed analysis of component dependencies and relationships in the BLE/DFU system.

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

**New to the project?** Follow the [Developer Onboarding Guide](./Developer-Onboarding-Guide.md) for complete setup instructions.

**Experienced developer?** Use the [Quick Start Checklist](./Quick-Start-Checklist.md) for faster setup.

**Quick Commands:**
```bash
# Prerequisites
npm install -g @expo/cli eas-cli
eas login

# Setup
git checkout expo-migration
npm install
npm start  # Start development server

# Get app: Download development build from link in onboarding guide
```

## 📋 Documentation Structure

```
documentation/
└── developer-docs/
    ├── README.md                                      # This file
    ├── Developer-Onboarding-Guide.md                  # New developer setup
    ├── Quick-Start-Checklist.md                       # Experienced dev setup
    ├── EAS-Development-Guide.md                       # EAS workflow guide
    ├── EAS-Concepts-and-Keystores.md                  # EAS detailed concepts
    ├── BLE-DFU-Technical-Analysis.md                  # BLE/DFU deep dive
    ├── BLE-DFU-High-Level-Report.md                   # BLE/DFU executive summary
    └── BLE-DFU-Dependencies-and-Relationships.md      # Component relationships
```

## 🎯 Future Documentation

Guides to be added as needed:
- [ ] Redux State Management Guide (detailed patterns)
- [ ] Testing Guide (Jest + device testing)
- [ ] Maps Integration Guide (react-native-maps advanced usage)
- [ ] CI/CD with EAS Guide (automation)
- [ ] Production Deployment Guide (app store submission)
- [ ] Android Keystore Management Guide (advanced scenarios)
- [ ] iOS Certificate Management with EAS Guide
- [ ] Performance Optimization Guide
- [ ] Security Best Practices Guide

---

*This documentation grows with the project - contribute improvements as you discover better workflows!*