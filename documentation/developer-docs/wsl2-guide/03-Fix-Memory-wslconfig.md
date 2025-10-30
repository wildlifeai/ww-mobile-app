# Memory Fix - .wslconfig Configuration

[← Back to Index](00-INDEX.md) | [Next: tmux Setup →](04-Fix-Tmux-Setup.md)

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

**Related Documents**:
- [Root Cause Analysis](02-Root-Cause-Analysis.md) - Why this fix works
- [tmux Setup](04-Fix-Tmux-Setup.md) - Add session persistence next
- [Network Troubleshooting](07-Troubleshooting-Network.md) - If disconnects persist
- [Index](00-INDEX.md) - Back to main navigation
