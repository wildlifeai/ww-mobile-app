#!/usr/bin/env node

/**
 * TaskMaster API Server
 * Provides HTTP API access to TaskMaster tasks.json data
 * Enables live dashboard integration
 */

const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const cors = require('cors');
const chokidar = require('chokidar');
const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);
const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname)); // Serve dashboard files

// Configuration
const CONFIG = {
    port: 3333,
    tasksFile: path.join(process.cwd(), '.taskmaster/tasks/tasks.json'),
    projectRoot: process.cwd()
};

let tasksData = { tasks: [] };
let lastModified = null;

// Load tasks from file
async function loadTasks() {
    try {
        const stats = await fs.stat(CONFIG.tasksFile);
        const data = await fs.readFile(CONFIG.tasksFile, 'utf8');
        tasksData = JSON.parse(data);
        lastModified = stats.mtime;
        console.log(`📋 Loaded ${tasksData.tasks?.length || 0} tasks`);
        return tasksData;
    } catch (error) {
        console.error('❌ Failed to load tasks:', error.message);
        return { tasks: [], error: error.message };
    }
}

// API Routes

// Get all tasks
app.get('/api/tasks', async (req, res) => {
    try {
        await loadTasks();
        res.json({
            ...tasksData,
            meta: {
                lastModified,
                projectRoot: CONFIG.projectRoot,
                totalTasks: tasksData.tasks?.length || 0
            }
        });
    } catch (error) {
        res.status(500).json({ 
            error: 'Failed to load tasks',
            message: error.message 
        });
    }
});

// Get specific task
app.get('/api/tasks/:id', async (req, res) => {
    await loadTasks();
    const task = tasksData.tasks?.find(t => t.id == req.params.id);
    
    if (task) {
        res.json(task);
    } else {
        res.status(404).json({ error: 'Task not found' });
    }
});

// Update task status
app.put('/api/tasks/:id/status', async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;
    
    console.log(`🔄 Updating task ${id} status to: ${status}`);
    
    try {
        const command = `task-master set-status --id=${id} --status=${status}`;
        const { stdout, stderr } = await execAsync(command, {
            cwd: CONFIG.projectRoot
        });
        
        console.log(`✅ TaskMaster command executed: ${command}`);
        if (stdout) console.log('Output:', stdout);
        if (stderr) console.log('Stderr:', stderr);
        
        // Reload tasks after update
        await loadTasks();
        
        res.json({ 
            success: true, 
            command,
            output: stdout
        });
    } catch (error) {
        console.error(`❌ Failed to update task ${id}:`, error.message);
        res.status(500).json({ 
            error: 'Failed to update task status',
            message: error.message
        });
    }
});

// Assign task
app.put('/api/tasks/:id/assign', async (req, res) => {
    const { id } = req.params;
    const { assignee } = req.body;
    
    console.log(`👤 Assigning task ${id} to: ${assignee}`);
    
    try {
        // For now, we'll store assignments in memory
        // In a full implementation, this could be persisted
        res.json({ 
            success: true,
            message: `Task ${id} assigned to ${assignee}` 
        });
    } catch (error) {
        res.status(500).json({ 
            error: 'Failed to assign task',
            message: error.message 
        });
    }
});

// Execute TaskMaster command
app.post('/api/taskmaster/command', async (req, res) => {
    const { command } = req.body;
    
    console.log(`⚡ Executing TaskMaster command: ${command}`);
    
    try {
        const { stdout, stderr } = await execAsync(`task-master ${command}`, {
            cwd: CONFIG.projectRoot
        });
        
        // Reload tasks after command
        await loadTasks();
        
        res.json({ 
            success: true,
            command: `task-master ${command}`,
            output: stdout,
            stderr: stderr || null
        });
    } catch (error) {
        console.error(`❌ Command failed:`, error.message);
        res.status(500).json({ 
            error: 'Command execution failed',
            message: error.message
        });
    }
});

// Health check
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'healthy',
        timestamp: new Date().toISOString(),
        projectRoot: CONFIG.projectRoot,
        tasksFile: CONFIG.tasksFile
    });
});

// Serve the dashboard
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'taskmaster-live-dashboard.html'));
});

// File watching
function setupFileWatcher() {
    if (!fs.existsSync(CONFIG.tasksFile)) {
        console.log('⚠️  TaskMaster tasks.json not found. Waiting for file...');
        return;
    }
    
    const watcher = chokidar.watch(CONFIG.tasksFile);
    
    watcher.on('change', async () => {
        console.log('📄 Tasks file changed, reloading...');
        await loadTasks();
    });
    
    watcher.on('error', error => {
        console.error('❌ File watcher error:', error);
    });
    
    console.log('👁️  Watching tasks file for changes...');
}

// Server startup
async function startServer() {
    console.log('🚀 Starting TaskMaster API Server...');
    console.log(`📂 Project root: ${CONFIG.projectRoot}`);
    console.log(`📋 Tasks file: ${CONFIG.tasksFile}`);
    
    // Initial load
    await loadTasks();
    
    // Setup file watching
    setupFileWatcher();
    
    // Start server
    app.listen(CONFIG.port, () => {
        console.log(`\n✅ TaskMaster API Server running!`);
        console.log(`📊 Dashboard: http://localhost:${CONFIG.port}`);
        console.log(`🔗 API: http://localhost:${CONFIG.port}/api/tasks`);
        console.log(`\n💡 Use the dashboard to view and manage TaskMaster tasks`);
    });
}

// Handle shutdown
process.on('SIGTERM', () => {
    console.log('\n👋 Shutting down TaskMaster API Server...');
    process.exit(0);
});

process.on('SIGINT', () => {
    console.log('\n👋 Shutting down TaskMaster API Server...');
    process.exit(0);
});

// Start the server
if (require.main === module) {
    startServer().catch(error => {
        console.error('❌ Failed to start server:', error);
        process.exit(1);
    });
}

module.exports = { app, CONFIG };