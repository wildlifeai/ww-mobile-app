# Developer Documentation

This directory contains development guides and documentation for the Wildlife Watcher mobile app.

## 📚 Available Guides

### 🚀 Getting Started

#### [Developer Onboarding Guide](./Developer-Onboarding-Guide.md)
**Start here!** Complete step-by-step guide for new developers to get the Wildlife Watcher app running on their phone. Covers everything from installing Node.js to testing BLE functionality.

#### [Quick Start Checklist](./Quick-Start-Checklist.md)
Condensed setup guide for experienced React Native/Expo developers who want to get up and running quickly.

#### [Docker Development Guide](./Docker-Development-Guide.md)
**Recommended for teams!** Docker-based development environment with exact tool versions (Node 20.19.4, Expo CLI 0.18.31, EAS CLI 16.17.3). Eliminates "works on my machine" issues.\n\n#### [WSL2 Development Setup Guide](./WSL2-Development-Setup-Guide.md)\n**Essential for Windows WSL2 developers!** Complete setup guide for Windows 11 WSL2 development with port forwarding, network configuration, and development client connectivity. Required for BLE/native module development.

### 🏗️ Architecture & Understanding

#### [App Architecture Guide](./App-Architecture-Guide.md)
**Essential for all developers!** Comprehensive tour of how the Wildlife Watcher app works - its layers, dependencies, features, and how everything fits together. Not too technical, but thorough enough to understand the system.

### 🛠️ Development & Deployment

#### [Expo Fundamentals Guide](./Expo-Fundamentals-Guide.md)
**Start here after onboarding!** Essential Expo SDK concepts, development workflows, and app configuration. Bridges the gap between React Native knowledge and EAS Build system.

#### [EAS Development Guide](./EAS-Development-Guide.md)
Daily workflow commands and build management for Expo Application Services (EAS) after understanding the fundamentals.

#### [EAS Concepts and Keystores](./EAS-Concepts-and-Keystores.md)
Deep dive into EAS Build system, Android keystore management, and development client architecture.

### 🔧 Technical Analysis

#### [BLE-DFU Technical Analysis](../../project-context/development-context/MVP2/BLE-WWUS-DFUx/initial-cc-analysis/BLE-DFU-Technical-Analysis.md)
Deep technical analysis of the current BLE management and Nordic DFU implementation.

#### [BLE-DFU High Level Report](../../project-context/development-context/MVP2/BLE-WWUS-DFUx/initial-cc-analysis/BLE-DFU-High-Level-Report.md)
Executive summary of BLE and DFU capabilities for hardware team collaboration.

#### [BLE-DFU Dependencies and Relationships](../../project-context/development-context/MVP2/BLE-WWUS-DFUx/initial-cc-analysis/BLE-DFU-Dependencies-and-Relationships.md)
Detailed analysis of component dependencies and relationships in the BLE/DFU system.

#### [Wildlife Watcher Communication Systems Guide](../../project-context/development-context/MVP2/BLE-WWUS-DFUx/revised-documents/Wildlife-Watcher-Communication-Systems-Technical-Guide.md)
Revised technical guide for Wildlife Watcher communication systems with expert feedback incorporated.

**Quick Start:**
- Build development client: `eas build --profile development --platform android`
- Start development: `npx expo start --dev-client`
- Manage environment variables: `eas env:list --environment development`

## 🚀 Current Development Status

**Current Phase:** ✅ MVP2 Development with Supabase Integration
- **Framework:** Expo SDK 51 + EAS Build (migration complete)
- **Backend:** Supabase (PostgreSQL, Auth, Storage, Edge Functions)
- **Architecture:** Offline-first with Supabase sync
- **Focus:** Field deployment workflows and project management

**Key MVP2 Documents:**
- [Implementation Specification](../../project-context/development-context/MVP2/wildlife-watcher-implementation-spec-mvp2-consolidated-20250731.md)
- [Figma UI/UX Designs](../../project-context/development-context/MVP2/User%20Stories_%20Navigation%202.0-Figma-Design-med.pdf)
- [API Integration Guide](../../project-context/development-context/MVP2/API-INTEGRATION-GUIDE.md)

## 🚀 Getting Started (New Developers)

**🐳 Docker (Recommended):** Use [Docker Development Guide](./Docker-Development-Guide.md) for identical environment setup.

**📖 New to the project?** Follow the [Developer Onboarding Guide](./Developer-Onboarding-Guide.md) for complete setup instructions.

**⚡ Experienced developer?** Use the [Quick Start Checklist](./Quick-Start-Checklist.md) for faster setup.

**Quick Commands:**
```bash
# Current development workflow
npm install
npm start                    # Start Expo dev server
npm run android             # Run on Android device/emulator
npm run ios                 # Run on iOS device/simulator

# EAS Build workflow
eas build --profile development --platform android
eas build --profile production --platform android

# Development with Supabase
npm run supabase:types      # Sync Supabase types
```

## 📋 Documentation Structure

```
documentation/
└── developer-docs/
    ├── README.md                                      # This file
    ├── Developer-Onboarding-Guide.md                  # New developer setup  
    ├── Quick-Start-Checklist.md                       # Experienced dev setup
    ├── Docker-Development-Guide.md                    # Docker environment (recommended)
    ├── App-Architecture-Guide.md                      # How the app works (essential reading)
    ├── Expo-Fundamentals-Guide.md                     # Expo SDK concepts (read after onboarding)
    ├── EAS-Development-Guide.md                       # EAS workflow guide
    ├── EAS-Concepts-and-Keystores.md                  # EAS detailed concepts\n    ├── Supabase-Integration-Guide.md                  # Backend integration (essential for MVP2)\n    ├── WSL2-Development-Setup-Guide.md                # Windows WSL2 development setup
    # BLE/DFU documentation moved to:
    # ../../project-context/development-context/MVP2/BLE-WWUS-DFUx/
    # Contains: Technical analysis, high-level reports, dependencies, and revised guides
```

## 🎯 Priority Documentation Needed

### MVP2 Development Focus:
- [x] **Supabase Integration Guide** (backend setup, auth, offline sync) - **COMPLETE** ✅
- [ ] **MVP2 Development Context Guide** (implementation spec walkthrough) - **HIGH**
- [ ] **Offline-First Development Patterns** (local SQLite + Supabase sync) - **HIGH**
- [ ] **Redux + Supabase State Management** (integration patterns) - **MEDIUM**
- [ ] **Environment Variables & Configuration** (Supabase setup) - **MEDIUM**

### Future Documentation:
- [ ] Testing Guide (Jest + device testing + Supabase)
- [ ] Maps Integration Guide (react-native-maps advanced usage)
- [ ] CI/CD with EAS Guide (automation)
- [ ] Production Deployment Guide (app store submission)
- [ ] Performance Optimization Guide
- [ ] Security Best Practices Guide (Supabase RLS, offline security)

---

*This documentation grows with the project - contribute improvements as you discover better workflows!*