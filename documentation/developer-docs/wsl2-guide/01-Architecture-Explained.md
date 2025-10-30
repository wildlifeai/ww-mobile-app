# WSL2 Architecture Explained

[← Back to Index](00-INDEX.md) | [Next: Root Cause Analysis →](02-Root-Cause-Analysis.md)

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

**Related Documents**:
- [Root Cause Analysis](02-Root-Cause-Analysis.md) - Why disconnects happen
- [Memory Fix](03-Fix-Memory-wslconfig.md) - Apply the fix
- [Index](00-INDEX.md) - Back to main navigation
