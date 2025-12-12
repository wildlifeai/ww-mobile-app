# Developer Onboarding Documentation

Welcome to the Wildlife Watcher Mobile App development team! This folder contains comprehensive onboarding materials designed to help web developers transition to React Native development with TypeScript, offline-first architecture, and modern state management patterns.

## 📚 Documentation Structure

### **Start Here**: [00-GETTING-STARTED.md](./00-GETTING-STARTED.md)
Your entry point to the Wildlife Watcher app. Get oriented quickly with the project overview, high-level architecture, and what makes this app unique.

### Core Learning Tracks

1. **[01-TECHNOLOGY-STACK.md](./01-TECHNOLOGY-STACK.md)**
   - Complete technology overview with real examples from our codebase
   - React Native, Expo, TypeScript fundamentals
   - Key differences from web development
   - Package ecosystem and tooling

2. **[02-PROJECT-STRUCTURE.md](./02-PROJECT-STRUCTURE.md)**
   - Detailed walkthrough of folder organization
   - File naming conventions and patterns
   - Where to find what you need
   - Code organization principles

3. **[03-OFFLINE-FIRST-ARCHITECTURE.md](./03-OFFLINE-FIRST-ARCHITECTURE.md)**
   - Understanding offline-first design
   - WatermelonDB local database patterns
   - Supabase Sync Engine
   - Network state management
   - Real examples from SupabaseSyncService

4. **[04-REDUX-STATE-MANAGEMENT.md](./04-REDUX-STATE-MANAGEMENT.md)**
   - Redux Toolkit (RTK) for UI & Session state
   - Why we moved data persistence to WatermelonDB
   - Slice creation and async thunks
   - Connecting components to Redux
   - Practical examples from our store

5. **[05-REACT-NATIVE-PATTERNS.md](./05-REACT-NATIVE-PATTERNS.md)**
   - Component architecture and patterns
   - Navigation with React Navigation
   - Styling with React Native Paper
   - Platform-specific code
   - Performance optimization

6. **[06-DEVELOPMENT-WORKFLOW.md](./06-DEVELOPMENT-WORKFLOW.md)**
   - Setting up your development environment
   - Running the app locally
   - Debugging techniques
   - Testing strategies
   - Git workflow and commit patterns

## 🎯 Learning Path

### Week 1: Foundation
1. Read 00-GETTING-STARTED.md for context
2. Study 01-TECHNOLOGY-STACK.md to understand the tools
3. Explore 02-PROJECT-STRUCTURE.md and navigate the codebase
4. Set up your development environment (06-DEVELOPMENT-WORKFLOW.md)

### Week 2: Core Concepts
1. Deep dive into 03-OFFLINE-FIRST-ARCHITECTURE.md
2. Master Redux patterns with 04-REDUX-STATE-MANAGEMENT.md
3. Learn React Native specifics from 05-REACT-NATIVE-PATTERNS.md
4. Start making small contributions

### Week 3+: Productive Development
1. Pick up your first feature ticket
2. Reference documentation as needed
3. Pair with experienced team members
4. Build confidence with the codebase

## 🔍 Quick Reference

### Common Tasks

**Find where authentication happens**:
- `src/redux/slices/authSlice.ts` - Redux state
- `src/services/auth.ts` - Authentication service
- `src/services/supabase.ts` - Supabase client

**Understand offline sync**:
- `src/services/SupabaseSyncService.ts` - Main sync logic
- `src/database/index.ts` - WatermelonDB setup
- `src/redux/slices/syncSlice.ts` - Sync status state

**Add a new screen**:
- Create component in `src/screens/`
- Register in `src/navigation/index.tsx`
- Add to TypeScript route types

**Work with the API**:
- `src/redux/api/` - RTK Query API definitions
- `src/services/database.ts` - Typed Supabase operations
- `src/types/supabase.ts` - Generated TypeScript types

**Work with BLE Commands**:
- [BLE Architecture Guide](../ble-architecture-guide.md) - **Read this first!**
- `src/ble/types.ts` - Command definitions (single source of truth)
- `src/hooks/useBleCommands.ts` - Individual command hooks
- `src/hooks/useCapturePreview.ts` - Image capture process
- `src/navigation/screens/EngineerConsoleScreen.tsx` - Testing & reference

### Getting Help

1. **Documentation First**: Check these guides for patterns and examples
2. **Code Examples**: Search the codebase for similar implementations
3. **Team Chat**: Ask questions in the dev channel
4. **Pair Programming**: Schedule sessions with experienced developers

## 🎓 Additional Resources

### React Native Learning
- [React Native Documentation](https://reactnative.dev/)
- [Expo Documentation](https://docs.expo.dev/)
- [React Native Directory](https://reactnative.directory/) - Package discovery

### State Management
- [Redux Toolkit Documentation](https://redux-toolkit.js.org/)
- [RTK Query Overview](https://redux-toolkit.js.org/rtk-query/overview)

### TypeScript
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [React TypeScript Cheatsheet](https://react-typescript-cheatsheet.netlify.app/)

### Project-Specific
- [Implementation Spec](../../project-context/development-context/MVP2/implementation-spec-v1.4.md) - Complete project requirements
- [Supabase Backend](https://github.com/wildlifeai/wildlife-watcher-backend) - Backend repository

## 💡 Tips for Success

1. **Think Mobile-First**: UI patterns differ from web - embrace platform conventions
2. **Offline is Key**: Always consider how features work without connectivity
3. **Performance Matters**: Mobile devices have constraints - optimize early
4. **Type Everything**: TypeScript is your friend - leverage it fully
5. **Test on Devices**: Emulator behavior differs from real devices

## 🚀 Ready to Start?

Begin with [00-GETTING-STARTED.md](./00-GETTING-STARTED.md) and follow the learning path above. Welcome to the team!

---

**Last Updated**: November 2025
**Maintained By**: Wildlife Watcher Development Team
