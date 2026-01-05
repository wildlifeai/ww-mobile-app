#!/bin/bash
# Maestro Installation Script for WSL2
# Based on Context7 docs and official Maestro documentation

set -e

echo "🔍 Installing Maestro for WSL2..."

# Step 1: Check Java version (requires 17+)
echo "📋 Checking Java version..."
if command -v java &> /dev/null; then
    JAVA_VERSION=$(java -version 2>&1 | head -1 | cut -d'"' -f2 | cut -d'.' -f1-2)
    echo "Current Java version: $JAVA_VERSION"

    # Extract major version number
    JAVA_MAJOR=$(echo $JAVA_VERSION | cut -d'.' -f1)
    if [ "$JAVA_MAJOR" -lt 17 ]; then
        echo "⚠️  Java 17+ required. Installing OpenJDK 17..."
        sudo apt update
        sudo apt install -y openjdk-17-jdk
    else
        echo "✅ Java version sufficient"
    fi
else
    echo "☕ Installing OpenJDK 17..."
    sudo apt update
    sudo apt install -y openjdk-17-jdk
fi

# Verify Java installation
echo "📋 Verifying Java installation..."
java -version

# Step 2: Install Maestro using official installation script
echo "🚀 Installing Maestro CLI..."
curl -Ls "https://get.maestro.mobile.dev" | bash

# Step 3: Add to PATH (the script should handle this, but let's be explicit)
echo "🔧 Setting up PATH..."
echo 'export PATH="$HOME/.maestro/bin:$PATH"' >> ~/.bashrc

# Reload bashrc for current session
export PATH="$HOME/.maestro/bin:$PATH"

# Step 4: Verify installation
echo "✅ Verifying Maestro installation..."
if command -v maestro &> /dev/null; then
    maestro --version
    echo "🎉 Maestro successfully installed!"
else
    echo "❌ Maestro installation failed. Please check the logs."
    exit 1
fi

# Step 5: WSL2-specific notes
echo ""
echo "📝 WSL2-specific setup notes:"
echo "1. ✅ Maestro installed successfully in Linux environment"
echo "2. 🔗 To test with Android emulator, make sure Android SDK is accessible"
echo "3. 🔧 May need to configure ADB connection between WSL2 and Windows"
echo "4. 📱 For physical devices, USB forwarding to WSL2 may be required"
echo ""
echo "🧪 Next steps:"
echo "1. Start an Android emulator or connect a device"
echo "2. Run: maestro test tests/maestro/auth-workflow.yaml"
echo "3. Check our Wildlife Watcher auth flow!"

echo "🎯 Installation complete! Restart your terminal or run:"
echo "source ~/.bashrc"