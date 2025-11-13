# Quick Reference Commands - Cheatsheet

[← Back to Index](00-INDEX.md)

**📌 BOOKMARK THIS PAGE - Use it daily!**

---

## PowerShell (Windows)

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

---

## WSL2 Ubuntu

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

# Inside tmux - scrolling and navigation
Ctrl+B, [              # Enter copy mode (scroll mode)
  ↓ Then use:
  Arrow keys           # Scroll line by line
  Page Up/Down         # Scroll page by page
  Ctrl+U / Ctrl+D      # Scroll half page
  g                    # Go to top
  G                    # Go to bottom
  /                    # Search forward
  ?                    # Search backward
  q                    # Exit copy mode

# Inside tmux - copy/paste
Ctrl+B, [              # Enter copy mode
Space                  # Start selection
Arrow keys             # Move selection
Enter                  # Copy selection
Ctrl+B, ]              # Paste

# Mouse support (if enabled)
Click                  # Switch pane
Drag border            # Resize pane
Scroll wheel           # Scroll history (auto-enters copy mode)

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

---

## VS Code

```bash
# Launch from WSL2
code .                 # Open current directory
code ~/path/to/repo    # Open specific directory

# In VS Code terminal
tmux attach -t frontend  # Reconnect to session
```

---

**Related Documents**:
- [tmux Daily Usage](05-Tmux-Daily-Usage.md) - Detailed workflow patterns
- [tmux Advanced Features](06-Tmux-Advanced-Features.md) - Scrolling and advanced features
- [Network Troubleshooting](07-Troubleshooting-Network.md) - Diagnostic procedures
- [Index](00-INDEX.md) - Back to main navigation
