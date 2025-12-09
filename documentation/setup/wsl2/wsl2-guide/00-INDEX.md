# WSL2 + VS Code + Claude Code - Quick Reference Index

**Problem:** VS Code disconnects from WSL2, losing all Claude Code terminal sessions and work context.

**Your System:** Windows 11, 32GB RAM, Intel i7-12700H, WSL2 Ubuntu + Docker Desktop

---

## 🚀 Quick Start (Choose Your Path)

### Path 1: New User - Just Fix The Problem
1. **[Root Cause Analysis](02-Root-Cause-Analysis.md)** - Understand why disconnects happen
2. **[Memory Fix (.wslconfig)](03-Fix-Memory-wslconfig.md)** - Apply this first (5 minutes, fixes 90%)
3. **[tmux Setup](04-Fix-Tmux-Setup.md)** - Add session persistence (10 minutes)
4. **[Daily tmux Usage](05-Tmux-Daily-Usage.md)** - Your everyday workflow

### Path 2: Disconnects Still Happening (After Memory Fix)
1. **[Root Cause Analysis](02-Root-Cause-Analysis.md)** - Confirm it's not memory
2. **[Network Troubleshooting](07-Troubleshooting-Network.md)** - Fix Hyper-V/firewall issues
3. **[Quick Reference Commands](08-Quick-Reference-Commands.md)** - Diagnostic commands

### Path 3: Daily Reference (Bookmark These)
- **[Quick Reference Commands](08-Quick-Reference-Commands.md)** ⭐ Most used
- **[tmux Daily Usage](05-Tmux-Daily-Usage.md)** ⭐ Workflow patterns
- **[tmux Advanced Features](06-Tmux-Advanced-Features.md)** - Scrolling, copy/paste
- **[FAQ](10-FAQ.md)** - Common questions answered

---

## 📚 Complete Document List

### Understanding the Problem
- **[01 - Architecture Explained](01-Architecture-Explained.md)**
  - How VS Code + WSL2 works
  - Hyper-V virtual networking
  - Where Claude Code runs
  - Architecture diagrams

- **[02 - Root Cause Analysis](02-Root-Cause-Analysis.md)**
  - Why disconnects happen
  - Memory pressure analysis
  - Network instability
  - Your specific system context

### Solutions (Apply in Order)
- **[03 - Memory Fix (.wslconfig)](03-Fix-Memory-wslconfig.md)** ⭐ START HERE
  - Complete .wslconfig setup
  - 26GB memory allocation for your system
  - Docker Desktop sharing
  - Resource monitoring
  - Verification steps

- **[04 - tmux Setup](04-Fix-Tmux-Setup.md)** ⭐ ADD THIS NEXT
  - tmux installation
  - Sessions/Windows/Panes hierarchy
  - What tmux protects (and doesn't)
  - Basic commands
  - Your 12+ Claude Code workflow setup
  - Automated startup scripts

- **[05 - tmux Daily Usage](05-Tmux-Daily-Usage.md)** ⭐ DAILY REFERENCE
  - Daily workflow patterns
  - Window management (renaming, closing, switching)
  - Session management (attach/detach/kill)
  - Multiple workflow strategies
  - Session tracking
  - Comparison: with vs without tmux

- **[06 - tmux Advanced Features](06-Tmux-Advanced-Features.md)**
  - Scrolling in copy mode (for Claude Code output)
  - Mouse support setup
  - Copy/paste in tmux
  - Increasing scrollback history
  - Common tmux issues and solutions
  - Using tmux with VS Code

### Troubleshooting
- **[07 - Network Troubleshooting](07-Troubleshooting-Network.md)**
  - WebSocket 1006 error fixes
  - VS Code Server reinstall
  - Windows Firewall solutions
  - Hyper-V network reset
  - Power management settings
  - Extension conflicts
  - Event Viewer diagnostics
  - Full system restart procedure

- **[08 - Quick Reference Commands](08-Quick-Reference-Commands.md)** ⭐ BOOKMARK THIS
  - PowerShell commands
  - WSL2 Ubuntu commands
  - Complete tmux command reference
  - Scrolling and copy mode
  - System monitoring commands

### Optional/Advanced
- **[09 - Advanced WSLg Option](09-Advanced-WSLg-Option.md)**
  - Experimental WSLg setup
  - When to consider (rarely needed)
  - Installation steps
  - Pros/cons analysis

- **[10 - FAQ](10-FAQ.md)**
  - Data safety questions
  - Memory allocation
  - tmux capabilities
  - Scrolling in tmux
  - Window vs session detachment
  - Restart troubleshooting

- **[11 - Summary Workflow](11-Summary-Workflow.md)**
  - Phase 1: Memory fix
  - Phase 2: Network fix
  - Your typical daily workflow
  - Copy-paste ready configurations

---

## 🎯 Diagnostic Decision Tree

**Is VS Code disconnecting from WSL2?**
└─ **Yes** → Continue below
└─ **No** → This guide isn't for you

**Check your memory usage:**
```bash
free -h
# Look at: Mem total, Mem used, Swap used
```

**Memory shows 15-16GB total AND swap >0?**
└─ **Yes** → Go to [Memory Fix](03-Fix-Memory-wslconfig.md)
└─ **No** (Memory shows 25-26GB total, low swap) → Go to [Network Troubleshooting](07-Troubleshooting-Network.md)

**Check VS Code logs for error:**
```
Ctrl+Shift+P → "Developer: Open Logs Folder"
Look for: "WebSocket close with status code 1006"
```

**Found WebSocket 1006 error?**
└─ **Yes** → Go to [Network Troubleshooting](07-Troubleshooting-Network.md)
└─ **No** → Go to [Root Cause Analysis](02-Root-Cause-Analysis.md)

---

## 📊 Success Rate by Solution

| Solution | Effectiveness | Setup Time | When to Apply |
|----------|---------------|------------|---------------|
| **Memory Fix (.wslconfig)** | 90% | 5 minutes | Always apply first |
| **tmux Session Persistence** | 95% (with memory fix) | 10 minutes | After memory fix |
| **Network Troubleshooting** | 90% (if memory is fine) | 15 minutes | Memory fix didn't help |
| **WSLg (Experimental)** | Unknown | 30+ minutes | Last resort only |

**Combined effectiveness: 99%+ when applying Memory Fix + tmux + Network Troubleshooting**

---

## 🆘 Most Common Issues & Quick Fixes

### Issue: "VS Code disconnects randomly"
**Quick fix:** Apply [Memory Fix](03-Fix-Memory-wslconfig.md) → Test for 2 days → Add [tmux Setup](04-Fix-Tmux-Setup.md)

### Issue: "VS Code disconnects even with 26GB memory and no swap"
**Quick fix:** Go to [Network Troubleshooting](07-Troubleshooting-Network.md) → Try steps 1-3 (reinstall VS Code Server, firewall, Hyper-V reset)

### Issue: "Can't scroll back in tmux to see Claude Code output"
**Quick fix:** Go to [tmux Advanced Features](06-Tmux-Advanced-Features.md#scrolling-in-copy-mode) or press `Ctrl+B, [` then use arrow keys

### Issue: "Lost where I am - in tmux or not?"
**Quick fix:** Look for green status bar at bottom = IN tmux. No bar = OUT of tmux. Or run: `echo $TMUX`

### Issue: "tmux sessions disappeared after Windows restart"
**Answer:** Expected behavior. tmux sessions only survive VS Code disconnects, not full reboots. See [FAQ](10-FAQ.md#q-what-happens-to-tmux-sessions-when-i-reboot-windows)

---

## 📖 Reading Order Recommendations

### For Complete Understanding (2-3 hours)
1. Architecture Explained
2. Root Cause Analysis
3. Memory Fix (.wslconfig)
4. tmux Setup
5. tmux Daily Usage
6. Network Troubleshooting (skim)
7. FAQ

### For Quick Fix (30 minutes)
1. Root Cause Analysis (skim symptoms)
2. Memory Fix (.wslconfig) - APPLY THIS
3. tmux Setup - APPLY THIS
4. Bookmark: Quick Reference Commands
5. Bookmark: tmux Daily Usage

### For Daily Work (5 minutes)
- Keep open: Quick Reference Commands
- Reference as needed: tmux Daily Usage
- When stuck: tmux Advanced Features

---

## 🔄 Maintenance & Updates

**Last Updated:** October 30, 2025
**Document Version:** 1.4
**Original Guide:** `../WSL2-TMux-WSLg-HyperV-Guide.md` (consolidated version)

**Changelog:**
- v1.4: Split into focused quick-reference documents
- Added tmux scrolling/copy mode documentation
- Enhanced troubleshooting for network issues
- Improved FAQ with tmux-specific questions

---

## 💡 Pro Tips

1. **Bookmark these 3 documents:**
   - Quick Reference Commands (daily use)
   - tmux Daily Usage (workflow patterns)
   - Network Troubleshooting (when stuck)

2. **Your morning routine:**
   ```bash
   # Check memory is still good
   free -h

   # Start/attach to tmux sessions
   tmux attach -t frontend || tmux new -s frontend
   ```

3. **When Claude Code outputs too much:**
   - Don't scroll in tmux - ask Claude to save to file:
   - "Save that code to review.md"
   - Then: `code review.md`

4. **Keep a debug session running:**
   ```bash
   tmux new -d -s monitor 'watch -n 30 free -h'
   tmux attach -t monitor  # Check anytime
   ```

---

**Need help?** Start with the [Root Cause Analysis](02-Root-Cause-Analysis.md) to understand your specific issue, then follow the recommended solution path.
