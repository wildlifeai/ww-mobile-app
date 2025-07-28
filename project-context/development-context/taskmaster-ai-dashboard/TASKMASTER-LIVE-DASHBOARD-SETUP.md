# TaskMaster Live Dashboard - Setup & Usage Guide

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ installed
- TaskMaster AI project initialized (`.taskmaster/` directory exists)
- Basic terminal/command line access

### Installation

1. **Navigate to the dashboard directory:**
   ```bash
   cd project-context/development-context
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Start the live dashboard:**
   ```bash
   npm start
   ```

4. **Open in browser:**
   Navigate to `http://localhost:3333`

That's it! Your live dashboard is now connected to TaskMaster.

---

## 📋 Detailed Setup Instructions

### Step 1: Verify TaskMaster Installation

Ensure TaskMaster is properly set up in your project:

```bash
# Check if TaskMaster is initialized
ls -la .taskmaster/

# Should show:
# - tasks/tasks.json (your task data)
# - config.json (TaskMaster configuration)
```

If TaskMaster isn't initialized:
```bash
# Initialize TaskMaster in your project
task-master init --project-root="$(pwd)"
```

### Step 2: Install Dashboard Dependencies

The dashboard requires Node.js dependencies for the API server:

```bash
cd project-context/development-context

# Install required packages
npm install

# Dependencies installed:
# - express: Web server framework
# - cors: Cross-origin request handling
# - chokidar: File system watching
```

### Step 3: Start the Live Server

```bash
# Start the dashboard server
npm start

# Alternative: Start with auto-restart on changes
npm run dev
```

You should see output like:
```
🚀 Starting TaskMaster API Server...
📂 Project root: /path/to/your/project
📋 Tasks file: /path/to/your/project/.taskmaster/tasks/tasks.json
📋 Loaded 20 tasks
👁️  Watching tasks file for changes...

✅ TaskMaster API Server running!
📊 Dashboard: http://localhost:3333
🔗 API: http://localhost:3333/api/tasks
```

### Step 4: Access the Dashboard

Open your web browser and navigate to:
```
http://localhost:3333
```

The dashboard will automatically:
- Load your current TaskMaster tasks
- Show live connection status
- Display task statistics and views

---

## 🎯 Usage Guide

### Dashboard Features

#### 1. **Connection Status**
- **Green dot**: Connected to TaskMaster data ✅
- **Red dot**: Connection issue ❌
- **Last updated timestamp**: Shows when data was last refreshed

#### 2. **Task Views**

**Gantt Chart View:**
- Timeline visualization with 21-day project timeline
- Tasks organized by phases (Migration, Cleanup, MVP)
- Visual dependencies and duration bars
- Click any task bar to view details

**Kanban Board View:**
- Column-based task management
- Drag tasks between status columns (Pending, In Progress, Done, Blocked)
- Task cards show priority, assignee, and stream information

#### 3. **Real-time Operations**

**Assign Tasks:**
- Use dropdown in task cards to assign to team members
- Assignments are stored and persist across sessions

**Change Task Status:**
- Click task cards to open detailed modal
- Use action buttons to change status:
  - "Start Task" → Sets status to `in-progress`
  - "Complete Task" → Sets status to `done`
  - "Block Task" → Sets status to `blocked`
  - "Reset to Pending" → Sets status to `pending`

**Execute TaskMaster Commands:**
- Each task modal shows ready-to-use CLI commands
- Copy commands to run in terminal for advanced operations

#### 4. **Filtering & Search**

**Filter Options:**
- **Phase**: Filter by Migration, Cleanup, or MVP phases
- **Status**: Show only tasks with specific status
- **Priority**: Filter by High, Medium, or Low priority
- **Assignee**: View tasks for specific team members
- **Search**: Find tasks by title, description, or stream name

**Filter Combinations:**
- Use multiple filters simultaneously
- Search works across all visible filtered tasks
- Filters update statistics in real-time

### Live Integration Features

#### Auto-Refresh
- Dashboard automatically checks for changes every 5 seconds
- File changes detected instantly via file system watching
- No manual refresh needed

#### TaskMaster Command Execution
When you change task status in the dashboard, it executes:
```bash
task-master set-status --id=<task-id> --status=<new-status>
```

#### Team Collaboration
- Multiple team members can use the dashboard simultaneously
- Changes made by one person appear for others automatically
- Shared task assignments and status updates

---

## 🛠️ Advanced Configuration

### Custom Port
Change the default port (3333) by editing `taskmaster-api-server.js`:
```javascript
const CONFIG = {
    port: 8080, // Change to your preferred port
    // ... other config
};
```

### API Endpoints

The dashboard exposes these API endpoints for integration:

```bash
# Get all tasks
GET http://localhost:3333/api/tasks

# Get specific task
GET http://localhost:3333/api/tasks/1

# Update task status
PUT http://localhost:3333/api/tasks/1/status
Content-Type: application/json
{"status": "in-progress"}

# Execute TaskMaster command
POST http://localhost:3333/api/taskmaster/command
Content-Type: application/json
{"command": "show 1"}

# Health check
GET http://localhost:3333/api/health
```

### Environment Configuration

Create a `.env` file in the dashboard directory for custom settings:
```bash
# .env file
PORT=3333
TASKMASTER_PROJECT_ROOT=/path/to/your/project
AUTO_REFRESH_INTERVAL=5000
```

---

## 🔧 Troubleshooting

### Common Issues

#### 1. "Tasks file not found"
**Problem:** Dashboard can't find `.taskmaster/tasks/tasks.json`

**Solution:**
```bash
# Ensure you're in the correct project directory
pwd

# Initialize TaskMaster if needed
task-master init

# Check if tasks file exists
ls -la .taskmaster/tasks/tasks.json
```

#### 2. "Connection Failed"
**Problem:** Dashboard shows red connection status

**Solution:**
```bash
# Restart the dashboard server
npm start

# Check TaskMaster CLI is working
task-master list

# Verify Node.js dependencies
npm install
```

#### 3. "Command execution failed"
**Problem:** Status changes don't work

**Solution:**
```bash
# Verify TaskMaster CLI is in PATH
which task-master

# Test TaskMaster commands manually
task-master show 1

# Check project has tasks
task-master list
```

#### 4. "Port already in use"
**Problem:** `EADDRINUSE` error on startup

**Solution:**
```bash
# Kill process using port 3333
lsof -ti:3333 | xargs kill -9

# Or use different port
npm start -- --port 8080
```

### Debug Mode

Enable detailed logging:
```bash
# Set debug environment variable
DEBUG=* npm start

# Or for specific components
DEBUG=taskmaster:* npm start
```

### Browser Console

Check browser developer tools for client-side errors:
1. Open browser DevTools (F12)
2. Check Console tab for JavaScript errors
3. Check Network tab for API request failures

---

## 📊 Dashboard Capabilities

### What You Can Do

✅ **View Tasks**: See all TaskMaster tasks in visual format  
✅ **Filter & Search**: Find specific tasks quickly  
✅ **Change Status**: Update task progress with clicks  
✅ **Assign Tasks**: Assign team members to tasks  
✅ **View Dependencies**: See task relationships  
✅ **Track Progress**: Monitor completion statistics  
✅ **Execute Commands**: Run TaskMaster CLI operations  
✅ **Real-time Updates**: See changes immediately  

### What It Connects To

- ✅ TaskMaster `tasks.json` file (read/write)
- ✅ TaskMaster CLI commands (execution)
- ✅ Local file system (watching)
- ❌ TaskMaster MCP server (future enhancement)
- ❌ Git integration (future enhancement)
- ❌ Supabase sync (future enhancement)

---

## 🚀 Production Usage

### Team Setup

For team usage, consider:

1. **Shared File Access:**
   ```bash
   # Use shared network drive or Git repository
   git pull # Get latest tasks
   npm start # Start dashboard
   # Work on tasks
   git add .taskmaster/tasks/tasks.json
   git commit -m "Update task progress"
   git push # Share with team
   ```

2. **Multiple Dashboards:**
   ```bash
   # Each team member runs their own dashboard
   npm start # Port 3333 for developer 1
   PORT=3334 npm start # Port 3334 for developer 2
   ```

3. **Remote Access:**
   ```bash
   # Allow external connections (be careful with security)
   HOST=0.0.0.0 npm start
   # Dashboard accessible at http://your-ip:3333
   ```

### Backup & Recovery

```bash
# Backup tasks before major changes
cp .taskmaster/tasks/tasks.json .taskmaster/tasks/tasks.json.backup

# Restore if needed
cp .taskmaster/tasks/tasks.json.backup .taskmaster/tasks/tasks.json
```

---

## 🔮 Future Enhancements

Planned features for future versions:

- **Drag & Drop**: Move tasks between statuses
- **Task Creation**: Add new tasks from dashboard
- **Subtask Management**: Expand and manage subtasks
- **Timeline Editing**: Modify Gantt chart timelines
- **Export Features**: Generate reports and documentation
- **User Authentication**: Team access control
- **Mobile Support**: Responsive design improvements
- **Dark Mode**: Theme customization
- **Real-time Collaboration**: WebSocket updates
- **Integration APIs**: Connect to external tools

---

## 📞 Support

For issues or questions:

1. Check the troubleshooting section above
2. Review TaskMaster AI documentation
3. Verify all prerequisites are met
4. Check browser console for errors
5. Ensure TaskMaster CLI is working independently

Remember: The dashboard is a visual interface for TaskMaster AI - ensure your TaskMaster setup is working correctly first!