# Root Cause Analysis - WSL2 Disconnects

[← Back to Index](00-INDEX.md) | [Next: Memory Fix (.wslconfig) →](03-Fix-Memory-wslconfig.md)

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

**Related Documents**:
- [Architecture Explained](01-Architecture-Explained.md) - Understand the system
- [Memory Fix](03-Fix-Memory-wslconfig.md) - Apply the primary fix
- [Network Troubleshooting](07-Troubleshooting-Network.md) - If memory fix doesn't help
- [Index](00-INDEX.md) - Back to main navigation
