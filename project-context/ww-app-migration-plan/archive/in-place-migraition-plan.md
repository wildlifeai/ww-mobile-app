

### 🎯 Goal:

By end of day, the app is migrated to Expo SDK 51 within `ww-app`, and working on Android + iOS for BLE, DFU, Maps, File System, and Redux — so full MVP feature work can begin tomorrow.

---

### 🔹 Phase 1: In-Place Migration Execution

### Prepatory steps
- Ensure you have MCP setup for Task Master AI, Context 7, Supabase, Playwright
- Update Claude.md
- add relevant document to project context (orgniase this)
    - in pace migration
    - migration documents
    - bundle id document
    - dev decisions priorites
    - for later - add prod plan too


#### ✅ Must-Do (Blockers)

1. **Create `expo-migration` Branch**

   * Branch off from current stable ~~`main`~~ `dev`
   * This gives rollback capability if needed

2. **In-Place Migration**

   * Use the PoC migration plan and validation results as your reference (see migration guide documents)
   * Reuse most existing code/components (already SDK 51 compatible)
   * **Only change**: replace `react-native-fs` with `expo-file-system` - see migration guide document

     * Implement file operations using `expo-file-system@17.0.1`
     * Adjust usage where needed in existing code

     - reference documents for this step:
        - README.md
        - MIGRATION-OVERVIEW.md
        - MIGRATION-GUIDE.md
        - QUICK-REFERENCE.md


3. **Update `app.config.js`**

   * Set correct bundle/package identifiers 
        - !IMPORTANT! - See the guidance on this per handling-bundle-identifiers.md document
   * Add required permissions:

     ```js
     android: {
       permissions: [
         "ACCESS_FINE_LOCATION",
         "BLUETOOTH",
         "BLUETOOTH_CONNECT",
         "BLUETOOTH_SCAN"
       ]
     },
     ios: {
       infoPlist: {
         NSBluetoothAlwaysUsageDescription: "Used to connect to Wildlife Watcher devices",
         NSLocationWhenInUseUsageDescription: "Used to display device locations on map"
       }
     }
     ```

4. **Real Device Testing**

   * Android (your phone): BLE, DFU, Maps, File System
   * iOS (mate’s phone): Confirm same core functionality using Expo dev client

4.5. **Clean up code base**

- Implement the items mentioned per MIGRATION-IMPACT-ANALYSIS.md


5. **Supabase Integration: Minimum Auth**

   * review and update Supabase project-context
   * setup supabase MCP
   Set up Supabase client
   * Implement email/password auth
   * Ensure data separation (user → project scope isolation)
   * OK to keep UI basic for now

6. **Cutoff Decision**

   * ✅ If migration + testing pass → `expo-migration` becomes mainline
   * Legacy app code is frozen; all future development continues in Expo

---

### 🔹 Phase 2: Optional Enhancements (Won’t Block Migration)

You can start these during or after migration as time allows:

7. **Install `expo-build-properties`**
   To prepare for store compliance while staying on SDK 51:

   ```bash
   npm install -D expo-build-properties@^0.14.8
   ```

8. **Set `compileSdkVersion: 35` + `deploymentTarget: 15.1`**
   (in `app.config.js`) — ensures Android/iOS readiness

9. **Add `.env` Support** (optional)
   Use `expo-constants` or a simple env loader for API keys, staging/prod URLs

10. **Fallbacks**
    Log/test behavior when:

* Location permission is denied
* Bluetooth is off
* Maps fails to load

11. **Redux Debug Panel Test**
    Ensure `📊` tab works, with logs and actions firing from BLE, DFU, etc.

---

### 🔹 Phase 3: Ready for MVP Dev

Once migration is validated and working:

12. **Analyze MVP 1 + 2**

* Analsys and consolidate MVP 1 & 2 into a combined PID
* look at items in mvp-dev-stage-considerations.md
 * Use Task Master AI to break them into tasks
* Prioritize based on risk and UI readiness

13. **Start MVP Development**

* Begin with isolated screens and features
* Push commits to `expo-migration` or `main` if cut-over happens

---

Let me know if you want this as a checklist or markdown doc, or converted into issues/tasks. You're making excellent progress — this approach is clear, low-risk, and structured for momentum.
