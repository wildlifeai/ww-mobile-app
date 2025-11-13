# Network Troubleshooting - Hyper-V & Firewall Issues

[← Back to Index](00-INDEX.md) | [Next: Quick Reference Commands →](08-Quick-Reference-Commands.md)

---

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

## Diagnostic Logs

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

---

**Related Documents**:
- [Memory Fix](03-Fix-Memory-wslconfig.md) - Apply this first
- [Root Cause Analysis](02-Root-Cause-Analysis.md) - Understand the problem
- [Quick Reference Commands](08-Quick-Reference-Commands.md) - Diagnostic commands
- [FAQ](10-FAQ.md) - Common troubleshooting questions
- [Index](00-INDEX.md) - Back to main navigation
