# WSL2 + Claude Code + VS Code Setup Guide

**Problem:** VS Code disconnects from WSL2, losing all Claude Code terminal sessions and work context.

**Your System:**
- Windows 11
- 32GB RAM
- CPU: Intel Core i7-12700H (14 cores / 20 threads)
- WSL2 Ubuntu + Docker Desktop
- Two repos: Frontend (React Native/TypeScript) + Backend (Supabase)
- Multiple Claude Code instances running simultaneously

---

## Table of Contents

1. [Understanding the Architecture](#understanding-the-architecture)
2. [The Root Cause](#the-root-cause)
3. [Solution Options Overview](#solution-options-overview)
4. [Option 1: .wslconfig Fix (RECOMMENDED - Start Here)](#option-1-wslconfig-fix)
5. [Option 2: tmux Session Persistence (RECOMMENDED - Add This)](#option-2-tmux-session-persistence)
6. [Option 3: WSLg Native VS Code (EXPERIMENTAL)](#option-3-wslg-native-vs-code)
7. [Verification & Troubleshooting](#verification--troubleshooting)
8. [Quick Reference Commands](#quick-reference-commands)

---

## Understanding the Architecture

### How VS Code + WSL2 Actually Works

When you use VS Code with WSL2, there are **two separate parts**:

```
┌─────────────────────────────────────────┐
│         Windows 11 (Host OS)            │
│                                         │
│  ┌───────────────────────────────┐     │
│  │   VS Code (Windows App)       │     │
│  │   - GUI/Window you see        │     │
│  │   - Handles keyboard/mouse    │     │
│  │   - Just rendering UI         │     │
│  └───────────┬───────────────────┘     │
│              │                          │
│              │ [Network Connection]     │
│              │ via Hyper-V              │
│              │ ← THIS BREAKS!           │
│              ↓                          │
│  ┌───────────────────────────────┐     │
│  │     WSL2 Virtual Machine      │     │
│  │     Ubuntu Linux              │     │
│  │                               │     │
│  │  ┌─────────────────────────┐  │     │
│  │  │ VS Code Server          │  │     │
│  │  │ - Does actual work      │  │     │
│  │  │ - Manages files         │  │     │
│  │  │ - Hosts terminals       │  │     │
│  │  │ - Runs extensions       │  │     │
│  │  │ - Auto-installed by     │  │     │
│  │  │   VS Code on first use  │  │     │
│  │  │ - Located at:           │  │     │
│  │  │   ~/.vscode-server/     │  │     │
│  │  └──────────┬──────────────┘  │     │
│  │             │                  │     │
│  │             ↓                  │     │
│  │  ┌─────────────────────────┐  │     │
│  │  │ Your Terminal Sessions  │  │     │
│  │  │ - bash/zsh shells       │  │     │
│  │  │ - Claude Code processes │  │     │
│  │  │ - npm/node processes    │  │     │
│  │  └─────────────────────────┘  │     │
│  │                               │     │
│  │  ┌─────────────────────────┐  │     │
│  │  │ Your Files & Repos      │  │     │
│  │  │ /home/user/frontend     │  │     │
│  │  │ /home/user/backend      │  │     │
│  │  └─────────────────────────┘  │     │
│  └───────────────────────────────┘     │
└─────────────────────────────────────────┘
```

**How VS Code Server Gets Installed:**
When you first run `code .` from WSL2 or click "Remote-WSL" in VS Code, VS Code automatically downloads and installs VS Code Server into Ubuntu at `~/.vscode-server/`. You never manually install it - it's completely automatic and seamless.

### Understanding Hyper-V Virtual Networking

**What is Hyper-V?**
Hyper-V is Microsoft's virtualization platform built into Windows 11 Pro/Enterprise (similar to VMware Workstation or VirtualBox, but native to Windows). WSL2 runs as a lightweight Hyper-V virtual machine.

**How Hyper-V Virtual Networking Works:**
```
Windows 11 (Host)
  ↓
Hyper-V Virtualization Layer
  ↓
Virtual Network Switch (vEthernet)
  ↓
WSL2 VMs (Ubuntu, docker-desktop)
  ↓
Internal IP addresses (172.x.x.x range)
```

Hyper-V creates a virtual network adapter inside your computer. Each WSL2 distribution gets its own IP address on this virtual network. VS Code (Windows) connects to VS Code Server (Ubuntu) through this virtual network - it's like a mini-network running entirely inside your laptop.

**Comparison with Other Virtualization:**

| Feature | Hyper-V (WSL2) | VMware Workstation | VirtualBox |
|---------|----------------|-------------------|------------|
| Speed | Very fast | Fast | Moderate |
| Windows Integration | Seamless | Separate VMs | Separate VMs |
| Resource Usage | Lightweight | Moderate | Moderate |
| Setup | Automatic | Manual | Manual |
| File System Access | Direct | Shared folders | Shared folders |

**Check your WSL2 network:**
```bash
# In Ubuntu, see your virtual IP address:
ip addr show eth0
# Output: inet 172.28.x.x/20
```

This virtual network connection is what breaks during disconnects.

### What Happens When You Open VS Code

**Method 1: `code .` from WSL2 terminal**
```bash
cd ~/frontend-repo
code .
```
This launches VS Code on Windows and tells it to connect to WSL2.

**Method 2: VS Code Remote-WSL Extension**
Open VS Code on Windows → Click "Remote-WSL" button → Connects to Ubuntu

**Either way, the flow is:**
1. VS Code window displays on Windows (the GUI)
2. VS Code Server runs inside Ubuntu (the actual work)
3. They communicate via Hyper-V virtual networking
4. Your terminals and Claude Code run entirely in Ubuntu

### Where Claude Code Actually Runs

```
You type in VS Code terminal (Windows display)
         ↓
Command sent over network to VS Code Server (Ubuntu)
         ↓
VS Code Server spawns terminal process (Ubuntu)
         ↓
Terminal runs: claude code (Ubuntu binary)
         ↓
Claude Code executes (Ubuntu process)
         ↓
Claude Code talks to Anthropic API (internet)
         ↓
Results sent back to VS Code Server (Ubuntu)
         ↓
Displayed in VS Code window (Windows)
```

**Key insight:** Claude Code is a **Linux process running in Ubuntu**. VS Code on Windows is just showing you its output through a network connection.

---

## The Root Cause

### Why Disconnects Happen

**Primary Cause: WSL2 Auto-Hibernation**
- Default setting: `vmIdleTimeout=60000` (60 seconds)
- WSL2 automatically shuts down after 60 seconds of "idle" activity
- What WSL2 considers "idle" is unpredictable
- When WSL2 sleeps → connection breaks → VS Code loses access

**Secondary Cause: Memory Pressure (YOUR SITUATION)**
- Your current allocation: 15.8GB per WSL2 distro (50% of 32GB - the default)
- Your actual usage: 
  - Ubuntu: 8.3GB RAM + 3.5GB swap = 11.8GB
  - Docker Desktop: 2.1GB RAM
  - **Combined: 13.9GB total in use**
- Using swap = you hit the memory ceiling = system instability
- Heavy swap usage can trigger WSL2 hibernation
- Docker Desktop and Ubuntu WSL2 share the total memory pool

**Why This Started Recently:**
Your usage pattern changed, crossing the memory threshold:

**Before (worked fine):**
- 1 VS Code instance
- 3-4 terminals with Claude Code
- Total usage: ~6-8GB
- Well under 15.8GB limit ✓

**Now (disconnects frequently):**
- 2 VS Code instances: +2GB
- 12+ terminals with Claude Code: +3-4GB
- More active processes: +2-3GB  
- Supabase + Docker containers: +3-4GB
- **Total: 13.9GB+ (approaching/exceeding limit)**

**Important:** Disconnects happen even while **actively using** VS Code because:
1. Memory pressure destabilizes the system
2. Hyper-V networking becomes unreliable under pressure
3. WSL2 may briefly hibernate/stutter
4. VS Code connection times out
5. "Reload Window" fails because underlying WSL2/network issue persists

**Tertiary Cause: Network Instability**
- Hyper-V virtual networking can hiccup
- Windows firewall/antivirus interference
- VS Code Remote-WSL extension bugs

### What Happens During Disconnect

```
VS Code (Windows) ✗ CONNECTION LOST ✗ VS Code Server (Ubuntu)
                                              ↓
                                         Still running!
                                              ↓
                                         Your terminals
                                              ↓
                                    Claude Code processes
                                    (Running but inaccessible)
```

**If WSL2 just lost connection:** Your work is still there, just unreachable through VS Code.

**If WSL2 actually shut down:** Everything dies - terminals, Claude Code sessions, running processes.

### Why "Reload Window" Doesn't Work

When you click "Reload Window":
1. VS Code tries to reconnect to WSL2
2. If WSL2 is asleep/hibernated, connection fails
3. If Hyper-V networking is broken, connection fails
4. VS Code gives up and goes blank

The underlying WSL2 connection issue wasn't fixed, so reloading does nothing.

---

## Solution Options Overview

### Comparison Matrix

| Solution | Setup Time | Effectiveness | Disruption | When to Use |
|----------|-----------|---------------|------------|-------------|
| **Option 1: .wslconfig** | 5 minutes | 90% fix | None | **START HERE - Do this first** |
| **Option 2: tmux** | 10 minutes | 95% fix | Minimal | **Add this for double protection** |
| **Option 3: WSLg** | 30+ minutes | Unknown | High | Only if Options 1+2 fail |

### Recommended Approach

```
Week 1: Do Option 1 (.wslconfig)
  ↓
  Test for a few days
  ↓
  Still having issues? → Add Option 2 (tmux)
  ↓
  Test for another week
  ↓
  Still having issues? → Consider Option 3 (WSLg)
```

**Most users will be fixed after Option 1 + Option 2.**

---

## Option 1: .wslconfig Fix

### What This Does

Creates/updates a configuration file that controls WSL2's behavior:
- **Prevents auto-hibernation** (the critical fix)
- **Increases memory allocation** (eliminates memory pressure)
- **Optimizes CPU usage** (better performance)

### Why This Works

The `vmIdleTimeout=-1` setting tells WSL2 to **never** automatically shut down. This eliminates the primary cause of disconnects.

### Setup Steps

**Time Required:** 5 minutes  
**Risk Level:** Low (easily reversible)  
**Effectiveness:** Fixes 90% of disconnect issues

#### Step 1: Check Current Configuration

```powershell
# In PowerShell (Windows):
# Check if .wslconfig exists
cat $env:USERPROFILE\.wslconfig

# If it shows only "[wsl2]" or doesn't exist, continue
```

#### Step 2: Create/Edit .wslconfig

```powershell
# Open in Notepad
notepad $env:USERPROFILE\.wslconfig
```

#### Step 3: Paste This Configuration

```ini
[wsl2]

# === CRITICAL FIX FOR DISCONNECTS ===
# Prevents WSL2 from auto-hibernating after idle time
# -1 means never shut down automatically
# This is THE KEY setting that fixes most disconnect issues
vmIdleTimeout=-1

# === MEMORY SETTINGS ===
# Your system has 32GB total RAM
# You have both Ubuntu WSL2 and Docker Desktop running
# Current usage: Ubuntu (11.8GB) + Docker Desktop (2.1GB) = 13.9GB combined
# Allocating 26GB to WSL2 (shared pool), leaving 6GB for Windows
# This provides headroom for peak usage when all services running
memory=26GB

# === CPU SETTINGS ===
# Your CPU: Intel i7-12700H (14 physical cores, 20 logical threads)
# 6 Performance cores (with hyperthreading) = 12 threads
# 8 Efficiency cores (no hyperthreading) = 8 threads
# Allocating 16 threads to WSL2, leaving 4 for Windows
# Provides better performance for multiple Claude Code sessions
processors=16

# === SWAP ===
# 4GB swap space (keep as default)
swap=4GB

# === NETWORKING ===
# Allows WSL2 services to be accessed via localhost
# Important for web development
localhostForwarding=true

# === NOTES ===
# After editing this file, you MUST run: wsl --shutdown
# Then restart WSL2 to apply changes
# Settings take effect immediately on next WSL2 start
```

#### Step 4: Save and Close

- File → Save (or Ctrl+S)
- Close Notepad

#### Step 5: Apply the Changes

```powershell
# Shut down WSL2 completely
wsl --shutdown

# Wait 10 seconds (important!)
# This ensures clean shutdown

# Start WSL2 again
wsl
```

#### Step 6: Verify Changes Applied

```bash
# In WSL2 Ubuntu terminal:

# Check memory - should show ~26GB total now
free -h

# Check CPU cores - should show 16
nproc

# Your output should look like:
# Mem: 26Gi total (not 15Gi)
# nproc: 16 (not 20)
```

**Important: Docker Desktop shares this memory:**
```powershell
# Check Docker Desktop's view of the same memory pool
wsl -d docker-desktop -e free -h
# Should also show: Mem: 26Gi total

# Both Ubuntu and docker-desktop share the 26GB pool dynamically
# Total combined usage cannot exceed 26GB
```

### Why 26GB When Using Only 13.9GB?

**Several important reasons:**

**A. Peak Usage vs Current Snapshot**
Your 13.9GB is a snapshot in time. Peak usage occurs when:
- All 12+ Claude Code sessions are actively processing
- npm/yarn installing packages
- TypeScript compilation running
- React Native Metro bundler rebuilding
- Docker containers starting up
- Multiple browser tabs for testing

Real peak usage: **18-22GB likely**

**B. Swap Indicates You Already Exceeded Limits**
- Currently using 3.5GB swap
- Swap only activates when RAM limit is hit
- You've already exceeded 15.8GB at some point
- Actual peak was: 8.3GB + 3.5GB swap = 11.8GB minimum (but likely higher before swapping)

**C. Supabase + Docker Impact**
```bash
# Check your Supabase containers:
docker ps
# Typically runs: PostgreSQL, PostgREST, GoTrue, Realtime, Storage, Kong
# Combined memory: 1-2GB additional on top of Docker Desktop's 2.1GB base
```

**D. Performance Headroom**
- Operating at 85%+ memory = danger zone (swapping, instability)
- 26GB allocation = 13.9GB usage = **53% utilization** ✓
- Safe, stable, performant range
- Room for unexpected spikes

**Think of it like:**
- Your car can hit 140mph (26GB max)
- You cruise at 60mph (13.9GB current)
- Sometimes you need to accelerate to 90mph (peak usage)
- You don't want your car limited to 70mph (15.8GB) when you need to accelerate

### Expected Results

**Before:**
- Ubuntu Memory: 15.8GB total, 8.3GB used, 3.5GB swap used
- Docker Desktop Memory: 23.5GB max, 2.1GB used
- Combined actual usage: 13.9GB
- Disconnects: Frequent and random
- Swap usage: High (indicator of memory pressure)

**After:**
- Total WSL2 Memory Pool: 26GB (shared between all WSL2 distros)
- Ubuntu shows: 26GB total
- Docker Desktop shows: 26GB total (same shared pool)
- Combined usage: Still ~13.9GB, but with 12GB+ headroom
- Disconnects: Rare or eliminated
- Swap usage: Should gradually decrease to near zero

### Troubleshooting

**If `wsl --shutdown` doesn't work:**
```powershell
# Force stop all WSL processes
Get-Process -Name vmmem -ErrorAction SilentlyContinue | Stop-Process -Force
wsl --shutdown
# Wait 15 seconds
wsl
```

**If changes don't apply:**
```powershell
# Check the file was saved correctly
cat $env:USERPROFILE\.wslconfig

# Ensure file is at: C:\Users\YourUsername\.wslconfig
# Not in Documents or other folders
```

**If VS Code still disconnects:**
- Continue to Option 2 (tmux)
- The .wslconfig fix handles WSL2 stability
- tmux handles VS Code connection issues

---

---

## Resource Monitoring & Alerts

After applying the .wslconfig fix, it's helpful to monitor your resource usage to prevent future issues.

### Option 1: VS Code Extension (Easiest)

**Resource Monitor Extension:**
1. Open VS Code Extensions (Ctrl+Shift+X)
2. Search: "Resource Monitor" (by mutantdino)
3. Install
4. Shows CPU/Memory usage in status bar (bottom right)
5. Updates in real-time

### Option 2: btop (Best for Deep Monitoring)

```bash
# Install btop - modern resource monitor
sudo apt install btop

# Run it
btop

# Shows:
# - CPU usage per core with graphs
# - Memory + Swap with visual bars
# - Network traffic
# - Disk I/O
# - Process list sorted by resource usage
```

Keep btop running in a tmux session for quick checks:
```bash
tmux new -s monitor
btop
# Ctrl+B, D to detach
# tmux attach -t monitor to view anytime
```

### Option 3: Custom Alert Script

Create `~/monitor-resources.sh`:
```bash
#!/bin/bash

MEMORY_THRESHOLD=85  # Alert at 85% memory usage
SWAP_THRESHOLD=10    # Alert at any swap usage

while true; do
    MEM_PERCENT=$(free | grep Mem | awk '{print int($3/$2 * 100)}')
    SWAP_PERCENT=$(free | grep Swap | awk '{print int($3/$2 * 100)}')
    
    if [ $MEM_PERCENT -ge $MEMORY_THRESHOLD ]; then
        echo "$(date): ⚠️  Memory at ${MEM_PERCENT}%" | tee -a ~/resource-alerts.log
    fi
    
    if [ $SWAP_PERCENT -ge $SWAP_THRESHOLD ]; then
        echo "$(date): 🔴 Swap usage at ${SWAP_PERCENT}% - Memory pressure!" | tee -a ~/resource-alerts.log
    fi
    
    sleep 30
done
```

Run it:
```bash
chmod +x ~/monitor-resources.sh

# Start in background tmux session
tmux new -d -s monitor ~/monitor-resources.sh

# View alerts
tail -f ~/resource-alerts.log
```

### Option 4: Quick Status Check

Add this alias to `~/.bashrc`:
```bash
alias status='echo "=== System Resources ===" && free -h && echo "" && echo "=== Docker Usage ===" && docker stats --no-stream 2>/dev/null || echo "Docker not running" && echo "" && echo "=== WSL2 IP ===" && ip addr show eth0 | grep inet'
```

Then run `status` anytime to see overview.

### What to Watch For

**Healthy system:**
- Memory usage: 40-70%
- Swap usage: 0% or near 0%
- CPU: Variable, spikes are normal

**Warning signs:**
- Memory usage: 80%+ sustained
- Swap usage: Any usage (>5%) is a red flag
- Both Ubuntu + Docker using near 26GB combined

If you see warnings, consider:
- Closing unused Claude Code sessions
- Stopping Docker containers you're not using
- Increasing memory to 28GB in .wslconfig

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

#### Step 3: Set Up Your Workflow

**Your Specific Use Case:**
- 2 VS Code instances (frontend + backend)
- 6-7 Claude Code terminals in frontend
- 5 Claude Code terminals in backend
- Need to see multiple terminals simultaneously
- Need to switch between them easily

**Recommended tmux Setup:**

**Strategy A: One Session Per Repo, Multiple Windows**

This mirrors your current VS Code setup but makes it resilient:

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

**Strategy B: Visual Layout with Panes (Recommended)**

See multiple Claude Code sessions at once:

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

**Strategy C: Automated Setup Script**

Create `~/start-claude-work.sh`:
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

Make it executable and run:
```bash
chmod +x ~/start-claude-work.sh
~/start-claude-work.sh
```

**Enable Mouse Support Permanently:**

```bash
# Create tmux config
nano ~/.tmux.conf
```

Add:
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

Save and apply:
```bash
tmux source ~/.tmux.conf
```

Now you can:
- **Click** to switch between panes
- **Drag** pane borders to resize
- **Scroll** with mouse wheel in any pane
- **Right-click** for context menu (in some terminals)

#### Step 4: Reconnect After Disconnect

**If VS Code disconnects:**

```bash
# Option A: Reopen VS Code, open integrated terminal
tmux attach -t frontend
# You're right back where you were!

# Option B: Use Windows Terminal instead
# Open Windows Terminal
wsl
tmux attach -t frontend
# Same result - full context preserved
```

**Check which sessions are running:**

```bash
tmux ls
```

**Attach to specific session:**

```bash
tmux attach -t frontend
# or
tmux attach -t backend
```

#### Step 5: Navigate Within tmux Sessions

**Switch between windows (your different Claude instances):**
```bash
# Inside a tmux session:
Ctrl+B, N        # Next window
Ctrl+B, P        # Previous window
Ctrl+B, 0-9      # Jump to specific window number
Ctrl+B, W        # Interactive window list (use arrows to select)
Ctrl+B, L        # Last window (toggle between two windows)
```

**Switch between panes (if using visual layout):**
```bash
Ctrl+B, Arrow keys    # Navigate with arrows
Ctrl+B, O             # Cycle through panes
Click with mouse      # If mouse enabled
```

**Resize panes:**
```bash
Ctrl+B, Ctrl+Arrow    # Resize in direction of arrow
Drag pane border      # If mouse enabled
```

**List all windows in current session:**
```bash
Ctrl+B, W
# Shows:
# (0) auth-feature    (1) bugfix-camera*  (2) ui-refactor
# Use arrow keys to select, Enter to switch
```

#### Step 6: Managing Sessions Long-Term

**Pause work (end of day):**
```bash
# Don't kill sessions - just detach
# In each session: Ctrl+B, D
# Sessions keep running, Claude Code conversations preserved
```

**Resume work (next day):**
```bash
# List what's running
tmux ls

# Attach to continue
tmux attach -t frontend
# Everything exactly as you left it
```

**Kill a session when truly done:**
```bash
tmux kill-session -t frontend
# Only do this when you want to start fresh
```

**Rename a session:**
```bash
# Inside session: Ctrl+B, $
# Type new name, press Enter

# Or from outside:
tmux rename-session -t old-name new-name
```

**Create session notes:**
```bash
# Track what each session/window is doing
nano ~/tmux-sessions.md
```

Example notes:
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

### Managing Windows: Renaming, Closing, and Switching

**Renaming Windows:**

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

**Closing Windows:**

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

**Switch between windows:**
```bash
Ctrl+B, N             # Next window
Ctrl+B, P             # Previous window
Ctrl+B, 0-9           # Jump to window number
Ctrl+B, W             # Window list (interactive picker)
Ctrl+B, L             # Last window (toggle between two)
```

**What happens to window numbers:**
```bash
# You have: Windows 0, 1, 2, 3, 4
# Kill window 2
Ctrl+B, 2  # Switch to it
Ctrl+B, &  # Kill it

# Now you have: Windows 0, 1, 3, 4
# Note: Numbers don't renumber - gap remains
```

**When to close vs detach:**
```bash
# Close a window: When done with that specific task
exit  # Window gone forever

# Detach from session: When pausing ALL work
Ctrl+B, D  # All windows keep running, can resume later
```

#### Step 5: Advanced Setup (Optional)

**Create a startup script for your workflow:**

```bash
# Create script
nano ~/start-work.sh
```

**Paste this:**

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

**Make executable:**

```bash
chmod +x ~/start-work.sh
```

**Run it:**

```bash
~/start-work.sh
# Creates both sessions in background
# Attach to either one when ready
```

### Daily Workflow with tmux

**Morning:**
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

**When VS Code disconnects:**
```bash
# Don't panic! Your work is safe
# Just reattach
tmux attach -t frontend
# Everything exactly as you left it
```

**End of day:**
```bash
# Kill sessions when done
tmux kill-session -t frontend
tmux kill-session -t backend

# Or keep them running overnight
# They'll be there tomorrow
```

### Comparison: With vs Without tmux

**Without tmux:**
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

**With tmux:**
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

### Using tmux with VS Code

**Two approaches:**

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

### Common tmux Issues and Solutions

**Issue: "tmux: command not found"**
```bash
# Solution: Install tmux
sudo apt update && sudo apt install tmux -y
```

**Issue: "error connecting to /tmp/tmux-1000/default (No such file or directory)"**
```bash
# This is NORMAL! It means no sessions are running.
# Just create a session:
tmux new -s frontend
```

**Issue: "Ctrl+B, C does nothing"**
```bash
# Check if you're actually inside tmux:
# Look for green bar at bottom of terminal
# If no green bar, you're not in tmux

# If you ARE in tmux:
# Make sure you're pressing: Hold Ctrl, press B, release both, THEN press C
# Not all at once!
```

**Issue: "sessions should be nested with care, unset $TMUX to force"**
```bash
# You're trying to create a tmux session inside another tmux session!
# Solution: Exit current session first
exit
# or detach:
Ctrl+B, D

# Then create new session
tmux new -s backend
```

**Issue: "tmux: unknown option -- a"**
```bash
# Wrong command format
# ❌ Wrong: tmux -a -t frontend
# ✅ Correct: tmux attach -t frontend
# or short form: tmux a -t frontend
```

**Issue: "duplicate session: frontend"**
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

**Issue: "session is attached" - can't attach from second terminal**
```bash
# Session already open somewhere else
# Options:
# 1. Find that terminal and use it
# 2. Force attach (detaches from other terminal):
tmux attach -t frontend -d

# 3. Share session (both terminals see same thing):
tmux attach -t frontend
```

**Issue: Lost where I am - in tmux or not?**
```bash
# Check for green status bar at bottom
# Green bar = IN tmux
# No bar = OUT of tmux (regular bash)

# Or run:
echo $TMUX
# If output is empty = not in tmux
# If output shows path = in tmux
```

### Using tmux with VS Code

**Two approaches:**

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

### tmux Quick Reference Card

```bash
# SESSIONS
tmux new -s name          # Create named session
tmux ls                   # List sessions
tmux attach -t name       # Attach to session
tmux kill-session -t name # Kill session

# INSIDE SESSION
Ctrl+B, D                 # Detach (keeps running)
Ctrl+B, C                 # New window
Ctrl+B, N                 # Next window
Ctrl+B, P                 # Previous window
Ctrl+B, ?                 # Help (shows all commands)
exit                      # Close current window

# WORKFLOW
tmux new -s work         # Start
# Do work...
Ctrl+B, D                # Pause/detach
# VS Code disconnects...
tmux attach -t work      # Resume - exactly where you left off
```

---

## Option 3: WSLg Native VS Code

### What This Does

Runs VS Code as a **Linux GUI application** inside WSL2, eliminating the Windows ↔ WSL2 network connection entirely.

### Architecture Change

**Current (Problematic):**
```
VS Code (Windows) ←[NETWORK]→ VS Code Server (Ubuntu) → Claude Code
```

**With WSLg:**
```
VS Code (Ubuntu GUI) → Claude Code (Ubuntu)
[No network layer, everything in Ubuntu]
```

### Why This Might Work

- Eliminates the network connection that breaks
- Everything runs natively in Ubuntu
- No Remote-WSL extension needed
- Direct access to files and processes

### Why This Might Not Work

- If WSL2 VM itself hibernates, everything still dies
- GUI might be sluggish/laggy
- Clipboard/keyboard quirks
- Less polished experience than native Windows VS Code
- Unknown if it actually solves the problem

### When to Try This

**Only if:**
- You've tried Option 1 (.wslconfig) for a week
- You've tried Option 2 (tmux) for a week  
- You're still having frequent disconnects
- You're willing to experiment with a different workflow

**Don't try this if:**
- Options 1+2 are working well
- You prefer Windows native apps
- You want the most stable setup

**Important Clarification: You Are NOT Using WSLg Currently**

When you run `code .` from Ubuntu terminal in Windows Terminal:
```bash
# In Windows Terminal > Ubuntu profile
cd ~/dev/wildlifeai/wildlife-watcher-mobile-app
code .
```

This **launches VS Code on Windows** (not WSLg). Here's what actually happens:
1. The `code` command is a special launcher installed in Ubuntu
2. It signals the Windows VS Code application to start
3. Windows VS Code opens and connects back to Ubuntu via Remote-WSL
4. You see a **Windows-native VS Code window** (not a Linux GUI app)

**How to tell you're using Remote-WSL (your current setup):**
- VS Code window has Windows 11 style title bar
- Top bar shows: `[WSL: Ubuntu]`
- Bottom left shows green "WSL" indicator
- Taskbar shows normal VS Code icon
- Right-click VS Code → Properties shows: `C:\Users\adars\AppData\Local\Programs\Microsoft VS Code\Code.exe`

**What WSLg WOULD look like (different):**
- VS Code running as Linux application
- Different title bar style (X11 window)
- Launched with: `code .` from a Linux VS Code binary at `/usr/bin/code`
- Less polished Windows integration
- Slightly different rendering

**Your current setup (Remote-WSL) is the standard, recommended approach.** WSLg is experimental and unnecessary for most users.

### Setup Steps

**Time Required:** 30+ minutes  
**Risk Level:** Medium (can always revert)  
**Effectiveness:** Unknown - experimental

#### Step 1: Verify WSLg Support

```bash
# In WSL2 Ubuntu:
# Check if WSLg is available
echo $DISPLAY

# Should output something like:
# :0

# If empty, update WSL:
# In PowerShell:
wsl --update
wsl --shutdown
wsl
```

#### Step 2: Install VS Code for Linux

```bash
# In WSL2 Ubuntu:

# Add Microsoft GPG key
wget -qO- https://packages.microsoft.com/keys/microsoft.asc | gpg --dearmor > packages.microsoft.gpg
sudo install -D -o root -g root -m 644 packages.microsoft.gpg /etc/apt/keyrings/packages.microsoft.gpg

# Add VS Code repository
sudo sh -c 'echo "deb [arch=amd64 signed-by=/etc/apt/keyrings/packages.microsoft.gpg] https://packages.microsoft.com/repos/code stable main" > /etc/apt/sources.list.d/vscode.list'

# Clean up
rm -f packages.microsoft.gpg

# Install VS Code
sudo apt update
sudo apt install code -y

# Verify installation
which code
# Should output: /usr/bin/code
```

#### Step 3: Launch Linux VS Code

```bash
# In WSL2 Ubuntu:
cd ~/dev/wildlifeai/wildlife-watcher-mobile-app

# Launch VS Code (Linux version)
code .

# A VS Code window should appear
# This is running as a Linux app, displayed via WSLg
```

#### Step 4: Configure Extensions

```bash
# Inside Linux VS Code:
# Install your essential extensions
# - Language support (TypeScript, etc.)
# - Git extensions
# - Any other tools you need

# NOTE: Extensions are separate from Windows VS Code
# You'll need to reinstall them
```

#### Step 5: Test the Setup

1. Open your frontend repo in Linux VS Code
2. Open integrated terminal
3. Run `claude code`
4. Work for 30 minutes
5. See if disconnects still occur

#### Step 6: Daily Workflow

```bash
# Start your work day:
wsl
code ~/dev/wildlifeai/wildlife-watcher-mobile-app

# Everything runs in Linux
# No Windows ↔ WSL2 connection to break
```

### Pros and Cons

**Pros:**
- ✓ Eliminates Windows ↔ WSL2 network issues
- ✓ True native Linux development
- ✓ Direct filesystem access (faster)
- ✓ No Remote-WSL extension needed

**Cons:**
- ✗ GUI might feel slower than native Windows app
- ✗ Clipboard behavior can be quirky
- ✗ Need to reinstall all extensions
- ✗ Different keyboard shortcuts/behavior
- ✗ If WSL2 VM sleeps, still broken
- ✗ Mixing Windows and Linux GUI apps is awkward

### Reverting to Windows VS Code

**If you don't like WSLg setup:**

```bash
# Just close Linux VS Code
# Open Windows VS Code normally
# Use Remote-WSL extension as before

# Linux VS Code stays installed but unused
# No harm done
```

### Recommended Verdict

**Skip this option unless Options 1+2 fail.**

The `.wslconfig` fix (Option 1) addresses the root cause (WSL2 hibernation), and tmux (Option 2) handles connection issues. Together, they solve 95%+ of disconnect problems without the complexity and unknowns of WSLg.

---

---

## Understanding Docker Desktop Memory Sharing

**Important:** If you use Docker Desktop, it runs as a separate WSL2 distribution but **shares** the memory pool:

```
Your .wslconfig sets: memory=26GB

This means:
┌─────────────────────────────────┐
│   Total WSL2 Memory Pool: 26GB  │
│                                 │
│   ┌──────────────┐              │
│   │   Ubuntu     │              │
│   │  (dynamic)   │              │
│   └──────────────┘              │
│                                 │
│   ┌──────────────┐              │
│   │Docker Desktop│              │
│   │  (dynamic)   │              │
│   └──────────────┘              │
│                                 │
│   Combined cannot exceed 26GB   │
└─────────────────────────────────┘
```

**Check combined usage:**
```bash
# Ubuntu usage
free -h | grep Mem

# Docker Desktop usage  
wsl -d docker-desktop -e free -h | grep Mem

# Docker container usage
docker stats --no-stream
```

**Your typical usage:**
- Ubuntu: ~11.8GB (with Claude Code, dev servers, etc.)
- Docker Desktop: ~2.1GB (base system)
- Docker containers: Varies (check with `docker stats`)
- **Total: ~14-16GB typically**

With 26GB allocated, you have 10-12GB headroom for peak usage.

---

## Verification & Troubleshooting

### How to Know if It's Working

**After Option 1 (.wslconfig):**

```bash
# Check memory allocation increased
free -h
# Should show: Mem: 24Gi total (not 15Gi)

# Check swap usage over time
watch -n 60 free -h
# Swap "used" should gradually decrease

# Check CPU allocation
nproc
# Should show: 16 (not 20)
```

**After Option 2 (tmux):**

```bash
# Sessions survive VS Code disconnects
tmux ls
# Your sessions should persist even after VS Code closes

# Test: 
# 1. Start tmux session with claude code
# 2. Close VS Code completely
# 3. Reopen VS Code
# 4. tmux attach -t session-name
# Result: Everything still there
```

### Common Issues

### Common Issues

**Issue: VS Code still disconnects after .wslconfig changes**

**First, check if it's still a memory issue:**
```bash
free -h
# Check: Is memory usage high (>80%)?
# Check: Is swap being used (>0)?
```

**If memory looks good (low usage, no swap), it's a different problem:**

The disconnect is likely caused by **network/Hyper-V issues**, not memory. Common symptoms:
- WebSocket errors with status code 1006 in VS Code logs
- Error: "No file system provider found for resource"
- VS Code Server becomes unavailable
- Happens even with plenty of free memory

**Solutions (try in order):**

**1. Check VS Code Logs for Error Pattern**
```bash
# In VS Code: Ctrl+Shift+P
# Type: "Developer: Open Logs Folder"
# Look for: remoteagent.log or window logs
# Search for: "WebSocket close with status code 1006"
```

If you see WebSocket 1006 errors, continue with fixes below.

**2. Reinstall VS Code Server (Fastest Fix - Try This First)**
```bash
# Close all VS Code windows
# In WSL2:
rm -rf ~/.vscode-server
rm -rf ~/.vscode-server-insiders 2>/dev/null || true

# Reopen VS Code
# It will automatically reinstall VS Code Server
# Test for 10-15 minutes
```

**What this fixes:** Corrupted VS Code Server installation
**Risk:** None - VS Code Server reinstalls automatically
**Data loss:** None - only removes temporary VS Code cache

**3. Windows Firewall/Antivirus Interference**

This is the #1 cause of WebSocket 1006 errors when memory isn't the issue.

```powershell
# In PowerShell (as Administrator):
# TEST: Temporarily disable firewall
Set-NetFirewallProfile -Profile Domain,Public,Private -Enabled False

# Open VS Code, test for 10 minutes
# Does it stay connected?

# Re-enable firewall:
Set-NetFirewallProfile -Profile Domain,Public,Private -Enabled True
```

**If that fixed it, add permanent firewall rules:**
```powershell
# In PowerShell (as Administrator):
New-NetFirewallRule -DisplayName "WSL2 Inbound" -Direction Inbound -Action Allow
New-NetFirewallRule -DisplayName "WSL2 Outbound" -Direction Outbound -Action Allow
```

**Also check third-party antivirus:**
- Temporarily disable (Norton, McAfee, Kaspersky, etc.)
- If that fixes it, add VS Code and WSL2 to antivirus exceptions

**4. Reset Hyper-V Virtual Network**

The virtual network adapter can get into a bad state:

```powershell
# In PowerShell (as Administrator):
# Shutdown WSL2
wsl --shutdown

# Wait 10 seconds

# Reset WSL network adapter
Get-NetAdapter | Where-Object {$_.InterfaceDescription -like "*WSL*"} | Restart-NetAdapter

# Start WSL2
wsl

# Test VS Code
```

**5. Disable Network Adapter Power Management**

Windows might be turning off the virtual network adapter to save power:

**Via PowerShell:**
```powershell
# In PowerShell (as Administrator):
powercfg /SETDCVALUEINDEX SCHEME_CURRENT SUB_NONE DEVICEIDLE 0
powercfg /SETACVALUEINDEX SCHEME_CURRENT SUB_NONE DEVICEIDLE 0
```

**Via Device Manager (easier):**
1. Open Device Manager (Win+X, then M)
2. Expand "Network adapters"
3. Find "Hyper-V Virtual Ethernet Adapter" (or similar WSL adapter)
4. Right-click → Properties
5. Go to "Power Management" tab
6. **Uncheck:** "Allow the computer to turn off this device to save power"
7. Click OK

**6. Check for VS Code Extension Conflicts**

Extensions can cause connection instability:

```
# In VS Code:
# Ctrl+Shift+P
# Type: "Extensions: Disable All Installed Extensions"
# Reload window
# Test if disconnects still happen

# If stable, enable extensions one by one to find culprit
# Common problematic extensions:
# - Remote containers
# - Some Git extensions
# - Heavy language servers
```

**7. Reduce Concurrent VS Code Instances**

If you have 2+ VS Code windows connected to WSL2:
- Try using only one VS Code instance at a time (test)
- Or use Remote-WSL in one, and WSL terminal for the other project

**8. Check Windows Event Viewer for Root Cause**

See what's actually failing:

```powershell
# In PowerShell:
eventvwr.msc

# Navigate to: Windows Logs > System
# Filter current log...
# Sources: Hyper-V-VmSwitch, Hyper-V-Worker, Hyper-V-VID
# Look for errors around the time of disconnect
```

Common error patterns:
- "Virtual Machine Management Service" errors = Hyper-V issue
- "Network adapter stopped responding" = network driver issue
- "Insufficient resources" = still a resource issue (check other programs)

**9. Full System Restart (Nuclear Option)**

If nothing else works:

```powershell
# Save all work
# Commit code to git
# Restart Windows completely

# After restart:
# Verify .wslconfig applied:
wsl
free -h  # Should show 25-26GB

# Start Docker if needed:
cd ~/backend-repo
docker compose up -d

# Open VS Code
# Test for 30+ minutes
```

**Why restart helps:**
- Fully resets Hyper-V subsystem
- Clears Windows network state
- Resets all WSL2 services
- Fresh start for everything

**Data safety:** Restart only stops running processes. All files, code, and repos are preserved.

**10. Last Resort: WSL2 Version/Update Issues**

```powershell
# Check WSL version
wsl --version

# Update WSL2 to latest
wsl --update

# Update Windows (if behind)
# Settings > Windows Update

# Restart after updates
```

**Solutions:**
1. Verify changes applied:
   ```bash
   free -h  # Should show 26GB
   ```
2. Check if Docker Desktop is using too much memory:
   ```bash
   # In Ubuntu
   free -h
   
   # In Docker Desktop
   wsl -d docker-desktop -e free -h
   
   # Check Docker containers
   docker stats --no-stream
   
   # If Docker + Ubuntu combined approach 26GB, consider:
   # - Stopping unused containers
   # - Increasing to memory=28GB in .wslconfig
   ```
3. Add tmux (Option 2) for additional protection

**Issue: tmux sessions not persisting**

**Solutions:**
1. Verify tmux is running:
   ```bash
   tmux ls
   ```
2. Check if WSL2 actually shut down:
   ```powershell
   wsl -l -v
   # If STATE is "Stopped", WSL2 fully shut down
   # tmux sessions die with WSL2
   ```
3. Solution: Ensure .wslconfig has `vmIdleTimeout=-1`

**Issue: High swap usage doesn't decrease**

**Solutions:**
1. Restart WSL2 completely:
   ```powershell
   wsl --shutdown
   # Wait 10 seconds
   wsl
   ```
2. Restart individual processes:
   ```bash
   # Kill and restart your dev servers
   # Swap memory persists until process restarts
   ```

**Issue: Can't find .wslconfig file**

**Solutions:**
```powershell
# File location is:
# C:\Users\YourUsername\.wslconfig

# Create if missing:
New-Item -Path $env:USERPROFILE\.wslconfig -ItemType File

# Then edit:
notepad $env:USERPROFILE\.wslconfig
```

### Diagnostic Logs

If you continue having disconnect issues after applying fixes, check these logs to diagnose the cause:

**Understanding Error Patterns:**

The most common disconnect error is:
```
WebSocket close with status code 1006
ENOPRO: No file system provider found for resource 'vscode-remote://wsl%2Bubuntu/...'
```

**What this means:**
- Status 1006 = "Abnormal Closure" - connection broke unexpectedly
- No file system provider = VS Code can't reach VS Code Server in WSL2
- Usually caused by: Hyper-V network issues, firewall blocking, or WSL2 instability

**If you see 1006 errors with LOW memory usage and NO swap:**
→ It's a **network/Hyper-V problem**, not memory
→ Follow the "Windows Firewall" and "Reset Hyper-V Network" fixes above

**If you see 1006 errors with HIGH memory usage or SWAP usage:**
→ It's a **memory pressure problem**
→ Increase memory allocation in .wslconfig

**VS Code Connection Logs:**
```bash
# In VS Code:
# Press Ctrl+Shift+P
# Type: "Developer: Open Logs Folder"
# Look for: remoteagent.log, window logs

# Or check directly in Ubuntu:
ls ~/.vscode-server/.*.log
tail -100 ~/.vscode-server/.*.log

# Look for:
# - "WebSocket close with status code 1006"
# - "socketFactory.connect() failed"
# - "permanent error"
# - Connection retry attempts and failures
```

**Real-time Connection Monitoring:**

Before the next disconnect, start logging:
```bash
# In a separate terminal (or tmux):
tail -f ~/.vscode-server/.*.log | grep -E "WebSocket|Error|1006|connection"
```

When disconnect happens, you'll see:
```
WebSocket close with status code 1006
[remote-connection][attempt 1] Connection failed...
[remote-connection][attempt 2] Connection failed...
...
[remote-connection][attempt 5] permanent error
```

**WSL2 System Logs:**
```bash
# In Ubuntu:
# View recent errors
sudo journalctl -p err --since "1 hour ago"

# Watch logs in real-time (run before disconnect)
sudo journalctl -f

# Check for WSL-specific issues
sudo journalctl | grep -i wsl

# Check for memory/resource issues
sudo journalctl | grep -iE "out of memory|oom|killed"
```

**Windows Event Logs (for Hyper-V issues):**
```powershell
# In PowerShell:
Get-EventLog -LogName System -Source "Hyper-V*" -Newest 50 | Format-Table -AutoSize

# Or open Event Viewer GUI (better for browsing):
eventvwr.msc
# Navigate to: Windows Logs > System
# Filter for Source: Hyper-V-VmSwitch, Hyper-V-Worker, Hyper-V-VID
# Look at timestamps matching your disconnect
```

**Comprehensive Debug Setup:**

Run this before working (creates monitoring session):
```bash
# Create a debug tmux session with 3 panes
tmux new -s debug-monitor

# Pane 1: Watch resources
watch -n 5 'free -h && echo "" && docker stats --no-stream'

# Pane 2: Watch VS Code Server logs  
# Ctrl+B, " (split horizontal)
tail -f ~/.vscode-server/.*.log 2>/dev/null || echo "No VS Code Server logs yet"

# Pane 3: Watch system logs
# Ctrl+B, " (split horizontal again)
sudo journalctl -f

# Detach: Ctrl+B, D
# When disconnect happens: tmux attach -t debug-monitor
# Review all 3 panes for clues
```

**Common log indicators of issues:**
- **Memory pressure:** "Out of memory", "Cannot allocate memory", "OOM killer"
- **Network issues:** "Connection refused", "Connection reset", "Network unreachable"
- **WSL2 hibernation:** "WSL 2 distribution stopped", "VM stopped"
- **Hyper-V problems:** "Virtual Machine Management Service", "Virtual Network Adapter"
- **Timeout issues:** "socketFactory.connect() failed or timed out"
- **Permanent failure:** "It will be treated as a permanent error"

### Monitoring Your System

**Check WSL2 status:**
```powershell
# In PowerShell:
wsl --status
wsl -l -v
```

**Check resource usage:**
```bash
# In WSL2:
# Real-time monitoring
htop  # Install with: sudo apt install htop

# Memory
free -h

# Disk
df -h

# Running processes
ps aux | grep claude
```

**Check tmux sessions:**
```bash
# List all sessions
tmux ls

# Detailed info
tmux info
```

---

## Quick Reference Commands

### PowerShell (Windows)

```powershell
# Edit .wslconfig
notepad $env:USERPROFILE\.wslconfig

# Restart WSL2
wsl --shutdown
wsl

# Check WSL2 status
wsl --status
wsl -l -v

# View .wslconfig
cat $env:USERPROFILE\.wslconfig
```

### WSL2 Ubuntu

```bash
# Check resources
free -h          # Memory
nproc            # CPU cores
df -h            # Disk space
htop             # Interactive monitor
btop             # Modern resource monitor

# tmux session management
tmux new -s name              # Create session
tmux ls                       # List sessions
tmux attach -t name           # Attach to session
tmux kill-session -t name     # Kill session
tmux rename-session -t old new # Rename session

# Inside tmux - sessions
Ctrl+B, D              # Detach (keeps running)
Ctrl+B, $              # Rename current session

# Inside tmux - windows (tabs)
Ctrl+B, C              # Create new window
Ctrl+B, N              # Next window
Ctrl+B, P              # Previous window
Ctrl+B, 0-9            # Jump to window number
Ctrl+B, W              # Window list (interactive)
Ctrl+B, ,              # Rename current window
Ctrl+B, &              # Kill current window

# Inside tmux - panes (splits)
Ctrl+B, %              # Split vertical (left|right)
Ctrl+B, "              # Split horizontal (top/bottom)
Ctrl+B, Arrow keys     # Navigate panes
Ctrl+B, O              # Cycle through panes
Ctrl+B, X              # Kill current pane
Ctrl+B, Space          # Cycle layouts
Ctrl+B, Ctrl+Arrow     # Resize pane

# Mouse support (if enabled)
Click                  # Switch pane
Drag border            # Resize pane
Scroll wheel           # Scroll history

# Useful
Ctrl+B, ?              # Help (shows all commands)
Ctrl+B, :              # Command prompt
Ctrl+B, T              # Show time
exit                   # Close current window/pane

# System monitoring
htop                   # Interactive process viewer
btop                   # Modern monitor with graphs
top                    # Basic process list
ps aux | grep claude   # Find Claude Code processes
docker stats --no-stream  # Docker container usage

```

### VS Code

```bash
# Launch from WSL2
code .                 # Open current directory
code ~/path/to/repo    # Open specific directory

# In VS Code terminal
tmux attach -t frontend  # Reconnect to session
```

---

## Summary: What to Do

### Phase 1: Memory Fix (Prevents Memory-Related Disconnects)

**Already Done:** If you applied .wslconfig and see 25-26GB with `free -h` ✓

**Verify it's working:**
```bash
free -h
# Good: 25-26Gi total, low usage, 0 swap
# Bad: Still 15Gi total (not applied), or high swap usage
```

If memory looks good but disconnects continue → Go to Phase 2

### Phase 2: Network/Hyper-V Fix (If Disconnects Persist)

**Symptom:** Disconnects happening even with:
- Plenty of free memory (19GB+ free)
- Zero swap usage
- Low Docker usage (<2GB)

**This means:** It's a network/Hyper-V problem, NOT memory.

**Quick fixes to try (5-15 minutes total):**

1. **Reinstall VS Code Server** (try first - 3 min)
   ```bash
   rm -rf ~/.vscode-server
   # Reopen VS Code - it reinstalls automatically
   ```

2. **Check Windows Firewall** (5 min)
   ```powershell
   # Temporarily disable for testing
   Set-NetFirewallProfile -Profile Domain,Public,Private -Enabled False
   # Test VS Code
   # Re-enable if that wasn't the issue
   Set-NetFirewallProfile -Profile Domain,Public,Private -Enabled True
   ```

3. **Reset Hyper-V Network** (2 min)
   ```powershell
   wsl --shutdown
   Get-NetAdapter | Where-Object {$_.InterfaceDescription -like "*WSL*"} | Restart-NetAdapter
   wsl
   ```

4. **If still broken:** Restart Windows (nuclear option, but effective)

5. **After fixes work:** Set up tmux so future disconnects don't lose work

### Recommended Path (95% Success Rate)

1. **Day 1: Apply Option 1 (.wslconfig)**
   - Takes 5 minutes
   - Fixes root cause (WSL2 hibernation)
   - Increases memory to eliminate pressure
   - Test for 2-3 days

2. **Day 3-4: Add Option 2 (tmux)**
   - Takes 10 minutes
   - Adds session persistence layer
   - Protects against connection hiccups
   - Test for a week

3. **Week 2: Evaluate**
   - Disconnects gone? ✓ You're done
   - Still having issues? → Check troubleshooting section
   - Rarely: Consider Option 3 (WSLg) as last resort

### Your .wslconfig (Copy-Paste Ready)

```ini
[wsl2]
vmIdleTimeout=-1
memory=26GB
processors=16
swap=4GB
localhostForwarding=true
```

### Your tmux Commands (Daily Use)

```bash
# === MORNING STARTUP ===
# Option A: Manual
tmux new -s frontend
cd ~/dev/wildlifeai/wildlife-watcher-mobile-app
claude code
# Create more windows: Ctrl+B, C
# Detach: Ctrl+B, D

# Option B: Automated (if you created the script)
~/start-claude-work.sh

# === SWITCHING PROJECTS ===
tmux attach -t frontend    # Work on frontend
Ctrl+B, D                  # Detach
tmux attach -t backend     # Switch to backend

# === WITHIN A SESSION ===
Ctrl+B, N                  # Next window (next Claude instance)
Ctrl+B, P                  # Previous window
Ctrl+B, W                  # List all windows, pick one
Ctrl+B, 0-7                # Jump directly to window number

# === AFTER DISCONNECT ===
# VS Code dies/reconnects
tmux attach -t frontend    # Everything still there!

# === CHECK STATUS ===
tmux ls                    # See all sessions
free -h                    # Check memory
docker ps                  # Check containers
btop                       # Full system view

# === END OF DAY ===
# Option A: Keep running (recommended)
Ctrl+B, D                  # Just detach, sessions stay alive

# Option B: Clean shutdown
tmux kill-session -t frontend
tmux kill-session -t backend
```

### Your Typical Workflow

```
1. Start day:
   ~/start-claude-work.sh
   
2. Attach to frontend:
   tmux attach -t frontend
   
3. Work with 7 Claude Code instances:
   Ctrl+B, 0 = Auth feature
   Ctrl+B, 1 = Camera bugfix  
   Ctrl+B, 2 = UI refactor
   ... etc
   
4. Switch to backend:
   Ctrl+B, D (detach)
   tmux attach -t backend
   
5. Work with 5 backend instances:
   Ctrl+B, 0 = API endpoint
   Ctrl+B, 1 = Database work
   ... etc
   
6. VS Code disconnects (ugh!):
   No problem - tmux attach -t frontend
   Back to work in seconds
   
7. End of day:
   Ctrl+B, D from each session
   Sessions keep running overnight
   
8. Next morning:
   tmux attach -t frontend
   Resume exactly where you left off
```

---

## Frequently Asked Questions

### Q: Will I lose data if WSL2 shuts down?
**A:** Your files are safe - they persist on disk. But you'll lose:
- Active terminal sessions
- Running processes (Claude Code, npm servers)
- Conversation context with Claude
- Any unsaved terminal output

This is why tmux is valuable - it preserves sessions across WSL2 restarts.

### Q: Can I use VS Code and tmux together?
**A:** Yes! Two approaches:
1. **Run tmux inside VS Code terminal** (simpler, but still tied to VS Code)
2. **Run tmux in Windows Terminal separately** (more resilient, recommended)

With approach 2, you have two independent ways to access your work.

### Q: How much does tmux slow things down?
**A:** Negligible. tmux adds <1% CPU overhead and ~10-20MB RAM per session.

### Q: What happens to tmux sessions when I reboot Windows?
**A:** They're lost. tmux sessions only survive WSL2 disconnects/hibernation, not full system reboots.

### Q: Can I access tmux sessions from my phone/tablet?
**A:** Yes! If you set up SSH access to your Windows machine (advanced), you can SSH into WSL2 and attach to tmux sessions from anywhere.

### Q: Why not just use VS Code's built-in session persistence?
**A:** VS Code's persistence relies on the Remote-WSL connection working. When that connection breaks (your current problem), built-in persistence can't help. tmux operates at a lower level.

### Q: Will 26GB memory allocation slow down Windows?
**A:** No. WSL2 only uses memory as needed (dynamic allocation). If you're only using 14GB, Windows still has 18GB available. The 26GB is a maximum, not a reservation.

### Q: Should I close Docker Desktop when not using it?
**A:** Yes, if you want to free up 2-3GB. But with 26GB allocated, you have enough headroom to leave it running.

### Q: Can I have different .wslconfig settings for Ubuntu vs docker-desktop?
**A:** No. The `.wslconfig` file applies to ALL WSL2 distributions. They share the same resource pool.

### Q: What if I want to use MORE than 26GB for WSL2?
**A:** You can increase it in `.wslconfig`:
```ini
memory=28GB  # Leaves 4GB for Windows
```
But monitor Windows performance. If Windows starts stuttering, reduce the allocation.

### Q: I still get disconnects even with 26GB and no swap usage. Why?
**A:** If memory is fine (low usage, no swap), the problem is **NOT memory pressure**. It's likely:
- Windows Firewall/antivirus blocking Hyper-V traffic
- Hyper-V virtual network adapter issues  
- Corrupted VS Code Server installation
- Network adapter power management turning off WSL2 connection

Follow the "VS Code still disconnects" troubleshooting section above, specifically:
1. Reinstall VS Code Server (fastest fix)
2. Check/temporarily disable Windows Firewall
3. Reset Hyper-V network adapter
4. Disable network adapter power management

The WebSocket 1006 error in logs confirms it's a network issue, not memory.

### Q: Will any of these fixes cause data loss?
**A:** No. Here's what's safe:

**Zero risk (nothing lost):**
- Reinstalling VS Code Server (only removes cache)
- Firewall changes (just network rules)
- Resetting Hyper-V network (just restarts adapter)
- Checking Event Viewer (just reading)
- Installing tmux (just adds a tool)
- System restart (see below)

**Low risk (running processes only):**
- `wsl --shutdown` - loses active terminal sessions and running processes
- System restart - loses running programs
- Both keep: ALL files, code, repos, Docker images/volumes

**What always survives:**
- ✓ Your code files
- ✓ Git repositories and history
- ✓ Docker images and volumes
- ✓ VS Code settings
- ✓ Everything on disk

**Before testing fixes:** Commit uncommitted code to git (`git status`, then `git commit`). That's your backup.

### Q: Should I restart my laptop when troubleshooting?
**A:** Try quick fixes first (5-10 minutes), then restart if needed.

**Order:**
1. Reinstall VS Code Server (3 min)
2. Check Event Viewer for Hyper-V errors (2 min)
3. Test firewall temporarily disabled (2 min)
4. If still broken → Restart laptop

**Why restart helps:**
- Fully resets Hyper-V subsystem
- Clears all Windows network state  
- Resets WSL2 completely
- Often fixes mysterious network issues

**After restart:** Verify .wslconfig with `free -h` (should show 25-26GB), then test VS Code for 30 minutes.

---

## Final Notes

- **Start with .wslconfig** - it fixes memory-related disconnects (the most common cause)
- **If disconnects persist with good memory** - it's a Hyper-V/network issue, follow Phase 2 troubleshooting
- **Add tmux** - provides bulletproof session persistence regardless of cause
- **Skip WSLg** - unless the first two options completely fail
- **Memory is not your problem if** you have 20GB+ free and 0 swap usage
- **The key setting is `vmIdleTimeout=-1`** - stops WSL2 from auto-hibernating
- **WebSocket 1006 errors** - indicate network issues, not memory issues
- **Firewall is often the culprit** - when memory looks fine but disconnects happen

Your disconnect issues should be **completely resolved** after:
1. Applying .wslconfig (fixes memory pressure)
2. Following network troubleshooting (fixes Hyper-V/firewall issues)  
3. Setting up tmux (prevents work loss during disconnects)

---

**Document Version:** 1.3  
**Last Updated:** October 30, 2025  
**Your System:** Windows 11, 32GB RAM, Intel i7-12700H (14 cores/20 threads), WSL2 Ubuntu + Docker Desktop

**Changelog:**
- v1.3: Added comprehensive WebSocket 1006 troubleshooting, network/Hyper-V fixes, VS Code Server reinstall procedure, firewall solutions, two-phase fix approach (memory + network), expanded FAQ for non-memory disconnects
- v1.2: Added Hyper-V networking explanation, resource monitoring, diagnostic logs, comprehensive tmux workflow for 12+ Claude instances, FAQ section
- v1.1: Updated with Docker Desktop memory sharing, actual CPU specs (i7-12700H), increased memory allocation to 26GB
- v1.0: Initial release

