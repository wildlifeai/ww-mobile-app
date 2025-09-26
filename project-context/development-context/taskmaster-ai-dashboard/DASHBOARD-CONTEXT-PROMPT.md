# TaskMaster AI Dashboard - Context Prompt Template

## Quick Start Command
```bash
# Copy this entire prompt for new Claude conversations:
cat /home/adarsh/dev/wildlifeai/wildlife-watcher-mobile-app/project-context/development-context/taskmaster-ai-dashboard/DASHBOARD-CONTEXT-PROMPT.md
```

---

## Project Context for Claude

I have a progress tracking dashboard for my Wildlife Watcher MVP2 project located at:
`@project-context/development-context/taskmaster-ai-dashboard/`

### Current App Status
- **Running at**: http://localhost:3333
- **Server**: Production-ready MVP2 dashboard
- **Status**: 60% complete with working core functionality

### 🚀 Current Enhancement in Progress
- **Feature**: Streams Tab Real Data Integration
- **Plan**: `STREAMS-TAB-ENHANCEMENT-PLAN.md`
- **Status**: 📋 PLANNING PHASE - Ready for execution
- **Objective**: Replace mock data with real MVP2 project structure and implement granular change detection

### 📁 Complete Folder Structure
```
taskmaster-ai-dashboard/
├── 📋 PRODUCTION FILES (Main Directory)
│   ├── dashboard-server.js                    # Single production server (Node.js/Express)
│   ├── mvp2-progress-dashboard-hybrid.html    # Full dashboard UI (63KB)
│   ├── mvp2-dashboard-api-hybrid.js          # Frontend JavaScript (46KB)
│   ├── mvp2-simple-dashboard.html            # Lightweight version
│   ├── start.sh                              # Startup script
│   ├── package.json & package-lock.json      # Dependencies
│   ├── README.md                             # Complete feature documentation
│   ├── DASHBOARD-FEATURE-ANALYSIS.md         # Enhancement roadmap & status
│   ├── STREAMS-TAB-ENHANCEMENT-PLAN.md       # 🚀 ACTIVE: Streams tab real data integration
│   └── DASHBOARD-CONTEXT-PROMPT.md           # This context file
│
├── 📦 node_modules/                          # Dependencies (Express, CORS, etc.)
│
├── ⚠️ errors/                                # Error screenshots
│   ├── Screenshot_*.jpg                      # Mobile app error captures
│
└── 📚 archive/                               # Reference & Legacy Files
    ├── README.md                             # Archive overview
    ├── TASKMASTER-LIVE-DASHBOARD-SETUP.md    # Legacy setup guide
    ├── dashboard.log                         # Server logs
    ├── interactive-task-dashboard.html        # Old dashboard version
    ├── taskmaster-dashboard-enhanced.html     # Enhanced version
    ├── taskmaster-dashboard-integration-guide.md # Integration docs
    ├── expo_migration_mvp.svg                # Project diagram
    │
    ├── 📄 docs/                              # Archived Documentation
    │   ├── CLEANUP-REPORT.md                 # File cleanup history
    │   ├── COMPREHENSIVE-UI-UX-IMPROVEMENT-PROPOSAL.md
    │   ├── DASHBOARD-FILE-AUDIT.md           # File structure analysis
    │   ├── FOCUSED-DASHBOARD-IMPROVEMENTS.md
    │   ├── MVP2-DASHBOARD-IMPLEMENTATION-SUMMARY.md
    │   ├── README-*.md                       # Various readme versions
    │   ├── TABBED-INTERFACE-FIX-SUMMARY.md   # UI fix documentation
    │   └── tabbed-interface-diagnosis.md     # Technical diagnosis
    │
    ├── 💻 legacy-code/                       # Old Implementations
    │   ├── fix-verification-test.html        # Test interface
    │   ├── mvp2-dashboard-server.js          # Old server version
    │   ├── taskmaster-api-server.js          # API server version
    │   ├── taskmaster-live-dashboard.html    # Live dashboard
    │   └── test-dashboard-features.js        # Feature tests
    │
    ├── 🔧 scripts/                          # Alternative Scripts
    │   ├── mvp2-dashboard-config.json        # Configuration
    │   ├── start-dashboard.sh                # Alternative startup
    │   ├── start-mvp2-dashboard.sh          # MVP2 specific startup
    │   └── test-mvp2-api.sh                 # API testing script
    │
    └── 📸 screenshots/                       # (Empty - for future captures)
```

### App Structure Overview
**Production Files (Use These):**
- `dashboard-server.js` - Single production server
- `mvp2-progress-dashboard-hybrid.html` - Full dashboard UI (63KB)
- `mvp2-dashboard-api-hybrid.js` - Frontend JavaScript (46KB)
- `start.sh` - Simple startup script
- `README.md` - Complete feature documentation
- `DASHBOARD-FEATURE-ANALYSIS.md` - Current enhancement roadmap

**Core Features Working:**
✅ Overview Tab - Executive summary with real-time metrics
✅ Streams Tab - Development stream tracking (A/B/C)
✅ Tasks Tab - Task management with filters
✅ Projects Tab - Cross-project coordination
✅ Metrics Tab - Time tracking and velocity analysis
🔧 Documents Tab - Needs verification
🔧 Settings Tab - Needs verification

**Missing Features to Restore:**
❌ Kanban Board - Card-based task workflow (HIGH PRIORITY)
❌ Gantt Timeline - Visual project timeline
❌ Activity Feed - Real-time change tracking

### Technical Stack
- **Backend**: Node.js Express server with CORS
- **Frontend**: Vanilla HTML/CSS/JavaScript (no frameworks)
- **Data Sources**: Local markdown files, project context files
- **Architecture**: Single-page hybrid dashboard with 7 tabs
- **Dependencies**: Express, CORS, Nodemon (see package.json)

### Enhancement Approach
- Start fresh conversation for each enhancement
- Maintain current working functionality
- Add features incrementally
- Archive old implementations to `/archive/` (don't delete)
- Reference legacy code in `/archive/legacy-code/` for feature restoration

### Key Documentation Priority
1. **DASHBOARD-FEATURE-ANALYSIS.md** - Enhancement roadmap & current status
2. **README.md** - Complete feature list and setup instructions
3. **archive/docs/** - Historical context and implementation notes
4. **archive/legacy-code/** - Reference implementations for missing features

### Expected Enhancement Types
- UI/UX improvements and modernization
- New tab implementations (Kanban, Gantt, Activity)
- Feature restorations from legacy versions
- Performance optimizations
- Cross-project integrations
- Mobile responsiveness improvements

---

## 🎯 **AWAITING USER INSTRUCTIONS**

**Ready to work on dashboard enhancements. Please specify:**
- Which feature/tab you want to work on
- What specific improvement you'd like to make
- Whether you want to restore a missing feature or create something new
- Any specific requirements or constraints

**Available for enhancement work with full project context loaded.**