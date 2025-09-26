# Wildlife Watcher MVP2 Dashboard - Focused Improvements

## 🎯 Core Purpose
Monitor cross-project progress (Mobile App + Backend) to track MVP2 development status and manage tasks effectively.

## 🔧 Immediate Fixes Required

### 1. Remove TaskMaster AI Dependencies
**Issue**: Dashboard tries to load non-existent `/taskmaster/tasks/tasks.json`
**Fix**:
- Remove all TaskMaster references from code
- Focus solely on MVP2 task files from `@project-context/development-context/MVP2/tasks/*.txt`
- Clean up error messages in console

### 2. Cross-Project Data Integration

#### Mobile App Tasks
**Source**: `/project-context/development-context/MVP2/tasks/*.txt`
- 24 tasks currently tracked
- Status: pending/in-progress/done
- Stream assignments (A, B, C)

#### Backend Status
**Source**: `/home/adarsh/dev/wildlifeai/wildlife-watcher-backend/project-context/PROJECT-STATUS.md`
- Current status: DEPLOYED to dev environment
- Integration readiness status
- Backend-specific tasks and blockers

### 3. Tab Functionality Fixes

#### 📊 Overview Tab
**Current**: Shows basic stats
**Needed**:
- Mobile App: Current task (Task 11.4), Next task (Task 12)
- Backend: Status (DEPLOYED), Integration readiness
- Combined progress: Mobile 43%, Backend 100%
- Stream status with actual task counts

#### 🚀 Streams Tab
**Current**: Shows "No streams data"
**Needed**:
- Stream A: Tasks 12-14 (Project Management) - 3 tasks pending
- Stream B: Tasks 15-17 (Deployment) - 3 tasks pending
- Stream C: Tasks 18-20 (Devices & Maps) - 3 tasks pending
- Visual progress bars for each stream

#### 📋 Tasks Tab
**Current**: Flat list with "0h" times
**Needed**:
- Separate sections: Mobile App Tasks | Backend Tasks
- Actual time data from MVP2-METRICS-TRACKER.md
- Working filters for status
- Clear stream/phase grouping

#### 🤖 Agents Tab
**Current**: Empty/non-functional
**Needed**:
- Current agent assignments from task files
- Which agent handles which task type
- Simple status: Available/Busy

#### 📈 Activity Tab
**Current**: Non-functional
**Needed**:
- Recent task completions
- Last update timestamps
- Simple activity log from file modifications

#### 📚 Documents Tab
**Current**: Basic viewer
**Needed**:
- Quick access to:
  - MVP2-MASTER-EXECUTION-PLAN.md
  - MVP2-METRICS-TRACKER.md
  - Backend PROJECT-STATUS.md
- Render markdown properly
- No versioning/history needed

#### ⚙️ Settings Tab
**Remove or Simplify**:
- Just refresh rate
- Service status indicators
- Start/stop buttons for dashboard server

## 📐 Technical Implementation

### API Endpoints to Fix
```javascript
// Remove TaskMaster, focus on MVP2
app.get('/api/tasks', async (req, res) => {
  const mobileTasks = await loadMVP2Tasks(); // from MVP2/tasks
  const backendStatus = await loadBackendStatus(); // from backend project

  res.json({
    mobile: mobileTasks,
    backend: backendStatus,
    combined: calculateCombinedProgress(mobileTasks, backendStatus)
  });
});
```

### Data Parser Fixes
```javascript
// Parse actual time data from metrics tracker
function parseMetricsData() {
  const metricsFile = 'MVP2-METRICS-TRACKER.md';
  // Extract actual vs estimated hours
  // Return structured data for display
}

// Parse backend status
function parseBackendStatus() {
  const statusFile = '../backend/PROJECT-STATUS.md';
  // Extract current phase, status, blockers
  // Return structured data
}
```

### UI Updates Needed
```javascript
// Executive Overview Component
const ExecutiveOverview = () => {
  return (
    <div className="overview-grid">
      <Card title="Mobile App">
        <div>Current: Task 11.4 - Conflict Resolution</div>
        <div>Next: Task 12 - Projects CRUD</div>
        <div>Progress: 43% (10/23 tasks)</div>
      </Card>
      <Card title="Backend">
        <div>Status: DEPLOYED (Dev)</div>
        <div>Ready for: Mobile Integration</div>
        <div>Progress: 100% MVP2 Complete</div>
      </Card>
    </div>
  );
};
```

## 🧪 Testing Requirements

### Playwright Tests Needed
1. **Navigation**: All 7 tabs load and display content
2. **Data Loading**: Tasks appear from correct sources
3. **Filters**: Status filters work on Tasks tab
4. **Documents**: Can view markdown documents
5. **Refresh**: Data updates when files change
6. **Service Status**: Shows if server is running

## 🚀 Service Management

### Simple Service Panel
```
🟢 Dashboard Server: Running (Port 3333)
🔴 Backend API: Not Running [Start]
🔴 Mobile Dev Server: Not Running [Start]

[Refresh Status] [Restart Dashboard]
```

## ✅ Success Criteria

1. **No Console Errors**: Clean error-free operation
2. **All Tabs Functional**: Each tab shows relevant data
3. **Cross-Project Visibility**: See both mobile and backend status
4. **Real Progress Data**: Actual times and completion percentages
5. **Current/Next Tasks**: Clear indication of what's being worked on
6. **Service Management**: Can see what's running and start services

## 🎯 What NOT to Include

❌ Git commit activity tracking
❌ Real-time API monitoring
❌ Template management for AADF
❌ Stakeholder reports generation
❌ Document versioning/history
❌ Export capabilities
❌ Complex analytics
❌ Webhook monitoring

## 📋 Implementation Priority

### Phase 1 (Immediate - Today)
1. Remove TaskMaster dependencies
2. Fix data sources to read correct files
3. Get all tabs showing basic data
4. Add mobile + backend separation

### Phase 2 (Tomorrow)
1. Parse real metrics data
2. Add current/next task display
3. Fix stream visualization
4. Test with Playwright

### Phase 3 (If Time Permits)
1. Service status indicators
2. Start/stop buttons
3. Polish UI appearance
4. Optimize performance

---

The goal is a **simple, functional dashboard** that shows:
- What tasks are complete/pending/active
- Progress for both mobile and backend
- Current and next tasks
- Stream organization
- Key documents

Nothing more, nothing less. Focus on getting this working so you can proceed with the Master Execution Plan.