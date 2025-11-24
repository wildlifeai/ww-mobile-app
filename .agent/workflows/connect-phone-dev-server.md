---
description: Connect Android phone to Expo development server from WSL2
---

# Connect Android Phone to Development Server

## Prerequisites
- Development client app installed on your Android phone
- Phone and PC on the same WiFi network

## Step 1: Get WSL2 IP Address

From WSL2 terminal, get your WSL2 IP:

```bash
hostname -I | awk '{print $1}'
```

Note this IP (it will be something like `172.x.x.x`)

## Step 2: Set Up Port Forwarding (Windows PowerShell as Administrator)

**Important**: Run PowerShell as Administrator (Right-click → "Run as Administrator")

Replace `<WSL2_IP>` with the IP from Step 1:

```powershell
netsh interface portproxy add v4tov4 listenport=8081 listenaddress=192.168.1.5 connectport=8081 connectaddress=<WSL2_IP>
```

Example:
```powershell
netsh interface portproxy add v4tov4 listenport=8081 listenaddress=192.168.1.5 connectport=8081 connectaddress=172.24.123.45
```

## Step 3: Configure Windows Firewall (PowerShell as Administrator)

```powershell
New-NetFirewallRule -DisplayName "Expo Dev Server" -Direction Inbound -Protocol TCP -LocalPort 8081 -Action Allow
```

## Step 4: Start Expo Development Server

From WSL2 terminal in the project directory:

```bash
cd ~/Wildlife-Watcher/wildlife-watcher-mobile-app
npm start
```

Or if you prefer to clear cache:

```bash
npm start -- --clear
```

## Step 5: Connect from Android Phone

1. Open the **WildlifeWatcher (dev)** app on your phone
2. You'll see a screen to enter a development server URL
3. Enter: `http://192.168.1.5:8081`
4. Tap "Connect" or scan QR code if available

The app should connect and load your JavaScript bundle!

## Verification Commands

**Check port forwarding is active:**
```powershell
netsh interface portproxy show v4tov4
```

Should show:
```
Address         Port    Address         Port
192.168.1.5     8081    172.x.x.x       8081
```

**Check firewall rule:**
```powershell
Get-NetFirewallRule -DisplayName "Expo Dev Server"
```

## Troubleshooting

### "Failed to connect" error
- Verify phone and PC are on same WiFi network
- Check Windows Firewall rule is enabled
- Verify port forwarding is set up correctly

### WSL2 IP changed (after restart)
WSL2 assigns new IPs on restart. If connection stops working:
1. Get new WSL2 IP: `hostname -I | awk '{print $1}'`
2. Delete old port forwarding: `netsh interface portproxy delete v4tov4 listenport=8081 listenaddress=192.168.1.5`
3. Add new port forwarding with updated WSL2 IP

### Different Windows IP
If your Windows IP changes (DHCP):
1. Get new IP: `ipconfig | findstr /i "IPv4"` (look for 192.168.x.x)
2. Update port forwarding with new Windows IP
3. Update connection URL on phone

## Cleanup (When Done Developing)

**Remove port forwarding:**
```powershell
netsh interface portproxy delete v4tov4 listenport=8081 listenaddress=192.168.1.5
```

**Remove firewall rule:**
```powershell
Remove-NetFirewallRule -DisplayName "Expo Dev Server"
```

## Daily Development Workflow

After initial setup, you only need to:

1. Start dev server in WSL2: `npm start`
2. Open development client app on phone
3. It should auto-connect to `http://192.168.1.5:8081`

Port forwarding and firewall rules persist across reboots unless you remove them.
