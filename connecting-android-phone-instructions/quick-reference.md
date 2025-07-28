# Quick Reference: Connect Android to WSL2 Expo Dev Server

## TL;DR - Working Commands

### 1. Start Expo Server (WSL2)
```bash
npx expo start --dev-client --lan --clear
```

### 2. Set Up Port Forward (Windows PowerShell as Admin)
```powershell
# Replace IPs with YOUR actual IPs
netsh interface portproxy add v4tov4 listenport=8081 listenaddress=192.168.1.8 connectport=8081 connectaddress=172.25.41.249
```

### 3. Allow Firewall (Windows PowerShell as Admin)  
```powershell
New-NetFirewallRule -DisplayName "Expo Dev Server" -Direction Inbound -Protocol TCP -LocalPort 8081 -Action Allow
```

### 4. Connect Phone
- Open your custom dev client app
- Enter: `http://192.168.1.8:8081` (use YOUR Windows IP)

## Get Your IP Addresses

### Windows IP
```cmd
ipconfig | findstr "IPv4"
```

### WSL2 IP  
```bash
hostname -I | cut -d' ' -f1
```

### Phone IP
Settings → WiFi → Tap network name → View IP

## Verify Setup

### Check Port Forward
```powershell
netsh interface portproxy show v4tov4
```

### Check Firewall Rule
```powershell
Get-NetFirewallRule -DisplayName "Expo Dev Server"
```

### Test Connection
```powershell
curl http://172.25.41.249:8081/status
```

## Cleanup When Done

### Remove Port Forward
```powershell
netsh interface portproxy delete v4tov4 listenport=8081 listenaddress=192.168.1.8
```

### Remove Firewall Rule
```powershell
Remove-NetFirewallRule -DisplayName "Expo Dev Server"
```

## Troubleshooting

| Error | Cause | Fix |
|-------|-------|-----|
| "Failed to connect after 10000ms" | Firewall blocking | Add firewall rule |
| "Connection refused" | Port forward not set | Set up port forwarding |
| "Wrong IP in URL" | Network changed | Get new IPs, update commands |
| PowerShell "Access denied" | Not admin | Run PowerShell as Administrator |

## Why Other Methods Failed

- **Direct WSL2 IP**: Phone can't reach WSL2 network
- **USB/ADB**: Complex setup, WSL2 can't access USB directly  
- **Tunnel**: TLS errors, unreliable
- **--host flag**: Doesn't override WSL2 network binding

## Network Flow
```
Phone (192.168.1.13) → Windows (192.168.1.8:8081) → WSL2 (172.25.41.249:8081) → Expo
```