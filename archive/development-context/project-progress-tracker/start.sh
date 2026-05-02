#!/bin/bash

# Wildlife Watcher MVP2 Dashboard - PRODUCTION STARTUP
# Simple, clean startup script

set -e

echo "🦅 Wildlife Watcher MVP2 Dashboard"
echo "=================================="

# Change to dashboard directory
cd "$(dirname "$0")"

# Check Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Error: Node.js not found. Please install Node.js 18+"
    exit 1
fi

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

# Clean up any existing processes
echo "🧹 Cleaning up existing processes..."
lsof -ti:3333 | xargs kill -9 2>/dev/null || echo "   No processes to clean up"

echo ""
echo "🚀 Starting dashboard server..."
echo "📊 Dashboard: http://localhost:3333"
echo "🔗 API: http://localhost:3333/api/tasks"
echo "🔍 Health: http://localhost:3333/api/health"
echo ""
echo "Press Ctrl+C to stop"
echo ""

# Start the production dashboard server
node dashboard-server.js