# tmux Daily Usage - Workflow Patterns

[← Back to Index](00-INDEX.md) | [Next: tmux Advanced Features →](06-Tmux-Advanced-Features.md)

---

## Overview

This guide covers daily workflow patterns for using tmux with multiple Claude Code instances, workspace management strategies, and best practices for maintaining productive development sessions.

---

## Table of Contents

1. [Setting Up Your Workflow](#setting-up-your-workflow)
2. [Workflow Strategy A: One Session Per Repo](#strategy-a-one-session-per-repo-multiple-windows)
3. [Workflow Strategy B: Visual Layout with Panes](#strategy-b-visual-layout-with-panes-recommended)
4. [Workflow Strategy C: Automated Setup Script](#strategy-c-automated-setup-script)
5. [Permanent Configuration](#enable-mouse-support-permanently)
6. [Reconnecting After Disconnect](#reconnecting-after-disconnect)
7. [Navigation Within tmux Sessions](#navigation-within-tmux-sessions)
8. [Managing Sessions Long-Term](#managing-sessions-long-term)
9. [Managing Windows](#managing-windows-renaming-closing-and-switching)
10. [Advanced Startup Scripts](#advanced-startup-scripts)
11. [Daily Workflow Examples](#daily-workflow-with-tmux)
12. [With vs Without tmux Comparison](#comparison-with-vs-without-tmux)

---

## Setting Up Your Workflow

### Your Specific Use Case

When working with multiple repositories and Claude Code instances:

- **2 VS Code instances** (frontend + backend)
- **6-7 Claude Code terminals** in frontend
- **5 Claude Code terminals** in backend
- Need to **see multiple terminals simultaneously**
- Need to **switch between them easily**

### Recommended tmux Setup

Choose one of the following strategies based on your workflow preference:

---

## Strategy A: One Session Per Repo, Multiple Windows

This mirrors your current VS Code setup but makes it resilient:

### Frontend Session Setup

```bash
# === FRONTEND SESSION ===
tmux new -s frontend
cd ~/dev/wildlifeai/wildlife-watcher-mobile-app

# Window 0: Claude Code instance 1
claude code
# Give it a descriptive task name

# Create more windows for more Claude instances:
# Ctrl+B, C (creates new window)
claude code

# Repeat 7 times total for your 7 frontend Claude instances

# Name your windows:
# Ctrl+B, , (comma key)
# Type: "auth-feature" or "bugfix-camera" etc.

# Detach from session: Ctrl+B, D
```

### Backend Session Setup

```bash
# === BACKEND SESSION ===
tmux new -s backend
cd ~/path/to/backend-repo

# Create 5 windows, each with claude code
# Window 0: API work
claude code
# Ctrl+B, C for next window
# Window 1: Database work
claude code
# ... repeat 5 times total

# Name each window descriptively
# Detach: Ctrl+B, D
```

**Advantages:**
- Simple window-based navigation
- Easy to organize by feature/task
- Familiar to VS Code users

---

## Strategy B: Visual Layout with Panes (Recommended)

See multiple Claude Code sessions at once in a split-screen layout:

### Creating Visual Layout

```bash
# Start frontend session
tmux new -s frontend-visual
cd ~/dev/wildlifeai/wildlife-watcher-mobile-app

# Enable mouse support for easy clicking
# Ctrl+B, : (colon)
# Type: set -g mouse on
# Press Enter

# Create a 2x3 grid of Claude Code instances:

# Start first Claude Code
claude code

# Split vertically: Ctrl+B, %
# Now you have 2 panes side-by-side
# In new pane:
claude code

# Go back to first pane: Ctrl+B, ← (left arrow)
# Split horizontally: Ctrl+B, "
# In new pane:
claude code

# Go to right pane: Ctrl+B, → (right arrow)
# Split horizontally: Ctrl+B, "
# In new pane:
claude code

# Result: 4 Claude Code instances visible at once
# ┌────────────┬────────────┐
# │ Claude 1   │ Claude 3   │
# │ (auth)     │ (testing)  │
# ├────────────┼────────────┤
# │ Claude 2   │ Claude 4   │
# │ (bugfix)   │ (docs)     │
# └────────────┴────────────┘

# Click with mouse to switch between panes
# Or use: Ctrl+B, Arrow keys

# Create more windows for additional Claude instances:
# Ctrl+B, C (creates window 1)
# Repeat the split process for more instances
```

**Advantages:**
- See multiple Claude instances simultaneously
- Visual context of different tasks
- Mouse support for easy navigation
- Ideal for monitoring multiple workflows

---

## Strategy C: Automated Setup Script

Automate the creation of your entire workspace:

### Create Setup Script

```bash
# Create script file
nano ~/start-claude-work.sh
```

### Script Content

```bash
#!/bin/bash

FRONTEND_DIR=~/dev/wildlifeai/wildlife-watcher-mobile-app
BACKEND_DIR=~/path/to/backend-repo

echo "🚀 Starting Claude Code sessions..."

# Create frontend session with 7 windows
tmux new -d -s frontend -c "$FRONTEND_DIR"
tmux send-keys -t frontend:0 'claude code' Enter
tmux rename-window -t frontend:0 'auth-feature'

for i in {1..6}; do
    tmux new-window -t frontend -c "$FRONTEND_DIR"
    tmux send-keys -t frontend:$i 'claude code' Enter
    tmux rename-window -t frontend:$i "claude-$i"
done

# Create backend session with 5 windows
tmux new -d -s backend -c "$BACKEND_DIR"
tmux send-keys -t backend:0 'claude code' Enter
tmux rename-window -t backend:0 'api-work'

for i in {1..4}; do
    tmux new-window -t backend -c "$BACKEND_DIR"
    tmux send-keys -t backend:$i 'claude code' Enter
    tmux rename-window -t backend:$i "backend-$i"
done

echo "✅ Sessions created!"
echo ""
echo "📋 Available sessions:"
tmux ls
echo ""
echo "🔗 Connect to frontend: tmux attach -t frontend"
echo "🔗 Connect to backend:  tmux attach -t backend"
```

### Make Executable and Run

```bash
chmod +x ~/start-claude-work.sh
~/start-claude-work.sh
```

**Advantages:**
- One-command workspace setup
- Consistent session structure
- Customizable window names
- Fast startup after system reboot

---

## Enable Mouse Support Permanently

### Create tmux Configuration

```bash
# Create tmux config file
nano ~/.tmux.conf
```

### Configuration Content

```
# Enable mouse support
set -g mouse on

# Better colors
set -g default-terminal "screen-256color"

# Larger scrollback
set -g history-limit 10000

# Make pane borders visible
set -g pane-border-style fg=colour238
set -g pane-active-border-style fg=colour51

# Show window list in status bar
set -g status-left-length 40
```

### Apply Configuration

```bash
# Apply without restarting tmux
tmux source ~/.tmux.conf
```

### Mouse Features Enabled

Now you can:
- **Click** to switch between panes
- **Drag** pane borders to resize
- **Scroll** with mouse wheel in any pane
- **Right-click** for context menu (in some terminals)

---

## Reconnecting After Disconnect

### When VS Code Disconnects

**Option A: Reopen VS Code**
```bash
# Open VS Code, open integrated terminal
tmux attach -t frontend
# You're right back where you were!
```

**Option B: Use Windows Terminal**
```bash
# Open Windows Terminal
wsl
tmux attach -t frontend
# Same result - full context preserved
```

### Check Running Sessions

```bash
# List all running tmux sessions
tmux ls
```

### Attach to Specific Session

```bash
# Attach to frontend session
tmux attach -t frontend

# Attach to backend session
tmux attach -t backend
```

---

## Navigation Within tmux Sessions

### Switch Between Windows

Different Claude instances in separate windows:

```bash
# Inside a tmux session:
Ctrl+B, N        # Next window
Ctrl+B, P        # Previous window
Ctrl+B, 0-9      # Jump to specific window number
Ctrl+B, W        # Interactive window list (use arrows to select)
Ctrl+B, L        # Last window (toggle between two windows)
```

### Switch Between Panes

For visual layouts with split panes:

```bash
Ctrl+B, Arrow keys    # Navigate with arrows
Ctrl+B, O             # Cycle through panes
Click with mouse      # If mouse enabled
```

### Resize Panes

```bash
Ctrl+B, Ctrl+Arrow    # Resize in direction of arrow
Drag pane border      # If mouse enabled
```

### List All Windows

```bash
Ctrl+B, W
# Shows:
# (0) auth-feature    (1) bugfix-camera*  (2) ui-refactor
# Use arrow keys to select, Enter to switch
```

---

## Managing Sessions Long-Term

### Pause Work (End of Day)

```bash
# Don't kill sessions - just detach
# In each session: Ctrl+B, D
# Sessions keep running, Claude Code conversations preserved
```

**Important:** Sessions remain active and consume memory. Kill sessions when truly finished with work.

### Resume Work (Next Day)

```bash
# List what's running
tmux ls

# Attach to continue
tmux attach -t frontend
# Everything exactly as you left it
```

### Kill a Session

```bash
# Kill when truly done
tmux kill-session -t frontend
# Only do this when you want to start fresh
```

### Rename a Session

```bash
# Method 1: Inside session
Ctrl+B, $
# Type new name, press Enter

# Method 2: From outside
tmux rename-session -t old-name new-name
```

### Create Session Notes

Track what each session/window is doing:

```bash
# Create notes file
nano ~/tmux-sessions.md
```

Example notes structure:
```markdown
# Active Work Sessions

## frontend (12 windows)
- Window 0: Authentication - OAuth implementation
- Window 1: Camera - Fixing Android crash
- Window 2: UI - Theme color refactor
- Window 3: Testing - Writing unit tests
- Window 4: Code review - PR #123
- Window 5: API integration - User profiles
...

## backend (5 windows)
- Window 0: API endpoint - User profile CRUD
- Window 1: Database - Schema migration
- Window 2: Auth - JWT refresh tokens
...
```

---

## Managing Windows: Renaming, Closing, and Switching

### Renaming Windows

**Method 1: Interactive (Easiest)**
```bash
# Press: Ctrl+B, , (comma key)
# Type new name, press Enter
```

**Method 2: From Command Line (Inside tmux)**
```bash
tmux rename-window "auth-feature"
tmux rename-window "camera-bugfix"
```

**Method 3: From Outside tmux**
```bash
tmux rename-window -t frontend:0 "main"
tmux rename-window -t frontend:1 "auth-feat"
```

### Workflow for Naming Windows

```bash
# Create window
Ctrl+B, C

# Immediately name it
Ctrl+B, ,
# Type: "auth-feature"
# Press Enter

# Start your work
cd ~/dev/wildlifeai/wildlife-watcher-mobile-app
claude code
```

### Closing Windows

**Method 1: Graceful Exit (Recommended)**
```bash
exit
# or
Ctrl+D
```

**Method 2: Force Kill Window**
```bash
Ctrl+B, &
# Prompt: "kill-window X? (y/n)"
# Press: y
```

**Method 3: From Command Line**
```bash
# Kills current window
tmux kill-window

# Kill specific window
tmux kill-window -t frontend:1
```

### Important: Detach vs Close

**You can only detach from entire sessions, not individual windows.**

To "pause" a window, just switch to another window - it keeps running in the background.

```bash
# Close a window: When done with that specific task
exit  # Window gone forever

# Detach from session: When pausing ALL work
Ctrl+B, D  # All windows keep running, can resume later
```

### Window Number Behavior

```bash
# You have: Windows 0, 1, 2, 3, 4
# Kill window 2
Ctrl+B, 2  # Switch to it
Ctrl+B, &  # Kill it

# Now you have: Windows 0, 1, 3, 4
# Note: Numbers don't renumber - gap remains
```

---

## Advanced Startup Scripts

### Smart Session Initialization

Create a script that checks if sessions exist before creating them:

```bash
# Create script
nano ~/start-work.sh
```

### Script Content

```bash
#!/bin/bash

# Start frontend session if not running
if ! tmux has-session -t frontend 2>/dev/null; then
    tmux new -d -s frontend -c ~/dev/wildlifeai/wildlife-watcher-mobile-app
fi

# Start backend session if not running
if ! tmux has-session -t backend 2>/dev/null; then
    tmux new -d -s backend -c ~/path/to/backend-repo
fi

echo "Sessions ready:"
tmux ls
```

### Make Executable and Run

```bash
chmod +x ~/start-work.sh

# Run it
~/start-work.sh
# Creates both sessions in background
# Attach to either one when ready
```

---

## Daily Workflow with tmux

### Morning Routine

```bash
# Check what sessions exist
tmux ls

# Attach to frontend work
tmux attach -t frontend

# Start Claude Code if not running
claude code

# Work...
# Detach: Ctrl+B, D

# Switch to backend
tmux attach -t backend
claude code
# Work...
```

### When VS Code Disconnects

```bash
# Don't panic! Your work is safe
# Just reattach
tmux attach -t frontend
# Everything exactly as you left it
```

### End of Day

```bash
# Option 1: Kill sessions when done
tmux kill-session -t frontend
tmux kill-session -t backend

# Option 2: Keep them running overnight
# They'll be there tomorrow
# (Note: Uses system memory)
```

---

## Comparison: With vs Without tmux

### Without tmux

```
VS Code disconnects
  ↓
All terminal sessions lost
  ↓
Claude Code conversations gone
  ↓
Start over from scratch
  ↓
Re-explain context to Claude
  ↓
Lost 30-60 minutes of work
```

### With tmux

```
VS Code disconnects
  ↓
tmux sessions still running
  ↓
Reconnect: tmux attach -t frontend
  ↓
Back to work in 10 seconds
  ↓
Full context preserved
```

### Time Savings Analysis

**Scenario:** VS Code disconnects 3 times per day

**Without tmux:**
- 3 disconnects × 30 minutes recovery = **90 minutes lost daily**
- Lost context and conversation state
- Frustration and momentum disruption

**With tmux:**
- 3 disconnects × 10 seconds reconnect = **30 seconds lost daily**
- Full context preserved
- Seamless workflow continuation

**Annual time saved:** ~360 hours (assuming 250 work days/year)

---

## Best Practices Summary

### Session Organization

1. **One session per repository** - Keeps work logically separated
2. **Descriptive window names** - "auth-feature" not "window-1"
3. **Session notes** - Document what each window is doing
4. **Regular cleanup** - Kill completed sessions to free memory

### Navigation Efficiency

1. **Learn keyboard shortcuts** - Faster than mouse for power users
2. **Use window list** (`Ctrl+B, W`) - Quick visual picker
3. **Enable mouse support** - Helpful for beginners and pane resizing
4. **Create window naming workflow** - Name immediately after creation

### Persistence Strategy

1. **Detach instead of close** - Preserve work when taking breaks
2. **Kill when truly done** - Don't accumulate dormant sessions
3. **Use startup scripts** - Consistent workspace initialization
4. **Check running sessions** - Run `tmux ls` daily

### Workflow Integration

1. **Start tmux on system boot** - Add to shell profile if desired
2. **Create project-specific scripts** - Automate common layouts
3. **Document your setup** - Future you will thank you
4. **Share patterns with team** - Standardize development environment

---

**Related Documents**:
- [tmux Setup](04-Fix-Tmux-Setup.md) - Initial installation and configuration
- [tmux Advanced Features](06-Tmux-Advanced-Features.md) - Scrolling, copy/paste, and power user features
- [Quick Reference Commands](08-Quick-Reference-Commands.md) - Command cheatsheet
- [Index](00-INDEX.md) - Back to main navigation
