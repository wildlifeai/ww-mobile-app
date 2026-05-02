# WSL2 Development Setup Guide

> **Related**: [Docker-Development-Guide.md](Docker-Development-Guide.md) (Docker in WSL2), [Expo-EAS-Guide.md](Expo-EAS-Guide.md) (dev client setup).

## Overview

WSL2 creates a separate virtual network from Windows. Your phone connects to Windows but cannot directly reach WSL2. This guide sets up port forwarding to bridge them.

```
Phone (192.168.x.x) ──→ Windows (192.168.x.x:8081) ──→ WSL2 (172.x.x.x:8081)
                              port forward + firewall
```

## 1. Configure WSL2 Resources

Create/edit `C:\Users\<YourUsername>\.wslconfig`:

```ini
[wsl2]
# Prevent auto-hibernation (critical for stability)
vmIdleTimeout=-1

# Memory — adjust to your system (leave 6GB for Windows)
memory=26GB

# CPU — adjust to your system (leave 4 threads for Windows)
processors=16

# Swap
swap=4GB

# Allow localhost forwarding
localhostForwarding=true
```

Apply changes:
```powershell
wsl --shutdown
# Wait 10 seconds
wsl
# Verify:
free -h    # Should show your configured memory
nproc      # Should show your configured processors
```

## 2. Set Up Port Forwarding

### Find IPs

```bash
# WSL2 IP (changes on restart)
hostname -I
# Example: 172.21.24.107

# Windows IP
cmd.exe /c "ipconfig | findstr IPv4"
# Example: 192.168.1.8
```

### Create Port Forwards (PowerShell as Admin)

```powershell
# Forward Metro port
netsh interface portproxy add v4tov4 listenport=8081 listenaddress=0.0.0.0 connectport=8081 connectaddress=<WSL2_IP>

# Backup port
netsh interface portproxy add v4tov4 listenport=8082 listenaddress=0.0.0.0 connectport=8082 connectaddress=<WSL2_IP>

# Verify
netsh interface portproxy show v4tov4
```

### Add Firewall Rules (one-time)

```powershell
New-NetFirewallRule -DisplayName "WSL2 Expo Metro" -Direction Inbound -Protocol TCP -LocalPort 8081 -Action Allow
New-NetFirewallRule -DisplayName "WSL2 Expo Metro Backup" -Direction Inbound -Protocol TCP -LocalPort 8082 -Action Allow
```

### Auto-Update Script (WSL2 IP Changes on Restart)

Save as `update-port-forward.ps1` and run after each WSL2 restart:

```powershell
$wslIP = wsl hostname -I | ForEach-Object { $_.Trim() }
netsh interface portproxy delete v4tov4 listenport=8081 listenaddress=0.0.0.0
netsh interface portproxy delete v4tov4 listenport=8082 listenaddress=0.0.0.0
netsh interface portproxy add v4tov4 listenport=8081 listenaddress=0.0.0.0 connectport=8081 connectaddress=$wslIP
netsh interface portproxy add v4tov4 listenport=8082 listenaddress=0.0.0.0 connectport=8082 connectaddress=$wslIP
Write-Host "Port forwarding updated for WSL2 IP: $wslIP"
```

## 3. Connect Phone to Dev Server

```bash
# In WSL2
npx expo start --dev-client --clear
```

On your phone's dev client app, enter: `<Windows_IP>:8081` (e.g., `192.168.1.8:8081`)

## Troubleshooting

| Problem | Solution |
|---------|----------|
| "Could not connect to dev server" | Verify port forwarding: `netsh interface portproxy show v4tov4` |
| WSL2 IP changed | Run `update-port-forward.ps1` (or re-add manually) |
| Metro won't start / port conflict | `lsof -i :8081` then `kill <PID>`; or use `--port 8082` |
| VS Code WebSocket 1006 errors | Reinstall VS Code Server: `rm -rf ~/.vscode-server` then reopen |
| Disconnects with low memory usage | Reset Hyper-V adapter: `Get-NetAdapter \| Where {$_.InterfaceDescription -like "*WSL*"} \| Restart-NetAdapter` |
| Disconnects with high memory/swap | Increase `memory` in `.wslconfig`; check: `free -h` |
| Firewall blocking | Test: temporarily disable firewall; if fixed, verify rules exist |

### Why Not Use `--tunnel`?

Port forwarding is faster, more reliable, and doesn't expose a public endpoint. Use `--tunnel` only as a last resort.

### Useful Commands

```bash
# WSL2 status
hostname -I                    # WSL2 IP
free -h                        # Memory status
btop                           # Resource monitor

# WSL2 management (PowerShell)
wsl --status                   # WSL version info
wsl -l -v                      # Running distributions
wsl --shutdown                 # Full restart
wsl --update                   # Update WSL2
```

---

**Last Updated**: 2026-02-19
