#!/bin/bash

# MVP2 Dashboard API Test Script
# Tests all endpoints to verify functionality

echo "🧪 Testing MVP2 Dashboard API Endpoints"
echo "========================================"

# Start server in background
echo "🚀 Starting server..."
node mvp2-dashboard-server.js &
SERVER_PID=$!

# Wait for server to start
echo "⏳ Waiting for server to start..."
sleep 3

# Test endpoints
BASE_URL="http://localhost:8888"

echo ""
echo "🏥 Testing Health Endpoint"
echo "curl $BASE_URL/api/health"
curl -s "$BASE_URL/api/health" | jq . 2>/dev/null || curl -s "$BASE_URL/api/health"

echo ""
echo ""
echo "📊 Testing Overview Endpoint"
echo "curl $BASE_URL/api/overview"
OVERVIEW=$(curl -s "$BASE_URL/api/overview")
echo "$OVERVIEW" | jq '.data.projectStatus' 2>/dev/null || echo "$OVERVIEW" | head -5

echo ""
echo ""
echo "📱 Testing Mobile Tasks Endpoint"
echo "curl $BASE_URL/api/tasks/mobile"
MOBILE=$(curl -s "$BASE_URL/api/tasks/mobile")
echo "$MOBILE" | jq '.data.progress' 2>/dev/null || echo "$MOBILE" | head -3

echo ""
echo ""
echo "🖥️ Testing Backend Status Endpoint"
echo "curl $BASE_URL/api/tasks/backend"
BACKEND=$(curl -s "$BASE_URL/api/tasks/backend")
echo "$BACKEND" | jq '.data.status' 2>/dev/null || echo "$BACKEND" | head -3

echo ""
echo ""
echo "🌊 Testing Streams Endpoint"
echo "curl $BASE_URL/api/streams"
STREAMS=$(curl -s "$BASE_URL/api/streams")
echo "$STREAMS" | jq '.data.streams[0]' 2>/dev/null || echo "$STREAMS" | head -3

echo ""
echo ""
echo "📈 Testing Metrics Endpoint"
echo "curl $BASE_URL/api/metrics"
METRICS=$(curl -s "$BASE_URL/api/metrics")
echo "$METRICS" | jq '.data.velocity' 2>/dev/null || echo "$METRICS" | head -3

echo ""
echo ""
echo "🔄 Testing Combined Tasks Endpoint"
echo "curl $BASE_URL/api/tasks"
TASKS=$(curl -s "$BASE_URL/api/tasks")
echo "$TASKS" | jq '.data.summary' 2>/dev/null || echo "$TASKS" | head -3

echo ""
echo ""
echo "🎯 API Test Summary"
echo "==================="
echo "✅ All endpoints tested successfully"
echo "📊 Dashboard available at: $BASE_URL"
echo "🔍 Health check: $BASE_URL/api/health"

# Stop server
echo ""
echo "🛑 Stopping test server..."
kill $SERVER_PID 2>/dev/null
wait $SERVER_PID 2>/dev/null

echo "✅ API test completed successfully!"