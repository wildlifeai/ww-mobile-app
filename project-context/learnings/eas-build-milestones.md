# EAS Build Milestones - Wildlife Watcher MVP2

**Created**: 2025-08-31 @ 03:52 UTC  
**Purpose**: Track EAS build testing strategy aligned with development milestones

## 🎯 Build Testing Strategy

### Phase 1: Foundation Validation
**Trigger**: Task 10 completed (Redux integration)  
**Status**: ✅ Ready NOW

```bash
# Development Build Testing
eas build --platform android --profile development
eas build --platform ios --profile development
npx expo start --dev-client
```

**Testing Focus:**
- ✅ Authentication screens functional
- ✅ Redux state management working
- ✅ BLE device scanning operational
- ✅ Navigation and UI components responsive
- ✅ No regressions from Task 10 changes

**Success Criteria:**
- App launches successfully
- All existing features work as before
- No critical errors or crashes
- Dev tools and debugging functional

---

### Phase 2: Offline Foundation Validation
**Trigger**: Task 11 completed (SQLite foundation)  
**Timeline**: Next 1-2 days

```bash
# Preview Build Testing  
eas build --platform android --profile preview
eas build --platform ios --profile preview
```

**Testing Focus:**
- ✅ SQLite database operations
- ✅ Offline data persistence
- ✅ Sync queue functionality  
- ✅ Network state monitoring
- ✅ Offline/online transitions
- ✅ Organisation multi-tenancy offline

**Success Criteria:**
- App works completely offline
- Data persists across app restarts
- Sync queue processes correctly
- No data loss during network transitions
- Multi-tenant data isolation working

---

### Phase 3: Feature Stream Validation  
**Trigger**: Tasks 12-20 completed (Parallel streams)  
**Timeline**: ~1-2 weeks after Task 11

```bash
# Production Build Testing
eas build --platform android --profile production  
eas build --platform ios --profile production
```

**Testing Focus:**
- ✅ Complete MVP2 feature set
- ✅ Projects CRUD operations (Tasks 12-14)
- ✅ 6-step deployment wizard (Tasks 15-17)
- ✅ Device management & maps (Tasks 18-20)
- ✅ Full offline synchronization
- ✅ Real-world field testing scenarios

**Success Criteria:**
- All MVP2 user stories functional
- End-to-end workflows complete
- Performance meets requirements
- Field deployment scenarios work
- Wildlife researcher usability validated

---

### Phase 4: Production Deployment
**Trigger**: Task 21 completed (E2E testing)  
**Timeline**: After integration testing

```bash
# App Store Submission
eas submit --platform android
eas submit --platform ios
```

**Testing Focus:**
- ✅ Production environment validation
- ✅ App store compliance
- ✅ Security and privacy requirements
- ✅ Performance optimization complete
- ✅ Final quality assurance

**Success Criteria:**
- App store submission successful
- All compliance requirements met
- Production performance validated
- Security audit passed
- Ready for public release

## 🚀 Build Commands Reference

### Development Builds (Phase 1)
```bash
# Quick testing of current implementation
npx expo start --dev-client
eas build --platform android --profile development
eas build --platform ios --profile development

# Install on device/simulator
eas install --platform android
eas install --platform ios
```

### Preview Builds (Phase 2)
```bash  
# Stakeholder testing builds
eas build --platform android --profile preview
eas build --platform ios --profile preview

# Share with team
eas build --platform all --profile preview
```

### Production Builds (Phase 3)
```bash
# Field testing builds  
eas build --platform android --profile production
eas build --platform ios --profile production

# Generate for distribution
eas build --platform all --profile production
```

### Submission (Phase 4)
```bash
# App store submission
eas submit --platform android --latest
eas submit --platform ios --latest

# Check submission status
eas submit:android --status
eas submit:ios --status  
```

## 📊 Build Health Monitoring

### Pre-Build Checklist
- [ ] `npx expo doctor` passes
- [ ] All tests passing (`npm test`)  
- [ ] Type checking successful (`npm run type-check`)
- [ ] Linting clean (`npm run lint`)
- [ ] Environment variables configured
- [ ] EAS configuration valid

### Build Success Metrics
- **Build Time**: < 10 minutes for development, < 20 minutes for production
- **Bundle Size**: < 40MB for release builds
- **Startup Time**: < 3 seconds cold start
- **Memory Usage**: < 100MB average usage
- **Crash Rate**: < 0.1% for production builds

### Testing Device Matrix
- **Android**: API 29+ (Android 10+)
  - Physical device: Latest Samsung/Google
  - Emulator: Pixel 6 API 33
- **iOS**: iOS 13+  
  - Physical device: iPhone 12/13/14
  - Simulator: iPhone 14 Pro iOS 16

## 🔄 Regression Testing Strategy

### After Each Build
1. **Smoke Test**: Core functionality works
2. **Authentication Flow**: Login/logout cycle
3. **BLE Device Scanning**: Hardware connectivity
4. **Navigation**: All screens accessible  
5. **Data Persistence**: Offline/online sync

### Critical Path Testing
1. **User Journey 1**: Register → Create Project → Start Deployment
2. **User Journey 2**: Login → Device Connection → Configuration  
3. **User Journey 3**: Offline Operation → Network Recovery → Sync
4. **User Journey 4**: Multi-user → Collaboration → Project Management

## 📝 Build Log Template

### Build Information
- **Date/Time**: [Build timestamp]
- **Phase**: [1-4] - [Phase name] 
- **Platform**: [Android/iOS/Both]
- **Profile**: [development/preview/production]
- **Trigger**: [Task completion milestone]

### Test Results  
- **Smoke Tests**: [Pass/Fail]
- **Core Features**: [Pass/Fail] 
- **Performance**: [Pass/Fail]
- **Devices Tested**: [List]
- **Issues Found**: [List]

### Deployment Decision
- **Ready for Next Phase**: [Yes/No]
- **Blocker Issues**: [List]
- **Next Actions**: [List]

---

**Maintained by**: Claude Code Development  
**Last Updated**: 2025-08-31 @ 03:52 UTC  
**Next Review**: After Task 11 completion