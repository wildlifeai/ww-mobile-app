#!/bin/bash

# Wildlife Watcher TaskMaster + MVP2 Dashboard Startup Script
# Unified dashboard with TaskMaster integration and MVP2 real-time features

set -e

echo "🎯 Wildlife Watcher TaskMaster + MVP2 Dashboard"
echo "=============================================="

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: package.json not found"
    echo "Please run this script from the project-context/development-context directory"
    exit 1
fi

# Check if TaskMaster is available
if ! command -v task-master &> /dev/null; then
    echo "⚠️  Warning: TaskMaster CLI not found in PATH"
    echo "Please ensure TaskMaster AI is properly installed"
    echo "Continuing anyway - dashboard will show connection errors if needed"
fi

# Check if Node.js is available
if ! command -v node &> /dev/null; then
    echo "❌ Error: Node.js not found"
    echo "Please install Node.js 18+ to run the live dashboard"
    echo "Visit: https://nodejs.org/"
    exit 1
fi

# Check if npm is available
if ! command -v npm &> /dev/null; then
    echo "❌ Error: npm not found"
    echo "Please ensure npm is installed with Node.js"
    exit 1
fi

# Check Node.js version
NODE_VERSION=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "⚠️  Warning: Node.js version $NODE_VERSION detected"
    echo "Recommended: Node.js 18 or higher for best compatibility"
fi

# Check if TaskMaster is initialized in the project
if [ ! -d "../../../.taskmaster" ]; then
    echo "⚠️  Warning: TaskMaster not initialized in project root"
    echo "Run 'task-master init' in the project root to set up TaskMaster"
    echo "Continuing anyway - you can initialize TaskMaster later"
fi

# Install dependencies if node_modules doesn't exist
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
    echo "✅ Dependencies installed"
else
    echo "📦 Dependencies already installed"
fi

# Check if tasks.json exists
TASKS_FILE="../../../.taskmaster/tasks/tasks.json"
if [ -f "$TASKS_FILE" ]; then
    TASK_COUNT=$(jq '.tasks | length' "$TASKS_FILE" 2>/dev/null || echo "unknown")
    echo "📋 Found TaskMaster tasks file with $TASK_COUNT tasks"
else
    echo "⚠️  TaskMaster tasks.json not found at $TASKS_FILE"
    echo "The dashboard will show connection errors until TaskMaster is initialized"
fi

# Check for MVP2 dashboard files
if [ -f "mvp2-progress-dashboard-hybrid.html" ] && [ -f "mvp2-dashboard-config.json" ]; then
    echo "✅ MVP2 dashboard components found - hybrid mode available"
    MVP2_AVAILABLE=true
else
    echo "ℹ️  MVP2 components not found - standard TaskMaster mode only"
    MVP2_AVAILABLE=false
fi

# Start the dashboard
echo ""
if [ "$MVP2_AVAILABLE" = true ]; then
    echo "🎯 Starting TaskMaster + MVP2 Hybrid Dashboard..."
    echo "Features available:"
    echo "  🔄 Real-time TaskMaster + MVP2 task integration"
    echo "  📊 Cross-repository progress tracking"
    echo "  📋 Tabbed interface with advanced navigation"
    echo "  🤖 AI agent monitoring and coordination"
    echo "  📈 Live metrics and activity logging"
    echo "  📚 Document viewer with live data"
else
    echo "🎯 Starting TaskMaster Live Dashboard..."
fi
echo "Dashboard will be available at: http://localhost:3333"
echo "API endpoints available:"
echo "  🔗 TaskMaster: http://localhost:3333/api/tasks/taskmaster"
echo "  🔗 MVP2: http://localhost:3333/api/tasks/mvp2"
echo "  🔗 Combined: http://localhost:3333/api/tasks"
echo ""
echo "Press Ctrl+C to stop the dashboard"
echo ""

# Export environment variables for better integration
export TASKMASTER_PROJECT_ROOT="$(cd ../../.. && pwd)"
export NODE_ENV="development"
export MVP2_AVAILABLE="$MVP2_AVAILABLE"

# Start the server with enhanced configuration
TASKMASTER_PROJECT_ROOT="$TASKMASTER_PROJECT_ROOT" NODE_ENV="$NODE_ENV" npm start