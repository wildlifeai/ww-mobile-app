#!/bin/bash

# MVP2 Cross-Repository Progress Dashboard Startup Script
# Version: 1.0.0
# Purpose: Easy setup and launch of the MVP2 dashboard

set -e

echo "🎯 Wildlife Watcher MVP2 Dashboard Startup"
echo "=========================================="

# Get the directory where this script is located
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$DIR"

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    print_error "Node.js is not installed. Please install Node.js 18+ to continue."
    echo "Visit: https://nodejs.org/"
    exit 1
fi

# Check Node.js version (simplified check)
NODE_VERSION=$(node -v | sed 's/v//')
MAJOR_VERSION=$(echo $NODE_VERSION | cut -d. -f1)

if [ "$MAJOR_VERSION" -lt 18 ]; then
    print_error "Node.js version $NODE_VERSION is too old. Please install Node.js 18+ to continue."
    exit 1
fi

print_success "Node.js version $NODE_VERSION detected"

# Check if dependencies are installed
if [ ! -d "node_modules" ]; then
    print_status "Installing dependencies..."

    if npm install; then
        print_success "Dependencies installed successfully"
    else
        print_error "Failed to install dependencies"
        exit 1
    fi
else
    print_status "Dependencies already installed"
fi

# Verify repository paths exist
MOBILE_REPO="/home/adarsh/dev/wildlifeai/wildlife-watcher-mobile-app"
BACKEND_REPO="/home/adarsh/dev/wildlifeai/wildlife-watcher-backend"

if [ ! -d "$MOBILE_REPO" ]; then
    print_warning "Mobile repository not found at: $MOBILE_REPO"
    print_warning "Dashboard will work with limited functionality"
fi

if [ ! -d "$BACKEND_REPO" ]; then
    print_warning "Backend repository not found at: $BACKEND_REPO"
    print_warning "Backend status will show as disconnected"
fi

# Check if required files exist
REQUIRED_FILES=(
    "mvp2-progress-dashboard.html"
    "mvp2-dashboard-api.js"
    "mvp2-dashboard-config.json"
    "mvp2-dashboard-server.js"
)

for file in "${REQUIRED_FILES[@]}"; do
    if [ ! -f "$file" ]; then
        print_error "Required file missing: $file"
        exit 1
    fi
done

print_success "All required files found"

# Check if port 3334 is available
if lsof -Pi :3334 -sTCP:LISTEN -t >/dev/null 2>&1; then
    print_warning "Port 3334 is already in use. Attempting to stop existing process..."

    # Try to kill existing process
    PID=$(lsof -ti:3334)
    if [ -n "$PID" ]; then
        kill $PID 2>/dev/null || true
        sleep 2

        # Check if process is still running
        if lsof -Pi :3334 -sTCP:LISTEN -t >/dev/null 2>&1; then
            print_error "Could not stop existing process on port 3334. Please stop it manually and try again."
            exit 1
        else
            print_success "Existing process stopped"
        fi
    fi
fi

# Parse command line arguments
OPEN_BROWSER=true
DEVELOPMENT_MODE=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --no-browser)
            OPEN_BROWSER=false
            shift
            ;;
        --dev)
            DEVELOPMENT_MODE=true
            shift
            ;;
        -h|--help)
            echo "Usage: $0 [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  --no-browser    Don't automatically open browser"
            echo "  --dev          Run in development mode with auto-reload"
            echo "  -h, --help     Show this help message"
            echo ""
            echo "Dashboard will be available at: http://localhost:3334"
            exit 0
            ;;
        *)
            print_error "Unknown option: $1"
            echo "Use --help for usage information"
            exit 1
            ;;
    esac
done

# Start the dashboard
print_status "Starting MVP2 Dashboard Server..."

if [ "$DEVELOPMENT_MODE" = true ]; then
    if command -v nodemon &> /dev/null; then
        print_status "Running in development mode with auto-reload"
        npm run dev &
    else
        print_warning "nodemon not found, installing..."
        npm install nodemon --save-dev
        npm run dev &
    fi
else
    npm start &
fi

SERVER_PID=$!

# Wait a moment for server to start
sleep 3

# Check if server started successfully
if ! curl -s http://localhost:3334/api/health > /dev/null 2>&1; then
    print_error "Dashboard server failed to start properly"
    print_error "Check the console output above for error details"

    # Kill the server process if it's still running
    if kill -0 $SERVER_PID 2>/dev/null; then
        kill $SERVER_PID
    fi

    exit 1
fi

print_success "MVP2 Dashboard Server started successfully!"
echo ""
echo "🎯 Dashboard URLs:"
echo "   Main Dashboard: http://localhost:3334"
echo "   API Health:     http://localhost:3334/api/health"
echo "   API Data:       http://localhost:3334/api/dashboard"
echo ""
echo "📊 Features Available:"
echo "   ✅ Cross-repository status tracking"
echo "   ✅ Stream progress visualization"
echo "   ✅ EAS build pipeline monitoring"
echo "   ✅ AI agent activity tracking"
echo "   ✅ Real-time metrics dashboard"
echo "   ✅ Quality gates validation"
echo ""

# Open browser if requested
if [ "$OPEN_BROWSER" = true ]; then
    print_status "Opening dashboard in browser..."

    # Try different browser opening commands based on OS
    if command -v xdg-open &> /dev/null; then
        xdg-open "http://localhost:3334" 2>/dev/null || true
    elif command -v open &> /dev/null; then
        open "http://localhost:3334" 2>/dev/null || true
    elif command -v start &> /dev/null; then
        start "http://localhost:3334" 2>/dev/null || true
    else
        print_warning "Could not automatically open browser. Please visit: http://localhost:3334"
    fi
fi

echo ""
print_success "Dashboard is now running! Press Ctrl+C to stop."

# Wait for the server process
wait $SERVER_PID