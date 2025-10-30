# tmux Advanced Features - Scrolling & Troubleshooting

[← Back to Index](00-INDEX.md) | [Next: Network Troubleshooting →](07-Troubleshooting-Network.md)

---

## Overview

This guide covers advanced tmux features including window management, troubleshooting common issues, scrolling through output (copy mode), and VS Code integration.

---

## Managing Windows: Renaming, Closing, and Switching

### Renaming Windows

```bash
# Method 1: Interactive (easiest)
# Press: Ctrl+B, , (comma key)
# Type new name, press Enter

# Method 2: From command line (inside tmux)
tmux rename-window "auth-feature"
tmux rename-window "camera-bugfix"

# Method 3: From outside tmux
tmux rename-window -t frontend:0 "main"
tmux rename-window -t frontend:1 "auth-feat"
```

**Workflow for naming windows:**
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

```bash
# Method 1: Graceful exit (recommended)
exit
# or
Ctrl+D

# Method 2: Force kill window
Ctrl+B, &
# Prompt: "kill-window X? (y/n)"
# Press: y

# Method 3: From command line
tmux kill-window
# Kills current window

# Method 4: Kill specific window
tmux kill-window -t frontend:1
# Kills window 1 in frontend session
```

**Important:** You can only detach from **entire sessions**, not individual windows. To "pause" a window, just switch to another window - it keeps running in the background.

### Switch Between Windows

```bash
Ctrl+B, N             # Next window
Ctrl+B, P             # Previous window
Ctrl+B, 0-9           # Jump to window number
Ctrl+B, W             # Window list (interactive picker)
Ctrl+B, L             # Last window (toggle between two)
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

### When to Close vs Detach

```bash
# Close a window: When done with that specific task
exit  # Window gone forever

# Detach from session: When pausing ALL work
Ctrl+B, D  # All windows keep running, can resume later
```

---

## Common tmux Issues and Solutions

### Issue: "tmux: command not found"

```bash
# Solution: Install tmux
sudo apt update && sudo apt install tmux -y
```

### Issue: "error connecting to /tmp/tmux-1000/default"

```bash
# This is NORMAL! It means no sessions are running.
# Just create a session:
tmux new -s frontend
```

### Issue: "Ctrl+B, C does nothing"

```bash
# Check if you're actually inside tmux:
# Look for green bar at bottom of terminal
# If no green bar, you're not in tmux

# If you ARE in tmux:
# Make sure you're pressing: Hold Ctrl, press B, release both, THEN press C
# Not all at once!
```

### Issue: "sessions should be nested with care, unset $TMUX to force"

```bash
# You're trying to create a tmux session inside another tmux session!
# Solution: Exit current session first
exit
# or detach:
Ctrl+B, D

# Then create new session
tmux new -s backend
```

### Issue: "tmux: unknown option -- a"

```bash
# Wrong command format
# ❌ Wrong: tmux -a -t frontend
# ✅ Correct: tmux attach -t frontend
# or short form: tmux a -t frontend
```

### Issue: "duplicate session: frontend"

```bash
# Session already exists!
# Options:
# 1. Attach to existing session:
tmux attach -t frontend

# 2. Kill and recreate:
tmux kill-session -t frontend
tmux new -s frontend

# 3. Use a different name:
tmux new -s frontend-v2
```

### Issue: "session is attached" - can't attach from second terminal

```bash
# Session already open somewhere else
# Options:
# 1. Find that terminal and use it
# 2. Force attach (detaches from other terminal):
tmux attach -t frontend -d

# 3. Share session (both terminals see same thing):
tmux attach -t frontend
```

### Issue: Lost where I am - in tmux or not?

```bash
# Check for green status bar at bottom
# Green bar = IN tmux
# No bar = OUT of tmux (regular bash)

# Or run:
echo $TMUX
# If output is empty = not in tmux
# If output shows path = in tmux
```

---

## Scrolling in tmux (Copy Mode)

When Claude Code outputs a lot of text and it scrolls past, you need to enter "copy mode" to scroll back.

### Method 1: Keyboard (Works Everywhere)

```bash
# Enter copy mode (scroll mode)
Ctrl+B, [

# Now you can scroll:
Arrow Up/Down        # Scroll line by line
Page Up/Down         # Scroll page by page
Ctrl+U               # Scroll half page up
Ctrl+D               # Scroll half page down
g                    # Jump to top of history
G                    # Jump to bottom (latest output)

# Search through output:
/                    # Search forward (type text, press Enter)
?                    # Search backward
n                    # Next search result
N                    # Previous search result

# Exit copy mode:
q                    # Return to normal mode
```

### Method 2: Mouse (If Enabled)

First, enable mouse support:
```bash
# Inside tmux, press: Ctrl+B, :
# Type: set -g mouse on
# Press Enter

# Or add permanently to ~/.tmux.conf:
echo "set -g mouse on" >> ~/.tmux.conf
tmux source ~/.tmux.conf
```

Then scrolling works naturally:
```bash
Scroll wheel up      # Automatically enters copy mode and scrolls up
Scroll wheel down    # Scroll down
Click                # Exit copy mode
```

### Using Copy Mode with Claude Code

```bash
# Claude Code outputs a lot of code
# It scrolls past the screen
# You need to review it

# Step 1: Enter copy mode
Ctrl+B, [

# Step 2: Scroll up to see the code
Page Up (multiple times)
# or
Arrow Up (slowly)

# Step 3: Find specific code
/ (forward slash)
# Type: "function"
# Press Enter
# Press 'n' to find next occurrence

# Step 4: Exit when done
q
```

### Copy Text from Claude Code Output

```bash
# Enter copy mode
Ctrl+B, [

# Navigate to text you want to copy
Arrow keys

# Start selection
Space

# Move to select text
Arrow keys (selection highlights)

# Copy selection
Enter

# Paste it
Ctrl+B, ]

# Or paste in vim/nano:
# Just use normal paste (Ctrl+Shift+V in terminal)
```

### Increase Scrollback History

By default, tmux only keeps 2000 lines of history. For Claude Code's long outputs:

```bash
# Temporarily (in current session):
Ctrl+B, :
# Type: set-option history-limit 50000
# Press Enter

# Permanently (add to ~/.tmux.conf):
echo "set-option -g history-limit 50000" >> ~/.tmux.conf
tmux source ~/.tmux.conf
```

### Quick Reference

```bash
Ctrl+B, [          # Enter scroll mode
Page Up/Down       # Scroll
/text              # Search
n                  # Next match
q                  # Exit scroll mode

# Or if mouse enabled:
Scroll wheel       # Just scroll naturally
```

### Pro Tip for Claude Code

When Claude generates a lot of code, instead of scrolling through tmux:
```bash
# Ask Claude to save output to a file:
"Save that to review.md"

# Then view in VS Code:
code review.md

# Or view in terminal:
less review.md
# (use arrow keys, 'q' to quit)
```

---

## Using tmux with VS Code

### Two Approaches

**Approach A: tmux inside VS Code terminal**
```bash
# In VS Code integrated terminal
tmux new -s work
claude code

# Pro: Everything in one window
# Con: Still somewhat tied to VS Code
```

**Approach B: tmux in separate terminal (RECOMMENDED)**
```bash
# In Windows Terminal:
wsl
tmux new -s frontend
claude code

# In VS Code: Use for editing only
# Pro: Complete independence
# Con: Two windows to manage
```

---

**Related Documents**:
- [tmux Setup](04-Fix-Tmux-Setup.md) - Initial installation
- [tmux Daily Usage](05-Tmux-Daily-Usage.md) - Everyday workflow
- [Quick Reference Commands](08-Quick-Reference-Commands.md) - Command cheatsheet
- [FAQ](10-FAQ.md) - Common questions
- [Index](00-INDEX.md) - Back to main navigation
