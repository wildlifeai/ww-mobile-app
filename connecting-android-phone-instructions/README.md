# Connecting Android Phone to Expo Development Server from WSL2

## Problem Overview

When developing React Native/Expo apps on **WSL2 (Ubuntu) on Windows** with an **Android phone**, there are multiple networking challenges that prevent straightforward connection. This guide documents the issues encountered and the working solution.

## Network Architecture Challenge

### The Problem
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Android Phone │    │  Windows Host   │    │  WSL2 Ubuntu    │
│  192.168.1.13   │◄──►│  192.168.1.8    │◄──►│ 172.25.41.249   │
│                 │    │                 │    │                 │
│ (Home WiFi)     │    │ (Home WiFi +    │    │ (Virtual        │
│                 │    │  WSL2 Network)  │    │  Network)       │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

**Key Issue**: WSL2 creates its own isolated network (`172.25.x.x`) that Android phones cannot directly access, even when both are on the same home WiFi network.

## Failed Connection Methods (Why They Didn't Work)

### Method 1: Direct WSL2 IP Connection ❌
```bash
npx expo start --dev-client --tunnel
# URL: http://172.25.41.249:8081
```
**Why it failed**: 
- WSL2 network is isolated from host network
- Android phone on `192.168.1.x` cannot route to `172.25.x.x`
- WSL2's virtual network adapter doesn't bridge to host WiFi

### Method 2: Tunnel Method ❌
```bash
npx expo start --dev-client --tunnel
```
**Why it failed**:
- Created TLS/SSL connection errors on Android
- Tunnel servers sometimes unstable
- Added unnecessary complexity and latency
- Error: `Android internal error` with TLS handshake failures

### Method 3: USB/ADB Connection ❌
**Initial attempt**: Use ADB reverse port forwarding
```bash
adb reverse tcp:8081 tcp:8081
```
**Why it failed**:
- ADB not properly installed/configured on Windows
- WSL2 cannot directly access USB devices
- ADB commands were hanging or timing out
- Multiple stuck ADB processes causing server issues

### Method 4: LAN Flag ❌
```bash
npx expo start --dev-client --lan
```
**Why it failed**:
- Still bound to WSL2's network interface (`172.25.41.249`)
- `--lan` flag doesn't force binding to Windows host network
- Environment variables like `EXPO_DEVTOOLS_LISTEN_ADDRESS` didn't override the binding

## Working Solution: Port Forwarding + Firewall

### The Successful Architecture
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Android Phone │    │  Windows Host   │    │  WSL2 Ubuntu    │
│  192.168.1.13   │───►│  192.168.1.8    │───►│ 172.25.41.249   │
│                 │    │                 │    │                 │
│ ww-expo-poc app │    │ Port Forward    │    │ Metro Server    │
│ →192.168.1.8:   │    │ :8081 → WSL2    │    │ :8081           │
│  8081           │    │                 │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

### Step-by-Step Working Solution

#### Prerequisites
1. **Phone and Windows PC on same WiFi network**
   - Check WiFi network name matches on both devices
   - Note both IP addresses for verification

#### Step 1: Verify Network Configuration
**On Windows (Command Prompt):**
```cmd
ipconfig
```
Look for:
```
Ethernet adapter Ethernet 2:
   IPv4 Address. . . . . . . . . . . : 192.168.1.8
```

**On Android phone:**
- Settings → WiFi → Tap connected network → Note IP address
- Should be same subnet (e.g., `192.168.1.13`)

#### Step 2: Start Expo Development Server (WSL2)
```bash
cd /path/to/your/expo/project
npx expo start --dev-client --lan --clear
```
**Note**: This will show WSL2 IP (`172.25.41.249:8081`) - this is expected.

#### Step 3: Set Up Port Forwarding (Windows PowerShell as Administrator)
```powershell
netsh interface portproxy add v4tov4 listenport=8081 listenaddress=192.168.1.8 connectport=8081 connectaddress=172.25.41.249
```

**What this does**:
- Listens on Windows host IP (`192.168.1.8:8081`) 
- Forwards all traffic to WSL2 IP (`172.25.41.249:8081`)
- Creates bridge between external network and WSL2

#### Step 4: Configure Windows Firewall
```powershell
New-NetFirewallRule -DisplayName "Expo Dev Server" -Direction Inbound -Protocol TCP -LocalPort 8081 -Action Allow
```

**Why this is needed**:
- Windows Firewall blocks incoming connections by default
- Port forwarding works internally, but firewall blocks external access
- Android phone is "external" to Windows system

#### Step 5: Connect from Android App
1. Open your custom development client app (`ww-expo-poc`)
2. Enter URL: `http://192.168.1.8:8081`
3. App should connect and load JavaScript bundle

### Verification Commands

**Check port forwarding is active:**
```powershell
netsh interface portproxy show v4tov4
```
Should show:
```
Address         Port    Address         Port
192.168.1.8     8081    172.25.41.249   8081
```

**Check firewall rule:**
```powershell
Get-NetFirewallRule -DisplayName "Expo Dev Server"
```
Should show `Enabled: True`

**Test network connectivity:**
```powershell
# From Windows, test WSL2 connection
curl http://172.25.41.249:8081/status

# From phone browser, test Windows connection  
# Navigate to http://192.168.1.8:8081 in mobile browser
```

## Cleanup Commands

**Remove port forwarding when done:**
```powershell
netsh interface portproxy delete v4tov4 listenport=8081 listenaddress=192.168.1.8
```

**Remove firewall rule:**
```powershell
Remove-NetFirewallRule -DisplayName "Expo Dev Server"
```

## Common Issues and Troubleshooting

### Issue: "Failed to connect after 10000ms"
**Cause**: Usually Windows Firewall blocking the connection
**Solution**: Verify firewall rule is created and enabled

### Issue: Port forwarding not working
**Cause**: PowerShell not run as Administrator
**Solution**: Right-click PowerShell → "Run as Administrator"

### Issue: Different IP addresses
**Cause**: Network configuration changed (DHCP assigned new IPs)
**Solution**: 
1. Get new IPs: `ipconfig` on Windows, WiFi settings on phone
2. Update port forwarding rule with new IPs
3. Restart Expo server

### Issue: WSL2 IP changed
**Cause**: WSL2 restarts assign new IP addresses
**Solution**:
1. Check new WSL2 IP: `cat /etc/resolv.conf | grep nameserver` (host IP) and `ip addr show eth0` (WSL2 IP)
2. Update port forwarding rule
3. Restart Expo server

## Why This Solution Works

1. **Network Bridging**: Port forwarding creates a bridge between external network (WiFi) and internal network (WSL2)
2. **Firewall Management**: Explicit rule allows external connections to port 8081
3. **Consistent Addressing**: Phone always connects to Windows host IP, regardless of WSL2 IP changes
4. **No Software Installation**: Uses built-in Windows networking features
5. **Reliable**: No dependency on external tunnel services or USB drivers

## Alternative Methods (Not Recommended)

### WiFi Direct Connection
- Requires phone and PC on exactly same network segment
- WSL2 networking often prevents this even when on same WiFi
- Unreliable due to network topology differences

### USB with ADB
- Requires proper ADB installation and configuration
- WSL2 cannot directly access USB devices
- Complex setup with additional failure points
- Driver compatibility issues

### External Tunnel Services
- Adds latency and potential connection instability
- Requires internet connection
- TLS/SSL certificate issues on some Android versions
- Dependency on external service availability

## Network Security Considerations

**Port Forwarding Security**:
- Only forwards traffic from your local network (192.168.1.x)
- Firewall rule can be restricted to specific source IPs if needed
- Temporary rule - should be removed when development complete

**Safe Configuration**:
```powershell
# More restrictive firewall rule (optional)
New-NetFirewallRule -DisplayName "Expo Dev Server" -Direction Inbound -Protocol TCP -LocalPort 8081 -Action Allow -RemoteAddress 192.168.1.0/24
```

This restricts access to only devices on your local subnet.