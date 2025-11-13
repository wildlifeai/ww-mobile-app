# Frequently Asked Questions (FAQ)

[← Back to Index](00-INDEX.md)

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

### Q: How do I scroll back in tmux to see Claude Code's output?
**A:** Use "copy mode" (scroll mode):

```bash
# Enter scroll mode:
Ctrl+B, [

# Scroll around:
Arrow keys         # Line by line
Page Up/Down       # Page by page
g                  # Jump to top
G                  # Jump to bottom
/text              # Search for "text"
q                  # Exit scroll mode
```

**With mouse enabled:**
```bash
# Enable mouse first:
Ctrl+B, :
# Type: set -g mouse on
# Press Enter

# Then just scroll naturally with scroll wheel
```

**Better approach for long Claude Code output:**
Ask Claude to save output to a file instead of scrolling through terminal:
```bash
"Save that code to review.md"
code review.md  # Open in VS Code
```

### Q: What's the difference between detaching from a session and closing a window?
**A:**

**Detach (Ctrl+B, D):**
- Leaves ALL windows in the session running
- You can reattach later: `tmux attach -t frontend`
- Use when: Taking a break, switching to another session

**Close window (exit or Ctrl+D):**
- Kills that specific window only
- Other windows keep running
- Window is gone forever
- Use when: Finished with that specific task

**Example:**
```bash
# Session with 7 windows running Claude Code
# Close window 3 (done with that task): exit
# Result: 6 windows remain, window 3 is gone

# Detach from session: Ctrl+B, D
# Result: All 6 windows keep running in background
# Reattach later: tmux attach -t frontend
```

---

**Related Documents**:
- [Network Troubleshooting](07-Troubleshooting-Network.md) - Detailed troubleshooting steps
- [Quick Reference Commands](08-Quick-Reference-Commands.md) - Command cheatsheet
- [tmux Advanced Features](06-Tmux-Advanced-Features.md) - Scrolling and advanced usage
- [Index](00-INDEX.md) - Back to main navigation
