#!/bin/bash
# setup-coordination-hub-simplified.sh
# Creates a SIMPLE coordination hub structure (4 folders, not 16!)

set -e  # Exit on error

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
COORDINATION_ROOT="$HOME/dev/wildlifeai/cross-project-coordination"

echo -e "${BLUE}🔄 Wildlife Watcher Cross-Project Coordination Setup (Simplified)${NC}"
echo -e "${BLUE}================================================================${NC}"

# Function to create directory
create_dir() {
    local path="$1"
    local desc="$2"

    if [ ! -d "$path" ]; then
        mkdir -p "$path"
        echo -e "${GREEN}✓${NC} Created: $path"

        # Add README with description
        if [ ! -z "$desc" ]; then
            echo "# $(basename $path)" > "$path/README.md"
            echo "" >> "$path/README.md"
            echo "$desc" >> "$path/README.md"
        fi
    else
        echo -e "${YELLOW}⚠${NC}  Exists: $path"
    fi
}

echo -e "\n${YELLOW}Creating simplified 4-folder structure...${NC}\n"

# 1. INBOX (only 2 subfolders needed)
create_dir "$COORDINATION_ROOT/inbox" "Messages to read and action"
create_dir "$COORDINATION_ROOT/inbox/backend-to-mobile" "Backend sends here, mobile reads"
create_dir "$COORDINATION_ROOT/inbox/mobile-to-backend" "Mobile sends here, backend reads"

# 2. ARCHIVE (date-based)
create_dir "$COORDINATION_ROOT/archive" "Completed/actioned messages"
create_dir "$COORDINATION_ROOT/archive/$(date +%Y-%m)" "Current month archive"

# 3. TEMPLATES
create_dir "$COORDINATION_ROOT/templates" "Message templates"

# 4. SYSTEM (.coordination)
create_dir "$COORDINATION_ROOT/.coordination" "System configuration and logs"
create_dir "$COORDINATION_ROOT/.coordination/logs" "Monthly activity logs"

# Create log helper script
echo -e "\n${YELLOW}Creating log helper script...${NC}"

cat > "$COORDINATION_ROOT/.coordination/log-message.sh" << 'LOGSCRIPT'
#!/bin/bash
# Log coordination activity with auto-rotation by month

CURRENT_MONTH=$(date +%Y-%m)
LOG_DIR="$HOME/dev/wildlifeai/cross-project-coordination/.coordination/logs"
LOG_FILE="$LOG_DIR/$CURRENT_MONTH.log"

# Create logs directory if needed
mkdir -p "$LOG_DIR"

# Format: ISO timestamp | Team | Action
TIMESTAMP=$(date -Iseconds)
TEAM="${1:-Unknown}"
ACTION="${2:-No action specified}"

echo "$TIMESTAMP | $TEAM | $ACTION" >> "$LOG_FILE"

# Update symlink to current month
ln -sf "logs/$CURRENT_MONTH.log" "$LOG_DIR/../activity-current.log"

# Optional: print to stdout
if [ "${3:-}" == "--verbose" ]; then
    echo -e "\033[0;32m✓\033[0m Logged: $TEAM | $ACTION"
fi
LOGSCRIPT

chmod +x "$COORDINATION_ROOT/.coordination/log-message.sh"
echo -e "${GREEN}✓${NC} Created log helper: .coordination/log-message.sh"

# Create initial config
echo -e "\n${YELLOW}Creating configuration...${NC}"

cat > "$COORDINATION_ROOT/.coordination/config.yaml" << 'EOF'
# Cross-Project Coordination Configuration (Simplified)
version: "2.0"

teams:
  - mobile
  - backend

logging:
  rotation: monthly
  format: "ISO8601 | Team | Action"
  location: ".coordination/logs"

archive:
  auto_archive_after_action: true
  retention_months: 6
EOF

echo -e "${GREEN}✓${NC} Created config: .coordination/config.yaml"

# Create main README
echo -e "\n${YELLOW}Creating documentation...${NC}"

cat > "$COORDINATION_ROOT/README.md" << 'EOF'
# 🔄 Wildlife Watcher Cross-Project Coordination Hub

**Simple message passing between repositories.**

## Directory Structure (4 Folders)

```
cross-project-coordination/
├── inbox/
│   ├── backend-to-mobile/     # Backend sends here
│   └── mobile-to-backend/     # Mobile sends here
├── archive/
│   └── 2025-10/               # Date-based folders
├── templates/                  # Message templates
└── .coordination/              # Logs & config
    ├── logs/
    │   └── 2025-10.log        # Monthly activity logs
    ├── activity-current.log   # Symlink to current month
    ├── log-message.sh         # Helper script
    └── config.yaml
```

## Workflow

### Sending a Message
```bash
# 1. Copy template
cp templates/schema-change.md inbox/mobile-to-backend/schema-change-20251028.md

# 2. Fill in details
# Edit the file...

# 3. Log it
.coordination/log-message.sh "Mobile" "Sent schema-change message"
```

### Reading & Actioning
```bash
# 1. Read message
cat inbox/backend-to-mobile/schema-change-20251028.md

# 2. Take action
npm run types:local

# 3. Archive it
mv inbox/backend-to-mobile/schema-change-20251028.md archive/$(date +%Y-%m)/

# 4. Log it
.coordination/log-message.sh "Mobile" "Actioned schema-change, types synced"
```

### Responding
```bash
# Create response in the OTHER inbox
echo "Acknowledged" > inbox/mobile-to-backend/ack-schema-change-20251028.md
.coordination/log-message.sh "Mobile" "Sent acknowledgment"
```

## Message Naming

```
YYYYMMDD-HHMM-{type}-{topic}.md
```

Examples:
- `20251028-1800-schema-change-add-permissions.md`
- `20251028-1830-task-request-test-new-endpoint.md`
- `20251028-1900-ack-schema-change-add-permissions.md`

## Activity Log

View all coordination activity:
```bash
# Current month
cat .coordination/activity-current.log

# Specific month
cat .coordination/logs/2025-10.log

# All history
cat .coordination/logs/*.log

# Search
grep "schema-change" .coordination/logs/*.log
```

## Templates

Message templates in `templates/`:
- `task-request.md` - Request work from other team
- `schema-change.md` - Notify schema/database changes
- `status-update.md` - Share project status

Copy and customize as needed.

## That's It!

**Simple. No outbox. No active folder. No status folder.**

Just inbox → action → archive → log.
EOF

echo -e "${GREEN}✓${NC} Created README.md"

# Create sample templates
echo -e "\n${YELLOW}Creating message templates...${NC}"

cat > "$COORDINATION_ROOT/templates/schema-change.md" << 'EOF'
---
type: SCHEMA_CHANGE
priority: HIGH
created: YYYY-MM-DDTHH:MM:SSZ
---

# Backend Schema Change Notification

## Migration Details
- **File**: `YYYYMMDD_migration_name.sql`
- **Type**: [Function/Table/View/RLS]
- **Impact**: [Describe impact on mobile app]

## Action Required

```bash
# Mobile team: Run this command
npm run types:local
git add src/types/supabase.ts
git commit -m "chore(types): sync after [migration name]"
```

## Breaking Changes
- [List any breaking changes]

## Testing
- [What to test after syncing]
EOF

cat > "$COORDINATION_ROOT/templates/task-request.md" << 'EOF'
---
type: TASK_REQUEST
priority: NORMAL
created: YYYY-MM-DDTHH:MM:SSZ
due_date: YYYY-MM-DDTHH:MM:SSZ
---

# Task Request: [Title]

## Context
[Why is this needed?]

## Requirements
- [ ] Requirement 1
- [ ] Requirement 2
- [ ] Requirement 3

## Success Criteria
- [ ] Criteria 1
- [ ] Criteria 2

## Timeline
**Due**: [Date]
**Estimated effort**: [Hours/Days]

## Questions
[Any clarifying questions]
EOF

cat > "$COORDINATION_ROOT/templates/status-update.md" << 'EOF'
---
type: STATUS_UPDATE
priority: NORMAL
created: YYYY-MM-DDTHH:MM:SSZ
---

# Status Update: [Topic]

## Summary
[Brief 1-2 sentence summary]

## Progress
- ✅ Completed: [Items]
- 🔄 In Progress: [Items]
- ⏳ Pending: [Items]
- 🚧 Blocked: [Items]

## Blockers
[List any blockers requiring coordination]

## Next Steps
[What's happening next]

## Timeline
**Current milestone**: [Milestone]
**Expected completion**: [Date]
EOF

echo -e "${GREEN}✓${NC} Created 3 message templates"

# Log this setup
"$COORDINATION_ROOT/.coordination/log-message.sh" "System" "Coordination hub setup completed"

echo -e "\n${GREEN}✅ Simplified coordination hub setup complete!${NC}"
echo -e "\n📊 Structure created:"
echo -e "   • 2 inbox folders (bidirectional)"
echo -e "   • 1 archive folder (date-based)"
echo -e "   • 3 message templates"
echo -e "   • 1 log helper script"
echo -e "   • Monthly auto-rotating logs"
echo -e "\n📍 Location: ${BLUE}$COORDINATION_ROOT${NC}"
echo -e "\n📝 Usage:"
echo -e "   Send: Copy template → Edit → Save to inbox/[direction]/ → Log"
echo -e "   Read: Check inbox → Action → Archive → Log"
echo -e "   Track: cat .coordination/activity-current.log"
