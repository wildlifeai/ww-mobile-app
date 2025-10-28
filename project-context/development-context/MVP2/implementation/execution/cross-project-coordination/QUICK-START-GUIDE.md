# 🚀 Quick Start Guide: Cross-Repository Coordination

This guide gets you up and running with the Wildlife Watcher cross-repository coordination system in under 10 minutes.

---

## 📦 Installation (5 minutes)

### Step 1: Run Setup Script
```bash
cd /home/adarsh/dev/wildlifeai/wildlife-watcher-mobile-app
./project-context/development-context/MVP2/implementation/execution/cross-project-coordination/scripts/setup-coordination-hub.sh
```

This creates:
- Shared coordination hub at `~/dev/wildlifeai/cross-project-coordination/`
- Symbolic links in all project repositories
- Configuration files and templates

### Step 2: Make Scripts Executable
```bash
cd ~/dev/wildlifeai/cross-project-coordination/.coordination
chmod +x hooks/*.sh
chmod +x ../scripts/*.sh
```

### Step 3: Install inotify-tools (Linux/WSL - Optional but Recommended)
```bash
# Ubuntu/Debian
sudo apt-get install inotify-tools

# Already available on macOS (uses FSEvents)
# Windows: Uses polling mode (no install needed)
```

### Step 4: Start the File Watcher
```bash
cd ~/dev/wildlifeai/cross-project-coordination
./scripts/coordination-watch.sh start
```

### Step 5: Test Notifications
```bash
./scripts/coordination-watch.sh test
```

You should see a desktop notification: "🧪 Test Notification - Coordination watcher is working!"

---

## 🎯 Daily Workflow (2 minutes)

### Morning Routine
```bash
# 1. Start your coordination watcher (if not already running)
cd ~/dev/wildlifeai/cross-project-coordination
./scripts/coordination-watch.sh status  # Check if running
./scripts/coordination-watch.sh start   # Start if needed

# 2. Check for new messages
ls -la inbox/*/

# 3. Check your team's action items
ls -la action-items/mobile/  # or backend/web
```

### When You Receive a Message
Desktop notification will alert you automatically!

1. **Read the message** in `inbox/{sender-team}/`
2. **Acknowledge** by moving to appropriate folder:
   ```bash
   # For tasks
   mv inbox/backend-to-mobile/MSG-*.md active/tasks/in-progress/

   # For status updates
   # (just read, no action unless you need to respond)

   # For urgent items
   # Auto-moved by watcher to active/threads/
   ```

3. **Respond if needed** using templates:
   ```bash
   cp templates/status-update.md inbox/mobile-to-backend/20250128-1430-mobile-backend-STATUS_UPDATE-task-12.md
   # Edit the file with your update
   ```

### Evening Routine
```bash
# 1. Update your team's status
./scripts/update-team-status.sh mobile  # or backend/web

# 2. Archive completed items (optional - auto-archives after 30 days)
./scripts/archive-completed.sh

# 3. Review tomorrow's action items
cat action-items/mobile/*.md
```

---

## 📝 Creating Messages (3 minutes)

### Using Templates

1. **Choose appropriate template** from `templates/`:
   - `task-request.md` - Request work from another team
   - `status-update.md` - Update progress on existing work
   - `schema-change.md` - Notify about database changes
   - `decision-request.md` - Need architectural decision
   - `urgent.md` - Critical issue requiring immediate attention

2. **Copy and customize**:
   ```bash
   # Example: Mobile team requesting backend API
   cp templates/task-request.md \
      inbox/mobile-to-backend/20250128-1430-mobile-backend-TASK_REQUEST-deployment-photos-api.md

   # Edit the file
   nano inbox/mobile-to-backend/20250128-1430-mobile-backend-TASK_REQUEST-deployment-photos-api.md
   ```

3. **File naming convention**:
   ```
   YYYYMMDD-HHMM-{sender}-{recipient}-{type}-{topic}.md
   ```

   **Examples**:
   - `20250128-1430-mobile-backend-TASK_REQUEST-user-roles-api.md`
   - `20250128-0900-backend-mobile-STATUS_UPDATE-task-13-complete.md`
   - `20250128-1615-mobile-all-URGENT-database-migration-breaking.md`

4. **Message metadata (YAML frontmatter)**:
   ```yaml
   ---
   message_id: "MSG-2025-01-28-001"
   thread_id: "THR-USER-ROLES-001"
   sender:
     team: "mobile"
   recipient:
     team: "backend"
   priority: "HIGH"  # URGENT | HIGH | NORMAL | LOW
   type: "TASK_REQUEST"
   status: "SENT"
   created: "2025-01-28T14:30:00Z"
   requires_response: true
   ---
   ```

5. **Save the file** - File watcher will:
   - Detect the new message
   - Parse metadata
   - Send notification to recipient team
   - Move to appropriate folder if urgent
   - Log the activity

---

## 🔔 Understanding Notifications

### Priority Levels and Response Times

| Priority | Response Time | Notification | Icon |
|----------|--------------|--------------|------|
| **URGENT** | < 2 hours | Desktop + Sound | 🚨 |
| **HIGH** | < 8 hours | Desktop | ⚠️ |
| **NORMAL** | < 24 hours | Desktop | 📬 |
| **LOW** | < 72 hours | Log only | 💌 |

### What Triggers Notifications
- ✅ New message in your team's inbox
- ✅ Message addressed to "all"
- ✅ Overdue action item
- ✅ Thread requiring your response
- ❌ Messages for other teams (logged but not notified)

---

## 📂 Folder Organization

### Where to Find Things

```
cross-project-coordination/
├── 📬 inbox/                    # CHECK DAILY - New messages arrive here
├── 🔄 active/                   # WORK HERE - Ongoing conversations
│   ├── threads/                 # Thread-based discussions
│   ├── tasks/in-progress/       # What you're working on NOW
│   ├── tasks/blocked/           # Waiting on dependencies
│   └── decisions/pending/       # Need your input
├── 📊 status/                   # READ - Current project status
├── 🎯 action-items/mobile/      # YOUR TODO LIST
├── 📝 templates/                # COPY FROM HERE - Message templates
├── 📚 knowledge-base/           # REFERENCE - Shared docs
└── 🗄️ archive/                  # OLD STUFF - Auto-archived after 30 days
```

---

## 🔧 Common Tasks

### Scenario 1: Backend Schema Changed, Types Need Regeneration

**Backend sends:**
```bash
# Backend team creates schema change notification
cp ~/dev/wildlifeai/cross-project-coordination/templates/schema-change.md \
   ~/dev/wildlifeai/cross-project-coordination/inbox/backend-to-mobile/20250128-1500-backend-mobile-SCHEMA_CHANGE-deployments-table.md
```

**Mobile receives notification:**
```
🚨 Coordination Message [HIGH]
From: backend
Type: SCHEMA_CHANGE
Schema Change: Add verification_status to deployments
```

**Mobile responds:**
```bash
# 1. Pull backend changes
cd ~/dev/wildlifeai/wildlife-watcher-backend
git pull origin dev-mobile-app-mvp2-updates-claude-flow

# 2. Regenerate types
cd ~/dev/wildlifeai/wildlife-watcher-mobile-app
npm run types:local

# 3. Acknowledge completion
cp templates/status-update.md \
   inbox/mobile-to-backend/20250128-1530-mobile-backend-STATUS_UPDATE-types-regenerated.md
# Edit to confirm completion
```

### Scenario 2: Mobile Needs New Backend API

**Mobile creates request:**
```bash
cp templates/task-request.md \
   inbox/mobile-to-backend/20250128-0900-mobile-backend-TASK_REQUEST-deployment-photos-upload.md

# Edit file with:
# - API endpoint specification
# - Request/response schemas
# - Storage bucket requirements
# - Timeline needs
```

**Backend acknowledges:**
```bash
# Backend creates response
cp templates/status-update.md \
   inbox/backend-to-mobile/20250128-0930-backend-mobile-STATUS_UPDATE-deployment-photos-acknowledged.md

# Include:
# - Acknowledgment of receipt
# - Estimated completion: 2 days
# - Any clarifying questions
```

### Scenario 3: Urgent Production Issue

**Any team creates urgent message:**
```bash
cp templates/urgent.md \
   inbox/mobile-to-all/20250128-2230-mobile-all-URGENT-auth-token-expiry.md

# File watcher immediately:
# - Sends critical notification to ALL teams
# - Moves to active/threads/ automatically
# - Logs as urgent in metrics
# - Starts escalation timer
```

---

## 🤖 Automation Features

### Auto-Processing by File Watcher

✅ **Automatic Routing**: Messages to your team → Desktop notification
✅ **Urgent Escalation**: URGENT messages → Immediate alert + auto-move to active
✅ **Activity Logging**: All messages logged to `.coordination/logs/activity.jsonl`
✅ **Overdue Detection**: Checks every hour for overdue action items
✅ **Status Sync**: Can auto-update status files (configurable)

### Git Hook Integration (Coming Soon)

Will automatically:
- Check for unacknowledged messages before commit
- Warn about overdue action items
- Update your team's status on push
- Validate type synchronization

---

## 📊 Monitoring & Metrics

### Check Coordination Health
```bash
# View recent activity
tail -f ~/dev/wildlifeai/cross-project-coordination/.coordination/logs/activity.jsonl

# Check watcher status
./scripts/coordination-watch.sh status

# View response time metrics
cat metrics/response-times/summary.json

# Daily report
./scripts/daily-report.sh
```

### Key Metrics Tracked
- Message response times by priority
- Resolution rates for tasks
- Escalation events
- Team activity levels
- Coordination health score

---

## 🆘 Troubleshooting

### Watcher Not Running
```bash
./scripts/coordination-watch.sh status
./scripts/coordination-watch.sh restart
```

### Not Getting Notifications
```bash
# Test notification system
./scripts/coordination-watch.sh test

# Check log file
tail -20 .coordination/logs/watcher.log

# Verify inotify-tools (Linux)
which inotifywait
```

### Message Not Being Routed
Check that:
1. Filename follows naming convention
2. YAML frontmatter is valid
3. `recipient.team` matches your team name
4. File is in `inbox/` directory

### Types Out of Sync
```bash
# Mobile app
cd ~/dev/wildlifeai/wildlife-watcher-mobile-app
npm run types:local
npm run types:check-local

# If issues persist, check backend types
cd ~/dev/wildlifeai/wildlife-watcher-backend
npm run db:types:update
```

---

## 📚 Additional Resources

### Full Documentation
- **Design Document**: `CROSS-REPOSITORY-COORDINATION-SYSTEM-DESIGN.md`
- **Original Orchestration Guide**: `CROSS-PROJECT-ORCHESTRATION-GUIDE.md`

### Templates
- `templates/task-request.md` - Request new work
- `templates/status-update.md` - Progress updates
- `templates/schema-change.md` - Database changes
- `templates/decision-request.md` - Need architectural decision
- `templates/urgent.md` - Critical issues

### Scripts
- `setup-coordination-hub.sh` - Initial setup
- `coordination-watch.sh` - File monitoring
- `update-team-status.sh` - Status updates
- `archive-completed.sh` - Archive management
- `daily-report.sh` - Generate reports

---

## 🎓 Best Practices

### DO ✅
- Check inbox daily (morning routine)
- Respond within priority SLA
- Use thread IDs to maintain context
- Keep status files updated
- Archive completed items
- Use templates for consistency

### DON'T ❌
- Manually edit archived items
- Skip YAML frontmatter
- Ignore URGENT messages
- Create messages without thread context
- Delete messages (archive instead)
- Use non-standard file naming

---

## 🤝 Team Configuration

### Your Team Settings
Edit `.coordination/config.yaml`:

```yaml
team: mobile  # or backend, web

notifications:
  terminal: true
  desktop: true
  sound: false  # true for URGENT only

automation:
  auto_acknowledge: false  # true to auto-acknowledge receipt
  status_sync_interval: 3600  # seconds
```

---

## 🎯 Success Metrics

Track your coordination effectiveness:
- **Response Time**: < 8 hours average
- **Acknowledgment Rate**: > 95% within SLA
- **Resolution Time**: < 48 hours for tasks
- **Escalations**: < 5% of messages
- **Satisfaction**: Regular team surveys

---

**Questions? Issues? Suggestions?**
Create a coordination message in `inbox/{your-team}-to-all/` or check the full design document for detailed information.

**Ready to start coordinating! 🚀**