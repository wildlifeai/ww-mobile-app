#!/bin/bash
# setup-coordination-hub.sh
# Creates the shared coordination hub structure for Wildlife Watcher projects

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
COORDINATION_ROOT="$HOME/dev/wildlifeai/cross-project-coordination"
MOBILE_REPO="$HOME/dev/wildlifeai/wildlife-watcher-mobile-app"
BACKEND_REPO="$HOME/dev/wildlifeai/wildlife-watcher-backend"
WEB_REPO="$HOME/dev/wildlifeai/wildlife-watcher-web-portal"  # Future

echo -e "${BLUE}🔄 Wildlife Watcher Cross-Project Coordination Setup${NC}"
echo -e "${BLUE}=================================================${NC}"

# Function to create directory with description
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

# Step 1: Create root coordination directory
echo -e "\n${YELLOW}Step 1: Creating coordination hub structure...${NC}"

create_dir "$COORDINATION_ROOT" "Central coordination hub for Wildlife Watcher projects"

# Step 2: Create inbox structure
echo -e "\n${YELLOW}Step 2: Setting up inbox directories...${NC}"

create_dir "$COORDINATION_ROOT/inbox" "Incoming unread messages requiring attention"
create_dir "$COORDINATION_ROOT/inbox/mobile-to-backend" "Messages from mobile team to backend team"
create_dir "$COORDINATION_ROOT/inbox/backend-to-mobile" "Messages from backend team to mobile team"
create_dir "$COORDINATION_ROOT/inbox/web-to-mobile" "Messages from web team to mobile team (future)"
create_dir "$COORDINATION_ROOT/inbox/web-to-backend" "Messages from web team to backend team (future)"
create_dir "$COORDINATION_ROOT/inbox/urgent" "High-priority messages requiring immediate attention"

# Step 3: Create active work directories
echo -e "\n${YELLOW}Step 3: Setting up active work directories...${NC}"

create_dir "$COORDINATION_ROOT/active" "Active conversations and ongoing work"
create_dir "$COORDINATION_ROOT/active/threads" "Ongoing conversation threads"
create_dir "$COORDINATION_ROOT/active/tasks" "Active task coordination"
create_dir "$COORDINATION_ROOT/active/tasks/in-progress" "Tasks currently being worked on"
create_dir "$COORDINATION_ROOT/active/tasks/blocked" "Tasks blocked on dependencies"
create_dir "$COORDINATION_ROOT/active/tasks/review" "Tasks ready for review/validation"
create_dir "$COORDINATION_ROOT/active/decisions" "Decision requests"
create_dir "$COORDINATION_ROOT/active/decisions/pending" "Awaiting decision"
create_dir "$COORDINATION_ROOT/active/decisions/resolved" "Recently resolved decisions"

# Step 4: Create status tracking
echo -e "\n${YELLOW}Step 4: Setting up status tracking...${NC}"

create_dir "$COORDINATION_ROOT/status" "Project status synchronization"
create_dir "$COORDINATION_ROOT/status/daily" "Daily status reports"

# Create initial status files
echo "# Mobile App Status" > "$COORDINATION_ROOT/status/mobile-status.md"
echo "# Backend Status" > "$COORDINATION_ROOT/status/backend-status.md"
echo "# Integration Status" > "$COORDINATION_ROOT/status/integration-status.md"

# Step 5: Create action items tracking
echo -e "\n${YELLOW}Step 5: Setting up action items...${NC}"

create_dir "$COORDINATION_ROOT/action-items" "Tracked action items by team"
create_dir "$COORDINATION_ROOT/action-items/mobile" "Mobile team action items"
create_dir "$COORDINATION_ROOT/action-items/backend" "Backend team action items"
create_dir "$COORDINATION_ROOT/action-items/web" "Web team action items (future)"
create_dir "$COORDINATION_ROOT/action-items/shared" "Cross-team action items"

# Step 6: Create templates
echo -e "\n${YELLOW}Step 6: Creating template library...${NC}"

create_dir "$COORDINATION_ROOT/templates" "Message and workflow templates"
create_dir "$COORDINATION_ROOT/templates/messages" "Standard message templates"
create_dir "$COORDINATION_ROOT/templates/workflows" "Workflow documentation"
create_dir "$COORDINATION_ROOT/templates/checklists" "Integration checklists"

# Step 7: Create knowledge base
echo -e "\n${YELLOW}Step 7: Setting up knowledge base...${NC}"

create_dir "$COORDINATION_ROOT/knowledge-base" "Shared documentation and decisions"
create_dir "$COORDINATION_ROOT/knowledge-base/api-contracts" "Agreed API specifications"
create_dir "$COORDINATION_ROOT/knowledge-base/type-definitions" "Shared TypeScript types"
create_dir "$COORDINATION_ROOT/knowledge-base/architecture-decisions" "ADRs and technical decisions"
create_dir "$COORDINATION_ROOT/knowledge-base/integration-guides" "How-to guides for integration"

# Step 8: Create metrics tracking
echo -e "\n${YELLOW}Step 8: Setting up metrics...${NC}"

create_dir "$COORDINATION_ROOT/metrics" "Coordination metrics and analytics"
create_dir "$COORDINATION_ROOT/metrics/response-times" "Message response tracking"
create_dir "$COORDINATION_ROOT/metrics/resolution-rates" "Issue resolution metrics"
create_dir "$COORDINATION_ROOT/metrics/coordination-health" "System health metrics"

# Step 9: Create archive structure
echo -e "\n${YELLOW}Step 9: Setting up archive...${NC}"

create_dir "$COORDINATION_ROOT/archive" "Completed items archive"
create_dir "$COORDINATION_ROOT/archive/$(date +%Y)" "Current year archive"
create_dir "$COORDINATION_ROOT/archive/$(date +%Y)/$(date +%m)" "Current month archive"

# Initialize archive index
echo '{"archives": [], "last_updated": "'$(date -Iseconds)'"}' > "$COORDINATION_ROOT/archive/index.json"

# Step 10: Create system configuration
echo -e "\n${YELLOW}Step 10: Setting up system configuration...${NC}"

create_dir "$COORDINATION_ROOT/.coordination" "System configuration and automation"
create_dir "$COORDINATION_ROOT/.coordination/hooks" "Git hooks and scripts"
create_dir "$COORDINATION_ROOT/.coordination/watchers" "File watcher configurations"
create_dir "$COORDINATION_ROOT/.coordination/logs" "System logs"

# Step 11: Create main README
echo -e "\n${YELLOW}Step 11: Creating documentation...${NC}"

cat > "$COORDINATION_ROOT/README.md" << 'EOF'
# 🔄 Wildlife Watcher Cross-Project Coordination Hub

This is the central coordination hub for all Wildlife Watcher projects.

## Quick Start

1. **Check Inbox**: Look for new messages in `inbox/` subdirectories
2. **Acknowledge**: Move acknowledged messages to `active/threads/`
3. **Update Status**: Keep your team's status file current in `status/`
4. **Complete Work**: Move completed items to `archive/` after validation

## Directory Structure

- 📬 `inbox/` - Incoming messages requiring attention
- 🔄 `active/` - Work in progress (threads, tasks, decisions)
- 📊 `status/` - Current project status by team
- 🎯 `action-items/` - Tracked action items
- 📝 `templates/` - Message and workflow templates
- 📚 `knowledge-base/` - Shared documentation
- 📈 `metrics/` - Coordination metrics
- 🗄️ `archive/` - Completed items
- 🔧 `.coordination/` - System configuration

## Message Naming Convention

```
YYYYMMDD-HHMM-{sender}-{recipient}-{type}-{topic}.md
```

## Priority Levels

- **URGENT**: < 2 hour response required
- **HIGH**: < 8 hour response required
- **NORMAL**: < 24 hour response required
- **LOW**: < 72 hour response required

## Commands

```bash
# Watch for new messages
./coordination-watch.sh

# Check your team's action items
./check-action-items.sh mobile|backend|web

# Update project status
./update-status.sh

# Archive completed threads
./archive-completed.sh
```

## Support

See the full documentation in your project's `cross-project-coordination/` folder.
EOF

# Step 12: Create symbolic links in each repository
echo -e "\n${YELLOW}Step 12: Creating repository links...${NC}"

# Mobile repository
if [ -d "$MOBILE_REPO" ]; then
    MOBILE_COORD="$MOBILE_REPO/project-context/development-context/MVP2/implementation/execution/cross-project-coordination"
    if [ ! -L "$MOBILE_COORD/hub" ]; then
        ln -s "$COORDINATION_ROOT" "$MOBILE_COORD/hub" 2>/dev/null || true
        echo -e "${GREEN}✓${NC} Linked coordination hub to mobile repository"
    fi
else
    echo -e "${YELLOW}⚠${NC}  Mobile repository not found at $MOBILE_REPO"
fi

# Backend repository
if [ -d "$BACKEND_REPO" ]; then
    BACKEND_COORD="$BACKEND_REPO/project-context/cross-project-coordination"
    create_dir "$BACKEND_COORD" "Backend cross-project coordination"
    if [ ! -L "$BACKEND_COORD/hub" ]; then
        ln -s "$COORDINATION_ROOT" "$BACKEND_COORD/hub" 2>/dev/null || true
        echo -e "${GREEN}✓${NC} Linked coordination hub to backend repository"
    fi
else
    echo -e "${YELLOW}⚠${NC}  Backend repository not found at $BACKEND_REPO"
fi

# Step 13: Create initial configuration
echo -e "\n${YELLOW}Step 13: Creating initial configuration...${NC}"

cat > "$COORDINATION_ROOT/.coordination/config.yaml" << 'EOF'
# Cross-Project Coordination Configuration
version: "1.0"

teams:
  - mobile
  - backend
  - web

notifications:
  terminal: true
  desktop: true
  sound: false

priorities:
  URGENT:
    response_time: 2  # hours
    escalation: 1     # hours
    color: red
  HIGH:
    response_time: 8
    escalation: 12
    color: yellow
  NORMAL:
    response_time: 24
    escalation: 48
    color: green
  LOW:
    response_time: 72
    escalation: 168
    color: blue

automation:
  file_watcher: true
  auto_acknowledge: false
  status_sync_interval: 3600  # seconds
  archive_after_days: 30

logging:
  level: info
  max_size: 10485760  # 10MB
  retention_days: 90
EOF

echo -e "\n${GREEN}✅ Coordination hub setup complete!${NC}"
echo -e "\nNext steps:"
echo -e "1. Run ${BLUE}./coordination-watch.sh${NC} to start monitoring"
echo -e "2. Install git hooks with ${BLUE}./install-git-hooks.sh${NC}"
echo -e "3. Create your first coordination message in ${BLUE}inbox/${NC}"
echo -e "\nHub location: ${BLUE}$COORDINATION_ROOT${NC}"