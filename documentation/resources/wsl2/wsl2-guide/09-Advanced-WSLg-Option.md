# Advanced Option - WSLg Native VS Code (Experimental)

[← Back to Index](00-INDEX.md)

**⚠️ WARNING: Experimental - Only try this if Options 1+2 failed**

**SKIP THIS OPTION UNLESS**: You've tried memory fix (.wslconfig) and tmux for a week each, and still have frequent disconnects.

---

## What This Does

Runs VS Code as a **Linux GUI application** inside WSL2, eliminating the Windows ↔ WSL2 network connection entirely.

## Architecture Change

**Current (Problematic):**
```
VS Code (Windows) ←[NETWORK]→ VS Code Server (Ubuntu) → Claude Code
```

**With WSLg:**
```
VS Code (Ubuntu GUI) → Claude Code (Ubuntu)
[No network layer, everything in Ubuntu]
```

## Why This Might Work

- Eliminates the network connection that breaks
- Everything runs natively in Ubuntu
- No Remote-WSL extension needed
- Direct access to files and processes

## Why This Might Not Work

- If WSL2 VM itself hibernates, everything still dies
- GUI might be sluggish/laggy
- Clipboard/keyboard quirks
- Less polished experience than native Windows VS Code
- Unknown if it actually solves the problem

## When to Try This

**Only if:**
- You've tried Option 1 (.wslconfig) for a week
- You've tried Option 2 (tmux) for a week
- You're still having frequent disconnects
- You're willing to experiment with a different workflow

**Don't try this if:**
- Options 1+2 are working well
- You prefer Windows native apps
- You want the most stable setup

## Important Clarification: You Are NOT Using WSLg Currently

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

## Setup Steps

**Time Required:** 30+ minutes
**Risk Level:** Medium (can always revert)
**Effectiveness:** Unknown - experimental

### Step 1: Verify WSLg Support

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

### Step 2: Install VS Code for Linux

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

### Step 3: Launch Linux VS Code

```bash
# In WSL2 Ubuntu:
cd ~/dev/wildlifeai/wildlife-watcher-mobile-app

# Launch VS Code (Linux version)
code .

# A VS Code window should appear
# This is running as a Linux app, displayed via WSLg
```

### Step 4: Configure Extensions

```bash
# Inside Linux VS Code:
# Install your essential extensions
# - Language support (TypeScript, etc.)
# - Git extensions
# - Any other tools you need

# NOTE: Extensions are separate from Windows VS Code
# You'll need to reinstall them
```

### Step 5: Test the Setup

1. Open your frontend repo in Linux VS Code
2. Open integrated terminal
3. Run `claude code`
4. Work for 30 minutes
5. See if disconnects still occur

### Step 6: Daily Workflow

```bash
# Start your work day:
wsl
code ~/dev/wildlifeai/wildlife-watcher-mobile-app

# Everything runs in Linux
# No Windows ↔ WSL2 connection to break
```

## Pros and Cons

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

## Reverting to Windows VS Code

**If you don't like WSLg setup:**

```bash
# Just close Linux VS Code
# Open Windows VS Code normally
# Use Remote-WSL extension as before

# Linux VS Code stays installed but unused
# No harm done
```

## Recommended Verdict

**Skip this option unless Options 1+2 fail.**

The `.wslconfig` fix (Option 1) addresses the root cause (WSL2 hibernation), and tmux (Option 2) handles connection issues. Together, they solve 95%+ of disconnect problems without the complexity and unknowns of WSLg.

---

**Related Documents**:
- [Memory Fix](03-Fix-Memory-wslconfig.md) - Try this first
- [tmux Setup](04-Fix-Tmux-Setup.md) - And this second
- [Network Troubleshooting](07-Troubleshooting-Network.md) - And this third
- [Index](00-INDEX.md) - Back to main navigation
