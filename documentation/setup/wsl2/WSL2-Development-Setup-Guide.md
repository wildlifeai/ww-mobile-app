# WSL2 Development Setup Guide

## Overview

This guide explains how to set up React Native development with Expo development client on Windows 11 using WSL2 (Ubuntu). Since the Wildlife Watcher app uses native modules (BLE functionality), it requires development client builds rather than Expo Go, which necessitates proper network configuration between WSL2, Windows, and your mobile device.

**Why This Setup Is Needed:**
- Wildlife Watcher app uses BLE (`react-native-ble-manager`) and Nordic DFU (native modules)
- Native modules require development client builds, not Expo Go
- WSL2 creates a separate network environment that needs bridging to Windows
- Mobile devices connect through Windows network, not directly to WSL2

## Prerequisites

### System Requirements
- **Windows 11** with WSL2 enabled
- **Ubuntu** (or preferred Linux distribution) installed in WSL2
- **Android development client** installed on your phone
- **Administrator access** on Windows (required for network configuration)

### Verify WSL2 Installation
```bash
# In WSL2 terminal
wsl --version
# Should show WSL version 2.x.x
```

## Understanding WSL2 Networking

### The Problem
WSL2 uses a virtualized network interface that creates a separate subnet from your Windows machine:

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Mobile Device │    │   Windows 11    │    │   WSL2 Ubuntu   │
│                 │    │                 │    │                 │
│  192.168.1.x    │────│  192.168.1.8    │    │ 172.21.24.107   │
│                 │    │                 │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                              │                        │
                              └────────────────────────┘
                                   Virtual Bridge
```

**The Issue:** Your phone can reach Windows (192.168.1.8) but cannot directly reach WSL2 (172.21.24.107).

**The Solution:** Port forwarding from Windows to WSL2.

## Step-by-Step Setup

### Step 1: Find Your WSL2 IP Address

In your **WSL2 terminal**:
```bash
# Get WSL2 internal IP address
hostname -I
# Example output: 172.21.24.107
```

**What's Happening:** WSL2 assigns your Ubuntu instance a dynamic IP address on a virtual network. This changes each time WSL2 restarts.

### Step 2: Find Your Windows IP Address

In your **WSL2 terminal**:
```bash
# Get Windows IP from WSL2
cmd.exe /c "ipconfig | findstr IPv4"
```

Or in **Windows Command Prompt**:
```cmd
ipconfig
```

Look for your **Wi-Fi adapter's IPv4 address** (usually starts with 192.168.x.x).

**What's Happening:** This is your Windows machine's IP address on your local network. Your phone connects to this address.

### Step 3: Set Up Port Forwarding

Open **Windows PowerShell as Administrator** and run:

```powershell
# Forward port 8081 from Windows to WSL2
netsh interface portproxy add v4tov4 listenport=8081 listenaddress=0.0.0.0 connectport=8081 connectaddress=172.21.24.107

# Forward port 8082 as backup (in case 8081 conflicts)
netsh interface portproxy add v4tov4 listenport=8082 listenaddress=0.0.0.0 connectport=8082 connectaddress=172.21.24.107
```

**What's Happening:**
- `listenport=8081` - Windows listens on port 8081
- `listenaddress=0.0.0.0` - Accept connections from any IP (including your phone)
- `connectport=8081` - Forward to port 8081 on WSL2
- `connectaddress=172.21.24.107` - Your WSL2 IP address

**Visual Representation:**
```
Phone (192.168.1.x:8081) → Windows (192.168.1.8:8081) → WSL2 (172.21.24.107:8081)
```

### Step 4: Configure Windows Firewall

In the same **PowerShell (Administrator)** window:

```powershell
# Allow inbound connections to port 8081
New-NetFirewallRule -DisplayName "WSL2 Expo Metro" -Direction Inbound -Protocol TCP -LocalPort 8081 -Action Allow

# Allow inbound connections to port 8082 (backup)
New-NetFirewallRule -DisplayName "WSL2 Expo Metro Backup" -Direction Inbound -Protocol TCP -LocalPort 8082 -Action Allow
```

**What's Happening:**
- Windows Firewall blocks external connections by default
- These rules specifically allow incoming connections on ports 8081 and 8082
- Without these rules, your phone cannot reach the forwarded ports

### Step 5: Verify Port Forwarding

Check your configuration:
```powershell
# View all active port forwards
netsh interface portproxy show v4tov4
```

Expected output:
```
Listen on ipv4:             Connect to ipv4:

Address         Port        Address         Port
--------------- ----------  --------------- ----------
0.0.0.0         8081        172.21.24.107   8081
0.0.0.0         8082        172.21.24.107   8082
```

### Step 6: Start Expo Development Server

In your **WSL2 terminal**:
```bash
# Navigate to project
cd ~/dev/wildlifeai/wildlife-watcher-mobile-app

# Start development server with dev client
npx expo start --dev-client --clear
```

**What's Happening:**
- `--dev-client` enables development client mode (required for native modules)
- `--clear` clears Metro cache for clean start
- Metro server starts on `localhost:8081` inside WSL2

### Step 7: Connect from Mobile Device

On your **Android phone** with the development client:

1. **Open the development client app**
2. **Enter the connection URL manually**:
   ```
   192.168.1.8:8081
   ```
   (Replace `192.168.1.8` with your actual Windows IP)

3. **Alternative:** Scan the QR code from your terminal (should work with port forwarding)

## Troubleshooting

### Connection Issues

**Problem:** "Could not connect to development server"

**Solutions:**

1. **Verify port forwarding is active:**
   ```powershell
   netsh interface portproxy show v4tov4
   ```

2. **Check WSL2 IP hasn't changed:**
   ```bash
   hostname -I
   ```
   If different from port forwarding config, update it:
   ```powershell
   # Remove old forwarding
   netsh interface portproxy delete v4tov4 listenport=8081 listenaddress=0.0.0.0
   
   # Add new forwarding with correct IP
   netsh interface portproxy add v4tov4 listenport=8081 listenaddress=0.0.0.0 connectport=8081 connectaddress=NEW_WSL2_IP
   ```

3. **Test local connectivity:**
   ```bash
   # In WSL2 - test Metro server
   curl http://localhost:8081/status
   ```

4. **Check firewall rules:**
   ```powershell
   Get-NetFirewallRule -DisplayName "WSL2 Expo Metro"
   ```

### Metro Server Issues

**Problem:** Metro won't start or shows port conflicts

**Solutions:**

1. **Kill existing Metro processes:**
   ```bash
   # Find Metro processes
   lsof -i :8081
   
   # Kill specific process
   kill [PID]
   
   # Or kill all Metro processes
   pkill -f metro
   ```

2. **Use alternative port:**
   ```bash
   npx expo start --dev-client --port 8082
   ```
   (Make sure you have port 8082 forwarding configured)

### WSL2 IP Changes

**Problem:** WSL2 IP address changes after restart

**Solution:** Create an automated script to update port forwarding.

Create `update-port-forward.ps1` in Windows:
```powershell
# Get current WSL2 IP
$wslIP = wsl hostname -I | ForEach-Object { $_.Trim() }

# Remove existing forwarding
netsh interface portproxy delete v4tov4 listenport=8081 listenaddress=0.0.0.0
netsh interface portproxy delete v4tov4 listenport=8082 listenaddress=0.0.0.0

# Add new forwarding
netsh interface portproxy add v4tov4 listenport=8081 listenaddress=0.0.0.0 connectport=8081 connectaddress=$wslIP
netsh interface portproxy add v4tov4 listenport=8082 listenaddress=0.0.0.0 connectport=8082 connectaddress=$wslIP

Write-Host "Port forwarding updated for WSL2 IP: $wslIP"
```

Run this script whenever WSL2 restarts.

## Development Workflow

### Daily Development Process

1. **Start WSL2 and navigate to project:**
   ```bash
   cd ~/dev/wildlifeai/wildlife-watcher-mobile-app
   ```

2. **Verify/update port forwarding** (if WSL2 was restarted)

3. **Start development server:**
   ```bash
   npx expo start --dev-client
   ```

4. **Connect phone using Windows IP:**
   ```
   192.168.1.8:8081
   ```

5. **Develop normally** - hot reload and debugging work as expected

### Useful Commands

```bash
# Check WSL2 IP
hostname -I

# Check Windows IP from WSL2
cmd.exe /c "ipconfig | findstr IPv4"

# Test Metro server locally
curl http://localhost:8081/status

# Check what's using port 8081
lsof -i :8081

# Kill Metro processes
pkill -f metro
```

### Windows Commands (PowerShell as Administrator)

```powershell
# View active port forwards
netsh interface portproxy show v4tov4

# Remove specific port forward
netsh interface portproxy delete v4tov4 listenport=8081 listenaddress=0.0.0.0

# View firewall rules
Get-NetFirewallRule -DisplayName "*WSL2*"

# Remove firewall rule
Remove-NetFirewallRule -DisplayName "WSL2 Expo Metro"
```

## Why Not Use Expo Tunnel?

While Expo provides a `--tunnel` option that creates a public URL, we avoid it because:

- **Performance:** Tunneling adds latency and is slower than direct connection
- **Reliability:** Depends on external ngrok service availability
- **Security:** Creates a public endpoint accessible from anywhere on the internet
- **Network Control:** Local development gives you full control over the network environment

The port forwarding approach provides the best performance and security for local development with native modules.

## Network Architecture Summary

```
┌─────────────────────┐
│   Mobile Device     │
│   (Development      │  
│   Client App)       │
│   192.168.1.x       │
└─────────┬───────────┘
          │ HTTP Request to
          │ 192.168.1.8:8081
          ▼
┌─────────────────────┐
│   Windows 11        │
│   Network Interface │
│   192.168.1.8       │
│                     │
│   ┌─────────────┐   │
│   │Port Forward │   │ Forward to
│   │8081 → WSL2  │───┼──────────┐
│   │             │   │          │
│   │Firewall     │   │          │
│   │Allow 8081   │   │          │
│   └─────────────┘   │          │
└─────────────────────┘          │
                                 │
                                 ▼
                    ┌─────────────────────┐
                    │   WSL2 Ubuntu       │
                    │   172.21.24.107     │
                    │                     │
                    │ ┌─────────────────┐ │
                    │ │  Metro Bundler  │ │
                    │ │  localhost:8081 │ │
                    │ │                 │ │
                    │ │  Wildlife       │ │
                    │ │  Watcher App    │ │
                    │ └─────────────────┘ │
                    └─────────────────────┘
```

This setup ensures your React Native app with native BLE functionality can run efficiently in WSL2 while maintaining proper connectivity with your Android development client.

## Related Documentation

- **[Supabase Integration Guide](./Supabase-Integration-Guide.md)** - Backend setup and configuration
- **[Developer Onboarding Guide](./Developer-Onboarding-Guide.md)** - Complete development environment setup
- **[App Architecture Guide](./App-Architecture-Guide.md)** - Understanding the app's BLE and native module architecture

---

*This guide is specific to Windows 11 WSL2 development with React Native apps that require native modules. For apps that can use Expo Go, the setup process is much simpler.*