# tmux Setup - Session Persistence

[← Back to Index](00-INDEX.md) | [Next: tmux Daily Usage →](05-Tmux-Daily-Usage.md)

---

## Option 2: tmux Session Persistence

### Understanding tmux: Sessions, Windows, and Panes

Before diving into setup, it's important to understand tmux's structure:

**The tmux Hierarchy:**
```
tmux Server (one per user)
  ↓
Sessions (independent workspaces - like different projects)
  ↓
Windows (like tabs in a browser - within a session)
  ↓
Panes (split screens - within a window)
```

**What Each Level Means:**

**Sessions** = Independent workspaces for different projects
- Your use case: `frontend` session for mobile app, `backend` session for Supabase
- Can detach/reattach
- Survive disconnects
- Each runs independently

**Windows** = Like browser tabs within a session
- Your use case: Window 0 for auth feature, Window 1 for camera bug, etc.
- Switch between them quickly (Ctrl+B, 0-9)
- Each has a name
- Shows in green status bar at bottom

**Panes** = Split screen within a window
- See multiple terminals at once
- Optional - you don't need panes for your workflow
- More complex to manage

**Browser Analogy:**
| tmux | Browser |
|------|---------|
| Session | Browser profile (Work, Personal) |
| Window | Tab |
| Pane | Split screen view |

**For your 12+ Claude Code instances, use: Sessions + Windows (skip panes)**

### What Does tmux Actually Protect?

### What This Does

tmux (terminal multiplexer) creates persistent terminal sessions that survive disconnections:
- Sessions run **entirely in Ubuntu**
- Independent of VS Code connection
- Can reconnect from any terminal app
- Preserves all running processes and context

### Understanding tmux Fundamentals

Before setting up tmux, understand its three-level hierarchy:

**The tmux Structure:**
```
tmux Server (one per user)
  ↓
Sessions (independent workspaces)
  ↓
Windows (like browser tabs)
  ↓
Panes (split screens) [optional]
```

**Sessions** = Independent workspaces for different projects
- Example: `frontend` session for mobile app, `backend` session for Supabase
- Can detach/reattach independently
- Survive disconnects as long as WSL2 runs
- Each session has its own windows

**Windows** = Like browser tabs within a session
- Example: Window 0 = auth feature, Window 1 = camera bug, etc.
- Switch quickly with `Ctrl+B, 0-9`
- Each window has a name (shown in green status bar)
- Perfect for your 12+ Claude Code instances

**Panes** = Split screen within a window
- Optional - see multiple terminals at once
- More complex to manage
- Not necessary for your workflow

**Browser Analogy:**
| tmux | Browser Equivalent |
|------|-------------------|
| Session | Browser profile (Work, Personal) |
| Window | Tab in browser |
| Pane | Split screen view |

**For your use case:** Use **Sessions + Windows**, skip panes.

### What tmux Protects (and Doesn't)

**✅ tmux WILL save your work from:**
- VS Code disconnects (your main problem)
- Terminal window closes
- Network hiccups
- VS Code crashes
- Remote-WSL connection failures
- Intentional detaching (Ctrl+B, D)

**❌ tmux CANNOT save you from:**
- `wsl --shutdown` (entire WSL2 VM stops)
- Windows restart/reboot
- WSL2 kernel crash
- Power loss/laptop battery dies
- Explicitly killing sessions (`tmux kill-session`)

**The Critical Point:**
Your sessions survive as long as **WSL2 keeps running**. Your `.wslconfig` with `vmIdleTimeout=-1` prevents WSL2 from auto-stopping, so tmux sessions stay alive indefinitely (until reboot or explicit shutdown).

**During a VS Code disconnect:**

❌ Without tmux:
```
VS Code disconnects
  ↓
VS Code Server dies
  ↓
All child processes killed
  ↓
Claude Code conversations lost
  ↓
Start over from scratch
```

✅ With tmux:
```
VS Code disconnects
  ↓
tmux keeps running in WSL2
  ↓
All Claude Code sessions alive
  ↓
Reconnect: tmux attach -t frontend
  ↓
Back to work in 10 seconds
```

### Why This Works

```
WSL2/Ubuntu
  ↓
tmux (session manager running in Ubuntu)
  ↓
Claude Code processes
  ↓
[VS Code connection doesn't matter]
```

Even if VS Code disconnects, your tmux sessions with Claude Code keep running in Ubuntu. You can reconnect via:
- VS Code terminal (when it reconnects)
- Windows Terminal
- Any other terminal app

### When to Use This

- **After** applying Option 1 (.wslconfig)
- If you still experience occasional disconnects
- For extra insurance on important work sessions
- When working on long-running tasks

### Setup Steps

**Time Required:** 10 minutes
**Risk Level:** None (doesn't affect existing workflow)
**Effectiveness:** 95% fix when combined with Option 1

#### Step 1: Install tmux

```bash
# In WSL2 Ubuntu terminal:
sudo apt update
sudo apt install tmux -y

# Verify installation
tmux -V
# Should output: tmux 3.x
```

#### Step 2: Learn Basic tmux Commands

**Essential Commands:**

```bash
# Create new session with a name
tmux new -s session-name

# Detach from session (keeps it running)
# Press: Ctrl+B, then press D

# List all sessions
tmux ls

# Reattach to a session
tmux attach -t session-name

# Kill a session when done
tmux kill-session -t session-name
```

**Inside tmux:**
- `Ctrl+B` is the "prefix key" - press this first, then the command key
- `Ctrl+B, D` = Detach (session keeps running)
- `Ctrl+B, C` = Create new window in session
- `Ctrl+B, N` = Next window
- `Ctrl+B, P` = Previous window

#### Step 3: Test Your Setup

```bash
# Create a test session
tmux new -s test

# Inside tmux, start a process
echo "This is a test"; sleep 300

# Detach from session: Ctrl+B, then D

# Verify session is still running
tmux ls
# Should show: test: 1 windows (created...)

# Reattach to session
tmux attach -t test
# Process should still be running!

# Kill the test session when done
tmux kill-session -t test
```

---

**Related Documents**:
- [tmux Daily Usage](05-Tmux-Daily-Usage.md) - Your everyday workflow
- [tmux Advanced Features](06-Tmux-Advanced-Features.md) - Scrolling and copy mode
- [Quick Reference Commands](08-Quick-Reference-Commands.md) - Command cheatsheet
- [Index](00-INDEX.md) - Back to main navigation
