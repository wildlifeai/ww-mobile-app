#!/bin/bash

# MVP2 Dashboard Server Startup Script
# Clean implementation without TaskMaster dependencies

echo "🚀 Starting Wildlife Watcher MVP2 Dashboard Server..."
echo "📁 Working directory: $(pwd)"
echo "🔍 Server file: mvp2-dashboard-server.js"

# Check if server file exists
if [ ! -f "mvp2-dashboard-server.js" ]; then
    echo "❌ Error: mvp2-dashboard-server.js not found!"
    echo "   Please run this script from the taskmaster-ai-dashboard directory"
    exit 1
fi

# Check if node_modules exist
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

# Start the server
echo "🌟 Starting MVP2 Dashboard Server..."
echo "📊 Dashboard will be available at: http://localhost:8888"
echo "🔍 API Health Check: http://localhost:8888/api/health"
echo ""
echo "Available API Endpoints:"
echo "  - /api/tasks - Combined mobile and backend tasks"
echo "  - /api/tasks/mobile - Mobile app tasks only"
echo "  - /api/tasks/backend - Backend status and tasks"
echo "  - /api/overview - Executive overview"
echo "  - /api/streams - Stream progress data"
echo "  - /api/metrics - Time tracking metrics"
echo ""
echo "Press Ctrl+C to stop the server"
echo "----------------------------------------"

# Start the server
exec node mvp2-dashboard-server.js