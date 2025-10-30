# Summary Workflow - Quick Fix Guide

[← Back to Index](00-INDEX.md)

**🎯 Use this document for the complete fix sequence**

This is your quick reference for the complete WSL2 disconnect fix workflow. Follow Phase 1 first, then Phase 2 if needed.

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

## Your .wslconfig (Copy-Paste Ready)

```ini
[wsl2]
vmIdleTimeout=-1
memory=26GB
processors=16
swap=4GB
localhostForwarding=true
```

**Location:** `C:\Users\<YourUsername>\.wslconfig`

**After creating/editing:**
```powershell
wsl --shutdown
wsl
```

## Your tmux Commands (Daily Use)

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

## Your Typical Workflow

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

## Quick Troubleshooting

If disconnects still happen:

1. **Check memory status:**
   ```bash
   free -h
   # Should show 25-26GB total, minimal swap usage
   ```

2. **Check Hyper-V network:**
   ```powershell
   # In PowerShell (as admin)
   Get-NetAdapter | Where-Object {$_.InterfaceDescription -like "*WSL*"}
   ```

3. **Check tmux sessions:**
   ```bash
   tmux ls
   # Should show your running sessions
   ```

4. **Nuclear option:**
   - Restart Windows
   - Verify .wslconfig applied: `wsl --shutdown`, then `wsl`, then `free -h`

---

**Related Documents**:
- [Memory Fix](03-Fix-Memory-wslconfig.md) - Detailed .wslconfig guide
- [tmux Setup](04-Fix-Tmux-Setup.md) - Detailed tmux installation
- [tmux Daily Usage](05-Tmux-Daily-Usage.md) - Detailed workflow patterns
- [Network Troubleshooting](07-Troubleshooting-Network.md) - Phase 2 fixes
- [Index](00-INDEX.md) - Back to main navigation

---

**Next Steps:**
1. Apply Phase 1 (.wslconfig) if not already done
2. Test for 2-3 days
3. Add Phase 2 (tmux) if needed
4. Refer to specific guides for deeper troubleshooting
