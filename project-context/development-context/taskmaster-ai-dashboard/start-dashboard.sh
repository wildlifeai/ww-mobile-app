#!/bin/bash

# Wildlife Watcher MVP2 Dashboard Startup Script
# Clean implementation focused on MVP2 project tracking

set -e

echo "🦅 Wildlife Watcher MVP2 Dashboard"
echo "====================================="

# Change to dashboard directory
cd "$(dirname "$0")"

# Check Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Error: Node.js not found. Please install Node.js 18+"
    exit 1
fi

# Check dependencies
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

# Kill any existing processes on port 3333
echo "🧹 Cleaning up existing processes..."
lsof -ti:3333 | xargs kill -9 2>/dev/null || echo "   No processes to clean up"

# Start the dashboard server
echo ""
echo "🚀 Starting Wildlife Watcher MVP2 Dashboard..."
echo "📊 Dashboard will be available at: http://localhost:3333"
echo "🔗 API endpoints: http://localhost:3333/api/tasks"
echo ""
echo "✅ Features:"
echo "   📱 Mobile App progress tracking"
echo "   ⚡ Backend integration status"
echo "   🚀 Development stream monitoring"
echo "   📋 Cross-project task coordination"
echo ""
echo "Press Ctrl+C to stop the dashboard"
echo ""

# Start the server (uses the working taskmaster-api-server.js with updated UI)
node taskmaster-api-server.js