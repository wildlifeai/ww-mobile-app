#!/bin/bash
# coordination-watch.sh
# File watcher for the coordination hub - monitors for new messages and triggers notifications

set -e

# Configuration
COORD_ROOT="$HOME/dev/wildlifeai/cross-project-coordination"
LOG_FILE="$COORD_ROOT/.coordination/logs/watcher.log"
PID_FILE="$COORD_ROOT/.coordination/watcher.pid"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Ensure log directory exists
mkdir -p "$(dirname "$LOG_FILE")"

# Function to log messages
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" >> "$LOG_FILE"
}

# Function to send desktop notification
notify() {
    local title="$1"
    local message="$2"
    local urgency="${3:-normal}"

    # Log the notification
    log "NOTIFY: [$urgency] $title - $message"

    # Platform-specific notification
    if command -v notify-send &> /dev/null; then
        # Linux/WSL with notify-send
        notify-send --urgency="$urgency" "$title" "$message"
    elif [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        osascript -e "display notification \"$message\" with title \"$title\""
    elif [[ "$OSTYPE" == "msys" ]] || [[ "$OSTYPE" == "cygwin" ]]; then
        # Windows (Git Bash/Cygwin)
        powershell -Command "New-BurntToastNotification -Text '$title', '$message'"
    fi

    # Terminal notification (always show)
    echo -e "${YELLOW}📬 $title${NC}"
    echo -e "   $message"
}

# Function to extract metadata from markdown frontmatter
extract_metadata() {
    local file="$1"
    local field="$2"

    # Use awk to extract YAML frontmatter
    awk -v field="$field" '
        /^---$/ { if (NR==1) { in_fm=1; next } else { exit } }
        in_fm && $1 == field":" { gsub(/^[^:]+:[[:space:]]*/, ""); print; exit }
    ' "$file"
}

# Function to process new message
process_message() {
    local file="$1"
    local filename="$(basename "$file")"
    local dir="$(dirname "$file")"

    log "Processing new message: $filename"

    # Extract metadata
    local priority=$(extract_metadata "$file" "priority")
    local type=$(extract_metadata "$file" "type")
    local sender=$(extract_metadata "$file" "sender.team" | sed 's/team: //')
    local recipient=$(extract_metadata "$file" "recipient.team" | sed 's/team: //')
    local title=$(grep "^# " "$file" | head -1 | sed 's/^# //')

    # Determine urgency for notification
    local urgency="normal"
    local emoji="📧"

    case "$priority" in
        "URGENT")
            urgency="critical"
            emoji="🚨"
            ;;
        "HIGH")
            urgency="normal"
            emoji="⚠️"
            ;;
        "NORMAL")
            urgency="low"
            emoji="📬"
            ;;
        "LOW")
            urgency="low"
            emoji="💌"
            ;;
    esac

    # Check if it's for our team
    local our_team=$(grep "^team:" "$COORD_ROOT/.coordination/config.yaml" | head -1 | awk '{print $2}')

    if [[ "$recipient" == "$our_team" ]] || [[ "$recipient" == "all" ]]; then
        # This message is for us!
        notify "$emoji Coordination Message [$priority]" \
               "From: $sender\nType: $type\n$title" \
               "$urgency"

        # Move to active if high priority
        if [[ "$priority" == "URGENT" ]] || [[ "$priority" == "HIGH" ]]; then
            local thread_id=$(extract_metadata "$file" "thread_id")
            if [[ -n "$thread_id" ]]; then
                local thread_dir="$COORD_ROOT/active/threads/$thread_id"
                mkdir -p "$thread_dir/messages"
                mv "$file" "$thread_dir/messages/"
                log "Moved urgent message to active thread: $thread_id"
            fi
        fi

        # Update status file
        echo "$(date '+%Y-%m-%d %H:%M:%S') - New $priority message from $sender" >> "$COORD_ROOT/status/recent-activity.log"
    fi
}

# Function to check for overdue items
check_overdue() {
    log "Checking for overdue items..."

    # Check action items
    find "$COORD_ROOT/action-items" -name "*.md" -type f | while read -r file; do
        local due_date=$(extract_metadata "$file" "due_date")
        if [[ -n "$due_date" ]]; then
            local due_timestamp=$(date -d "$due_date" +%s 2>/dev/null || echo 0)
            local now=$(date +%s)

            if [[ $due_timestamp -lt $now ]] && [[ $due_timestamp -gt 0 ]]; then
                local title=$(grep "^# " "$file" | head -1 | sed 's/^# //')
                notify "⏰ Overdue Action Item" "$title" "critical"
            fi
        fi
    done
}

# Function to start watching
start_watching() {
    # Check if already running
    if [[ -f "$PID_FILE" ]]; then
        local old_pid=$(cat "$PID_FILE")
        if ps -p "$old_pid" > /dev/null 2>&1; then
            echo -e "${YELLOW}⚠${NC}  Watcher already running with PID $old_pid"
            exit 1
        fi
    fi

    echo $$ > "$PID_FILE"
    log "Starting coordination watcher (PID $$)"

    echo -e "${GREEN}✓${NC} Coordination watcher started"
    echo -e "   Monitoring: ${BLUE}$COORD_ROOT/inbox${NC}"
    echo -e "   Log file: ${BLUE}$LOG_FILE${NC}"
    echo -e "   Press Ctrl+C to stop\n"

    # Use inotifywait if available (Linux/WSL), otherwise use polling
    if command -v inotifywait &> /dev/null; then
        # inotify-based watching (efficient)
        inotifywait -m -r -e create,moved_to "$COORD_ROOT/inbox" --format '%w%f' |
        while read filepath; do
            if [[ "$filepath" == *.md ]]; then
                sleep 0.5  # Brief delay to ensure file is fully written
                process_message "$filepath"
            fi
        done &

        WATCH_PID=$!

        # Periodic overdue check (every hour)
        while true; do
            sleep 3600
            check_overdue
        done &

        OVERDUE_PID=$!

        # Wait for interrupt
        trap "kill $WATCH_PID $OVERDUE_PID; rm -f $PID_FILE; echo 'Watcher stopped'; exit 0" INT TERM
        wait

    else
        # Polling-based watching (fallback for macOS and Windows)
        echo -e "${YELLOW}ℹ${NC}  Using polling mode (install inotify-tools for better performance)"

        # Track seen files
        declare -A seen_files

        # Initial scan
        find "$COORD_ROOT/inbox" -name "*.md" -type f | while read -r file; do
            seen_files["$file"]=1
        done

        while true; do
            # Check for new files
            find "$COORD_ROOT/inbox" -name "*.md" -type f | while read -r file; do
                if [[ ! ${seen_files["$file"]} ]]; then
                    seen_files["$file"]=1
                    process_message "$file"
                fi
            done

            # Periodic overdue check
            if [[ $(($(date +%s) % 3600)) -eq 0 ]]; then
                check_overdue
            fi

            sleep 5  # Poll every 5 seconds
        done
    fi
}

# Function to stop watching
stop_watching() {
    if [[ -f "$PID_FILE" ]]; then
        local pid=$(cat "$PID_FILE")
        if ps -p "$pid" > /dev/null 2>&1; then
            kill "$pid"
            rm -f "$PID_FILE"
            log "Stopped coordination watcher (PID $pid)"
            echo -e "${GREEN}✓${NC} Coordination watcher stopped"
        else
            echo -e "${YELLOW}⚠${NC}  Watcher not running"
            rm -f "$PID_FILE"
        fi
    else
        echo -e "${YELLOW}⚠${NC}  No watcher PID file found"
    fi
}

# Main command handling
case "${1:-start}" in
    start)
        start_watching
        ;;
    stop)
        stop_watching
        ;;
    status)
        if [[ -f "$PID_FILE" ]]; then
            local pid=$(cat "$PID_FILE")
            if ps -p "$pid" > /dev/null 2>&1; then
                echo -e "${GREEN}✓${NC} Watcher is running (PID $pid)"
            else
                echo -e "${RED}✗${NC} Watcher is not running (stale PID file)"
            fi
        else
            echo -e "${YELLOW}○${NC} Watcher is not running"
        fi
        ;;
    restart)
        stop_watching
        sleep 1
        start_watching
        ;;
    test)
        # Test notification
        notify "🧪 Test Notification" "Coordination watcher is working!" "normal"
        ;;
    *)
        echo "Usage: $0 {start|stop|status|restart|test}"
        exit 1
        ;;
esac