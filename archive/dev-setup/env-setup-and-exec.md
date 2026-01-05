# Wildlife Watcher Mobile App - Windows WSL2 (Ubuntu) Development Environment Setup

## Overview

This guide provides step-by-step instructions for setting up the Wildlife Watcher mobile app development environment on Windows using WSL2 (Ubuntu). The app is built with React Native and enables communication with AI-powered wildlife cameras via Bluetooth Low Energy (BLE).

## Tech Stack

- **React Native 0.74.6** - Cross-platform mobile framework
- **TypeScript** - Type-safe development
- **Redux Toolkit + RTK Query** - State management
- **React Native Paper** - Material Design UI
- **BLE communication** for Wildlife Watcher camera devices

## Prerequisites for Windows WSL2 (Ubuntu)

### 1. WSL2 Setup
Ensure WSL2 is installed and configured:
```bash
# Check WSL version
wsl --version

# If needed, install Ubuntu
wsl --install -d Ubuntu
```

### 2. System Dependencies
Install essential build tools in WSL2:
```bash
# Update package lists
sudo apt update && sudo apt upgrade -y

# Install build essentials
sudo apt install -y curl wget git build-essential

# Install Python (required for some native modules)
sudo apt install -y python3 python3-pip
```

### 3. Node.js Installation (Version 18+)
```bash
# Install Node Version Manager (nvm)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash

# Restart terminal or reload bashrc
source ~/.bashrc

# Install Node.js 18
nvm install 18
nvm use 18
nvm alias default 18

# Verify installation
node --version
npm --version
```

### 4. Java Development Kit (JDK)
```bash
# Install OpenJDK 11
sudo apt install -y openjdk-11-jdk

# Set JAVA_HOME
echo 'export JAVA_HOME=/usr/lib/jvm/java-11-openjdk-amd64' >> ~/.bashrc
source ~/.bashrc

# Verify installation
java -version
```

### 5. Android Development Setup

#### Install Android SDK via Command Line Tools
```bash
# Create Android SDK directory
mkdir -p ~/Android/Sdk

# Download and install Android command line tools
cd ~/Android/Sdk
wget https://dl.google.com/android/repository/commandlinetools-linux-9477386_latest.zip
unzip commandlinetools-linux-9477386_latest.zip
mkdir -p cmdline-tools/latest
mv cmdline-tools/* cmdline-tools/latest/
rmdir cmdline-tools/bin cmdline-tools/lib

# Set environment variables
echo 'export ANDROID_HOME=~/Android/Sdk' >> ~/.bashrc
echo 'export PATH=$PATH:$ANDROID_HOME/cmdline-tools/latest/bin' >> ~/.bashrc
echo 'export PATH=$PATH:$ANDROID_HOME/platform-tools' >> ~/.bashrc
echo 'export PATH=$PATH:$ANDROID_HOME/emulator' >> ~/.bashrc
source ~/.bashrc

# Accept licenses and install SDK components
yes | sdkmanager --licenses
sdkmanager "platform-tools" "platforms;android-33" "build-tools;33.0.0"
```

#### Enable USB Debugging and ADB over Network
Since WSL2 doesn't have direct USB access, you'll need to either:
1. **Use ADB over WiFi** (recommended for WSL2)
2. **Use Windows ADB with port forwarding**

For ADB over WiFi:
```bash
# Install ADB
sudo apt install -y android-tools-adb

# Connect to device over WiFi (replace IP with your device's IP)
adb connect <DEVICE_IP>:5555
```

### 6. Ruby Installation (Version 2.6.10+)
```bash
# Install rbenv for Ruby version management
git clone https://github.com/rbenv/rbenv.git ~/.rbenv
echo 'export PATH="$HOME/.rbenv/bin:$PATH"' >> ~/.bashrc
echo 'eval "$(rbenv init -)"' >> ~/.bashrc
source ~/.bashrc

# Install ruby-build
git clone https://github.com/rbenv/ruby-build.git ~/.rbenv/plugins/ruby-build

# Install Ruby dependencies
sudo apt install -y autoconf bison build-essential libssl-dev libyaml-dev libreadline6-dev zlib1g-dev libncurses5-dev libffi-dev libgdbm6 libgdbm-dev libdb-dev

# Install Ruby 3.0.0 (or latest stable)
rbenv install 3.0.0
rbenv global 3.0.0

# Verify installation
ruby --version
gem --version
```

## Project Setup Steps

### 1. Clone and Navigate to Project
```bash
# Navigate to project directory (adjust path as needed)
cd /mnt/c/Users/adars/OneDrive/00OrganisedFilesProject/Work/Codefluent/Clients/wildlifeAI/ww_app/wildlife-watcher-mobile-app
```

### 2. Install Dependencies
```bash
# Install Node.js dependencies
npm install

# Install Ruby gems (if iOS development needed)
gem install bundler
bundle install
```

### 3. Start Development Environment
```bash
# Start Metro bundler (keep this running in one terminal)
npm start

# In a new terminal, run on Android
npm run android
# or
npx react-native run-android
```

### 4. WSL2-Specific Considerations

#### File System Performance
For better performance, consider keeping the project in WSL2 file system:
```bash
# Copy project to WSL2 home directory
cp -r /mnt/c/path/to/project ~/wildlife-watcher-mobile-app
cd ~/wildlife-watcher-mobile-app
```

#### Watchman Installation (Optional but Recommended)
```bash
# Install watchman for better file watching
sudo apt install -y watchman

# Or build from source if not available
git clone https://github.com/facebook/watchman.git
cd watchman
git checkout v4.9.0
sudo apt install -y autotools-dev automake libtool
./autogen.sh
./configure
make
sudo make install
```

## Development Commands

### Core Commands
- `npm install` - Install dependencies
- `npm start` - Start Metro bundler
- `npm run android` - Run on Android device/emulator
- `npm run lint` - Run ESLint
- `npm test` - Run Jest tests

### Debugging Commands
```bash
# Check ADB devices
adb devices

# View device logs
adb logcat

# Clear Metro cache
npx react-native start --reset-cache

# Clean and rebuild
cd android && ./gradlew clean && cd ..
npm run android
```

## What the App Does

The Wildlife Watcher app communicates with AI-powered wildlife cameras via Bluetooth Low Energy (BLE) to:
- Configure camera devices remotely
- Create and manage wildlife monitoring projects
- Deploy devices in field locations
- Update device firmware
- Track deployments on maps
- Monitor device battery and sensor status

The app uses a terminal-style interface for device configuration and provides real-time communication with the cameras for wildlife monitoring projects.

## WSL2 Troubleshooting

### Common Issues

1. **File permission issues**
   ```bash
   # Fix npm permissions
   sudo chown -R $(whoami) ~/.npm
   ```

2. **Metro bundler connection issues**
   ```bash
   # Check if port 8081 is available
   netstat -an | grep 8081
   
   # Kill existing Metro processes
   npx react-native start --reset-cache
   ```

3. **ADB connection issues**
   ```bash
   # Restart ADB server
   adb kill-server
   adb start-server
   
   # Connect via WiFi
   adb connect <DEVICE_IP>:5555
   ```

4. **WSL2 memory issues**
   ```bash
   # Create .wslconfig in Windows user directory
   # Add memory limit: memory=4GB
   ```

### Performance Tips
- Use WSL2 file system for better performance
- Keep Metro bundler running during development
- Use `--no-daemon` flag for Gradle builds if needed
- Consider using Windows Terminal for better WSL2 experience

## Additional Resources

- [React Native Environment Setup](https://reactnative.dev/docs/environment-setup)
- [WSL2 Documentation](https://docs.microsoft.com/en-us/windows/wsl/)
- [Android Developer Guide](https://developer.android.com/studio/command-line)
- [Project Repository](https://github.com/wildlifeai/wildlife-watcher-mobile-app)