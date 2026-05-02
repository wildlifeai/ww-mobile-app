# Wildlife Watcher MVP2 Dashboard Server

Clean implementation of the MVP2 project dashboard without TaskMaster dependencies.

## Overview

This is a completely clean implementation that:
- ✅ **REMOVES ALL TaskMaster references and dependencies**
- ✅ **Reads MVP2 tasks ONLY from project-context/development-context/MVP2/tasks/*.txt**
- ✅ **Integrates backend status from /home/adarsh/dev/wildlifeai/wildlife-watcher-backend/project-context/PROJECT-STATUS.md**
- ✅ **Adds metrics parser for MVP2-METRICS-TRACKER.md**
- ✅ **Provides clean API endpoints without TaskMaster**
- ✅ **Includes integrated web dashboard UI**

## Features

### 🎯 Core Features
- **Task Management**: Parses MVP2 task files with full subtask support
- **Backend Integration**: Real-time backend status and readiness monitoring
- **Progress Tracking**: Stream-based progress visualization
- **Metrics Dashboard**: Time tracking and velocity analysis
- **Executive Overview**: High-level project status and current/next tasks
- **Clean API**: RESTful endpoints without legacy dependencies

### 📊 Dashboard UI
- **Real-time Updates**: Auto-refresh every 30 seconds
- **Responsive Design**: Works on desktop and mobile
- **Visual Progress**: Progress bars and status indicators
- **Task Overview**: Current and next task visibility
- **Backend Status**: Integration readiness monitoring

## Quick Start

### Option 1: Using Startup Script (Recommended)
```bash
cd /home/adarsh/dev/wildlifeai/wildlife-watcher-mobile-app/project-context/development-context/taskmaster-ai-dashboard
./start-mvp2-dashboard.sh
```

### Option 2: Direct Node Execution
```bash
cd /home/adarsh/dev/wildlifeai/wildlife-watcher-mobile-app/project-context/development-context/taskmaster-ai-dashboard
node mvp2-dashboard-server.js
```

### Option 3: Background Execution
```bash
cd /home/adarsh/dev/wildlifeai/wildlife-watcher-mobile-app/project-context/development-context/taskmaster-ai-dashboard
nohup node mvp2-dashboard-server.js > dashboard.log 2>&1 &
```

## Access Points

Once running, access the dashboard at:

- **🌐 Main Dashboard**: [http://localhost:8888](http://localhost:8888)
- **🏥 Health Check**: [http://localhost:8888/api/health](http://localhost:8888/api/health)

## API Endpoints

### Core Endpoints

#### `/api/tasks` - Combined Tasks
Returns both mobile app tasks and backend status in a unified format.

**Example Response:**
```json
{
  "success": true,
  "data": {
    "mobile": [...],
    "backend": {
      "status": "deployed",
      "mvp2Ready": true,
      "readiness": 85
    },
    "summary": {
      "mobileTasks": 23,
      "mobileCompleted": 10,
      "backendReady": true
    }
  }
}
```

#### `/api/tasks/mobile` - Mobile Tasks Only
Returns all MVP2 mobile app tasks with progress data.

#### `/api/tasks/backend` - Backend Status
Returns backend deployment status and integration readiness.

#### `/api/overview` - Executive Overview
High-level overview with current/next tasks and project status.

#### `/api/streams` - Development Streams
Progress data for the three parallel development streams:
- Stream A: Project Management (Tasks 12-14)
- Stream B: Deployment Workflows (Tasks 15-17)
- Stream C: Devices & Maps (Tasks 18-20)

#### `/api/metrics` - Time Tracking
Parsed metrics from MVP2-METRICS-TRACKER.md with velocity analysis.

#### `/api/health` - Health Check
Server health and version information.

## Data Sources

### Task Files
- **Location**: `/home/adarsh/dev/wildlifeai/wildlife-watcher-mobile-app/project-context/development-context/MVP2/tasks/`
- **Format**: `task_*.txt` files
- **Parsing**: Full task parsing with subtasks, dependencies, and status

### Backend Status
- **Location**: `/home/adarsh/dev/wildlifeai/wildlife-watcher-backend/project-context/PROJECT-STATUS.md`
- **Data**: Deployment status, MVP2 readiness, integration status

### Metrics Data
- **Location**: `/home/adarsh/dev/wildlifeai/wildlife-watcher-mobile-app/project-context/MVP2-Tasks/MVP2-METRICS-TRACKER.md`
- **Data**: Time tracking, velocity, stream progress

## Task File Format Support

The server parses task files with this format:

```
# Task ID: 1
# Title: Pre-Migration Setup and Environment Preparation
# Status: done
# Dependencies: None
# Priority: high
# Description: Create migration branch, install Expo CLI tools...
# Details:
[Detailed task description]

# Test Strategy:
[Testing approach]

# Subtasks:
## 1. Create Migration Branch [done]
### Dependencies: None
### Description: Create the expo-migration branch...
### Details:
[Subtask details]
```

## Architecture

### Clean Implementation Principles
1. **No TaskMaster Dependencies**: Completely independent of TaskMaster systems
2. **Direct File Parsing**: Reads task files directly without external dependencies
3. **Backend Integration**: Direct file-based backend status monitoring
4. **Metrics Integration**: Native parsing of metrics files
5. **Error Resilience**: Graceful handling of missing files or parsing errors

### Performance Features
- **File Caching**: Efficient file reading with error handling
- **Concurrent API Calls**: Dashboard loads all data in parallel
- **Auto-refresh**: Dashboard updates automatically
- **Lightweight**: Minimal dependencies (express, cors only)

## Troubleshooting

### Common Issues

#### Server Won't Start
```bash
# Check if port 8888 is in use
lsof -i :8888

# Kill existing process if needed
kill $(lsof -t -i:8888)
```

#### Missing Task Files
- Verify path: `/home/adarsh/dev/wildlifeai/wildlife-watcher-mobile-app/project-context/development-context/MVP2/tasks/`
- Check file naming: Files should be named `task_*.txt`

#### Backend Status Not Loading
- Verify path: `/home/adarsh/dev/wildlifeai/wildlife-watcher-backend/project-context/PROJECT-STATUS.md`
- Check file permissions

#### Metrics Not Parsing
- Verify path: `/home/adarsh/dev/wildlifeai/wildlife-watcher-mobile-app/project-context/MVP2-Tasks/MVP2-METRICS-TRACKER.md`
- Check file format matches expected structure

### Debug Mode
```bash
NODE_ENV=development node mvp2-dashboard-server.js
```

### Logs
```bash
# If running with nohup
tail -f dashboard.log

# For real-time debugging
node mvp2-dashboard-server.js | tee dashboard.log
```

## Dependencies

### Required
- **Node.js**: Version 14 or higher
- **express**: Web server framework
- **cors**: Cross-origin resource sharing

### File Structure
```
taskmaster-ai-dashboard/
├── mvp2-dashboard-server.js     # Main server file
├── start-mvp2-dashboard.sh      # Startup script
├── package.json                 # Dependencies
├── node_modules/                # Installed packages
└── README-MVP2-DASHBOARD.md     # This file
```

## Integration with Development Workflow

### Real-time Monitoring
- Task completion status
- Backend deployment readiness
- Stream progress tracking
- Velocity and time metrics

### Development Phases
1. **Foundation Phase**: Tasks 1-11 (Track completion)
2. **Stream Phase**: Tasks 12-20 (Monitor parallel progress)
3. **Integration Phase**: Tasks 21-23 (Final testing)

### Quality Gates
- Backend integration readiness
- Task completion tracking
- Metrics variance analysis
- Performance monitoring

## Version History

- **v2.0.0**: Clean implementation without TaskMaster dependencies
- **v1.x**: Legacy TaskMaster-dependent versions (archived)

## Support

### Development Team
- **File Issues**: Create GitHub issues for bugs or feature requests
- **Documentation**: Update this README for any configuration changes
- **Monitoring**: Use dashboard for real-time project tracking

### Integration Points
- **Mobile App**: `/home/adarsh/dev/wildlifeai/wildlife-watcher-mobile-app`
- **Backend**: `/home/adarsh/dev/wildlifeai/wildlife-watcher-backend`
- **Task Files**: `project-context/development-context/MVP2/tasks/`
- **Metrics**: `project-context/MVP2-Tasks/MVP2-METRICS-TRACKER.md`

---

**Clean Dashboard Implementation** - No TaskMaster dependencies, direct file parsing, integrated backend status, comprehensive metrics tracking.