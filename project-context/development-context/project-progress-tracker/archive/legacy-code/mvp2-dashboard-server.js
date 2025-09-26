#!/usr/bin/env node

/**
 * MVP2 Dashboard API Server
 * Clean implementation for Wildlife Watcher MVP2 project dashboard
 * Removes all TaskMaster dependencies - focuses on MVP2 tasks and backend integration
 */

const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3333;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Configuration
const CONFIG = {
  mobileAppRoot: '/home/adarsh/dev/wildlifeai/wildlife-watcher-mobile-app',
  backendRoot: '/home/adarsh/dev/wildlifeai/wildlife-watcher-backend',
  tasksDir: '/home/adarsh/dev/wildlifeai/wildlife-watcher-mobile-app/project-context/development-context/MVP2/tasks',
  metricsFile: '/home/adarsh/dev/wildlifeai/wildlife-watcher-mobile-app/project-context/MVP2-Tasks/MVP2-METRICS-TRACKER.md'
};

// Utility Functions
function safeFileRead(filePath, defaultValue = null) {
  try {
    if (fs.existsSync(filePath)) {
      return fs.readFileSync(filePath, 'utf8');
    }
    return defaultValue;
  } catch (error) {
    console.warn(`Warning: Could not read file ${filePath}:`, error.message);
    return defaultValue;
  }
}

function parseTaskFile(filePath) {
  const content = safeFileRead(filePath);
  if (!content) return null;

  const lines = content.split('\n');
  const task = {
    id: null,
    title: '',
    status: 'not_started',
    dependencies: [],
    priority: 'medium',
    description: '',
    details: '',
    testStrategy: '',
    subtasks: []
  };

  let currentSection = '';
  let currentSubtask = null;

  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed.startsWith('# Task ID:')) {
      task.id = trimmed.replace('# Task ID:', '').trim();
    } else if (trimmed.startsWith('# Title:')) {
      task.title = trimmed.replace('# Title:', '').trim();
    } else if (trimmed.startsWith('# Status:')) {
      task.status = trimmed.replace('# Status:', '').trim();
    } else if (trimmed.startsWith('# Dependencies:')) {
      const deps = trimmed.replace('# Dependencies:', '').trim();
      task.dependencies = deps === 'None' ? [] : deps.split(',').map(d => d.trim());
    } else if (trimmed.startsWith('# Priority:')) {
      task.priority = trimmed.replace('# Priority:', '').trim();
    } else if (trimmed.startsWith('# Description:')) {
      task.description = trimmed.replace('# Description:', '').trim();
    } else if (trimmed.startsWith('# Details:')) {
      currentSection = 'details';
    } else if (trimmed.startsWith('# Test Strategy:')) {
      currentSection = 'test_strategy';
    } else if (trimmed.startsWith('# Subtasks:')) {
      currentSection = 'subtasks';
    } else if (trimmed.startsWith('## ')) {
      if (currentSection === 'subtasks') {
        currentSubtask = {
          title: trimmed.replace('## ', '').replace(/\[.*?\]/g, '').trim(),
          status: trimmed.includes('[done]') ? 'done' : 'pending',
          dependencies: [],
          description: '',
          details: ''
        };
        task.subtasks.push(currentSubtask);
      }
    } else if (trimmed.startsWith('### Dependencies:') && currentSubtask) {
      const deps = trimmed.replace('### Dependencies:', '').trim();
      currentSubtask.dependencies = deps === 'None' ? [] : deps.split(',').map(d => d.trim());
    } else if (trimmed.startsWith('### Description:') && currentSubtask) {
      currentSubtask.description = trimmed.replace('### Description:', '').trim();
    } else if (trimmed.startsWith('### Details:') && currentSubtask) {
      // Details section starts - collect following lines
      currentSection = 'subtask_details';
    } else if (currentSection === 'details' && trimmed && !trimmed.startsWith('#')) {
      task.details += (task.details ? '\n' : '') + trimmed;
    } else if (currentSection === 'test_strategy' && trimmed && !trimmed.startsWith('#')) {
      task.testStrategy += (task.testStrategy ? '\n' : '') + trimmed;
    } else if (currentSection === 'subtask_details' && currentSubtask && trimmed && !trimmed.startsWith('#') && !trimmed.startsWith('##')) {
      currentSubtask.details += (currentSubtask.details ? '\n' : '') + trimmed;
    }
  }

  return task;
}

function loadMVP2Tasks() {
  try {
    const taskFiles = fs.readdirSync(CONFIG.tasksDir)
      .filter(file => file.startsWith('task_') && file.endsWith('.txt'))
      .sort((a, b) => {
        const aNum = parseInt(a.match(/task_(\d+)/)?.[1] || '0');
        const bNum = parseInt(b.match(/task_(\d+)/)?.[1] || '0');
        return aNum - bNum;
      });

    const tasks = [];
    for (const file of taskFiles) {
      const task = parseTaskFile(path.join(CONFIG.tasksDir, file));
      if (task) {
        tasks.push(task);
      }
    }

    return tasks;
  } catch (error) {
    console.warn('Warning: Could not load MVP2 tasks:', error.message);
    return [];
  }
}

function parseBackendStatus() {
  const statusFile = path.join(CONFIG.backendRoot, 'project-context/PROJECT-STATUS.md');
  const content = safeFileRead(statusFile);
  if (!content) {
    return {
      status: 'unknown',
      deployment: 'unknown',
      mvp2Ready: false,
      lastUpdated: 'unknown',
      version: 'unknown'
    };
  }

  // Parse key information from the status file
  const lines = content.split('\n');
  let status = {
    status: 'unknown',
    deployment: 'unknown',
    mvp2Ready: false,
    lastUpdated: 'unknown',
    version: '1.0.0',
    readiness: 0
  };

  for (const line of lines) {
    if (line.includes('**Status**:') && line.includes('[DEPLOYED]')) {
      status.status = 'deployed';
      status.deployment = 'dev';
      status.mvp2Ready = true;
    } else if (line.includes('**Document Version**:')) {
      status.version = line.split(':')[1]?.trim() || 'unknown';
    } else if (line.includes('**Last Modified**:')) {
      status.lastUpdated = line.split(':')[1]?.trim() || 'unknown';
    } else if (line.includes('MVP2 Readiness:') && line.includes('%')) {
      const match = line.match(/MVP2 Readiness:\s*(\d+)%/);
      if (match) {
        status.readiness = parseInt(match[1]);
      }
    }
  }

  return status;
}

function parseMetrics() {
  const content = safeFileRead(CONFIG.metricsFile);
  if (!content) {
    return {
      totalTasks: 0,
      completedTasks: 0,
      completionRate: 0,
      totalEstimatedHours: 0,
      totalActualHours: 0,
      streams: []
    };
  }

  const lines = content.split('\n');
  const metrics = {
    totalTasks: 0,
    completedTasks: 0,
    completionRate: 0,
    totalEstimatedHours: 0,
    totalActualHours: 0,
    daysElapsed: 0,
    projectedCompletion: 20,
    streams: [
      { name: 'Stream A: Project Management', tasks: '12-14', estimatedHours: 18, status: 'not_started' },
      { name: 'Stream B: Deployment Workflows', tasks: '15-17', estimatedHours: 24, status: 'not_started' },
      { name: 'Stream C: Devices & Maps', tasks: '18-20', estimatedHours: 30, status: 'not_started' }
    ],
    recentActivity: []
  };

  for (const line of lines) {
    if (line.includes('- **Total Tasks**:')) {
      const match = line.match(/Total Tasks\*\*:\s*(\d+)\s*\((\d+)\s*complete/);
      if (match) {
        metrics.totalTasks = parseInt(match[1]);
        metrics.completedTasks = parseInt(match[2]);
      }
    } else if (line.includes('- **Completion Rate**:')) {
      const match = line.match(/Completion Rate\*\*:\s*([\d.]+)%/);
      if (match) {
        metrics.completionRate = parseFloat(match[1]);
      }
    } else if (line.includes('| **Total Hours**')) {
      const parts = line.split('|');
      if (parts.length >= 4) {
        const estimated = parts[2]?.trim().replace(/\D/g, '');
        const actual = parts[3]?.trim().replace(/\D/g, '');
        if (estimated) metrics.totalEstimatedHours = parseInt(estimated);
        if (actual) metrics.totalActualHours = parseInt(actual);
      }
    } else if (line.includes('- **Days Elapsed**:')) {
      const match = line.match(/Days Elapsed\*\*:\s*(\d+)/);
      if (match) {
        metrics.daysElapsed = parseInt(match[1]);
      }
    }
  }

  return metrics;
}

function calculateProgress() {
  const tasks = loadMVP2Tasks();
  const completedTasks = tasks.filter(task => task.status === 'done').length;
  const totalTasks = tasks.length;
  const completionPercentage = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  return {
    completedTasks,
    totalTasks,
    completionPercentage,
    pendingTasks: totalTasks - completedTasks
  };
}

function getCurrentAndNextTasks() {
  const tasks = loadMVP2Tasks();
  const inProgress = tasks.filter(task => task.status === 'in_progress' || task.status === 'active');
  const pending = tasks.filter(task => task.status === 'not_started' || task.status === 'pending')
    .sort((a, b) => {
      const priorityOrder = { high: 3, medium: 2, low: 1 };
      return (priorityOrder[b.priority] || 0) - (priorityOrder[a.priority] || 0);
    });

  return {
    current: inProgress.slice(0, 3),
    next: pending.slice(0, 5),
    currentMobile: inProgress,
    nextMobile: pending.slice(0, 3)
  };
}

// API Routes

// Combined tasks endpoint
app.get('/api/tasks', (req, res) => {
  try {
    const mobileTasks = loadMVP2Tasks();
    const backendStatus = parseBackendStatus();

    res.json({
      success: true,
      data: {
        mobile: mobileTasks,
        backend: {
          status: backendStatus.status,
          deployment: backendStatus.deployment,
          mvp2Ready: backendStatus.mvp2Ready,
          readiness: backendStatus.readiness,
          lastUpdated: backendStatus.lastUpdated,
          version: backendStatus.version
        },
        summary: {
          mobileTasks: mobileTasks.length,
          mobileCompleted: mobileTasks.filter(t => t.status === 'done').length,
          backendReady: backendStatus.mvp2Ready
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to load tasks',
      message: error.message
    });
  }
});

// Mobile tasks only
app.get('/api/tasks/mobile', (req, res) => {
  try {
    const tasks = loadMVP2Tasks();
    const progress = calculateProgress();

    res.json({
      success: true,
      data: {
        tasks,
        progress,
        total: tasks.length,
        completed: progress.completedTasks,
        completionRate: progress.completionPercentage
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to load mobile tasks',
      message: error.message
    });
  }
});

// Backend status and tasks
app.get('/api/tasks/backend', (req, res) => {
  try {
    const backendStatus = parseBackendStatus();

    res.json({
      success: true,
      data: {
        status: backendStatus,
        integration: {
          ready: backendStatus.mvp2Ready,
          deployment: backendStatus.deployment,
          readiness: backendStatus.readiness
        },
        apis: {
          authentication: backendStatus.mvp2Ready,
          organisations: backendStatus.mvp2Ready,
          projects: backendStatus.mvp2Ready,
          roles: backendStatus.mvp2Ready
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to load backend status',
      message: error.message
    });
  }
});

// Executive overview
app.get('/api/overview', (req, res) => {
  try {
    const tasks = getCurrentAndNextTasks();
    const progress = calculateProgress();
    const backendStatus = parseBackendStatus();

    res.json({
      success: true,
      data: {
        currentTasks: tasks.current,
        nextTasks: tasks.next,
        progress: {
          mobile: progress,
          backend: {
            ready: backendStatus.mvp2Ready,
            readiness: backendStatus.readiness,
            deployment: backendStatus.deployment
          }
        },
        projectStatus: {
          phase: 'MVP2 Development',
          mobileProgress: progress.completionPercentage,
          backendReady: backendStatus.mvp2Ready,
          overallHealth: backendStatus.mvp2Ready && progress.completionPercentage > 0 ? 'good' : 'needs_attention'
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to generate overview',
      message: error.message
    });
  }
});

// Stream progress data
app.get('/api/streams', (req, res) => {
  try {
    const metrics = parseMetrics();
    const tasks = loadMVP2Tasks();

    // Map tasks to streams based on task IDs
    const streamData = metrics.streams.map(stream => {
      const [startId, endId] = stream.tasks.split('-').map(id => parseInt(id));
      const streamTasks = tasks.filter(task => {
        const taskId = parseInt(task.id);
        return taskId >= startId && taskId <= endId;
      });

      const completed = streamTasks.filter(t => t.status === 'done').length;
      const total = streamTasks.length;
      const progress = total > 0 ? Math.round((completed / total) * 100) : 0;

      return {
        ...stream,
        progress,
        completed,
        total,
        tasks: streamTasks
      };
    });

    res.json({
      success: true,
      data: {
        streams: streamData,
        integration: {
          estimatedHours: 16,
          status: 'pending',
          dependencies: streamData.map(s => s.name)
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to load stream data',
      message: error.message
    });
  }
});

// Metrics endpoint
app.get('/api/metrics', (req, res) => {
  try {
    const metrics = parseMetrics();
    const progress = calculateProgress();

    res.json({
      success: true,
      data: {
        ...metrics,
        actualProgress: progress,
        velocity: {
          dailyAverage: metrics.daysElapsed > 0 ? Math.round(progress.completedTasks / metrics.daysElapsed * 10) / 10 : 0,
          projectedCompletion: metrics.projectedCompletion,
          onTrack: progress.completionPercentage >= (metrics.daysElapsed / metrics.projectedCompletion * 100)
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to load metrics',
      message: error.message
    });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    service: 'MVP2 Dashboard API',
    version: '2.0.0',
    status: 'healthy',
    timestamp: new Date().toISOString()
  });
});

// Serve dashboard UI
app.get('/', (req, res) => {
  const dashboardHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Wildlife Watcher MVP2 Dashboard</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            margin: 0; padding: 20px; background: #f5f7fa; color: #2c3e50;
        }
        .container { max-width: 1200px; margin: 0 auto; }
        .header { text-align: center; margin-bottom: 30px; }
        .header h1 { color: #27ae60; margin: 0; }
        .header p { color: #7f8c8d; margin: 5px 0; }
        .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; }
        .card {
            background: white; border-radius: 8px; padding: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            border-left: 4px solid #3498db;
        }
        .card h3 { margin: 0 0 15px 0; color: #2c3e50; }
        .status-good { border-left-color: #27ae60; }
        .status-warning { border-left-color: #f39c12; }
        .status-error { border-left-color: #e74c3c; }
        .progress-bar {
            width: 100%; height: 20px; background: #ecf0f1; border-radius: 10px; overflow: hidden;
        }
        .progress-fill { height: 100%; background: #27ae60; transition: width 0.3s ease; }
        .metric { display: flex; justify-content: space-between; margin: 10px 0; }
        .metric strong { color: #2c3e50; }
        .loading { text-align: center; padding: 40px; color: #7f8c8d; }
        .refresh-btn {
            background: #3498db; color: white; border: none; padding: 10px 20px;
            border-radius: 5px; cursor: pointer; margin: 10px 0;
        }
        .refresh-btn:hover { background: #2980b9; }
        .task-item {
            background: #f8f9fa; padding: 10px; margin: 5px 0; border-radius: 5px;
            border-left: 3px solid #3498db;
        }
        .task-done { border-left-color: #27ae60; }
        .task-active { border-left-color: #f39c12; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Wildlife Watcher MVP2 Dashboard</h1>
            <p>Clean Dashboard - Backend Integration Ready</p>
            <button class="refresh-btn" onclick="location.reload()">Refresh Data</button>
        </div>

        <div id="dashboard" class="loading">Loading dashboard data...</div>
    </div>

    <script>
        async function loadDashboard() {
            try {
                const [overview, streams, metrics] = await Promise.all([
                    fetch('/api/overview').then(r => r.json()),
                    fetch('/api/streams').then(r => r.json()),
                    fetch('/api/metrics').then(r => r.json())
                ]);

                const dashboard = document.getElementById('dashboard');
                dashboard.innerHTML = \`
                    <div class="grid">
                        <div class="card \${overview.data.projectStatus.overallHealth === 'good' ? 'status-good' : 'status-warning'}">
                            <h3>Project Status</h3>
                            <div class="metric">
                                <span>Phase:</span>
                                <strong>\${overview.data.projectStatus.phase}</strong>
                            </div>
                            <div class="metric">
                                <span>Mobile Progress:</span>
                                <strong>\${overview.data.projectStatus.mobileProgress}%</strong>
                            </div>
                            <div class="progress-bar">
                                <div class="progress-fill" style="width: \${overview.data.projectStatus.mobileProgress}%"></div>
                            </div>
                            <div class="metric">
                                <span>Backend Ready:</span>
                                <strong style="color: \${overview.data.projectStatus.backendReady ? '#27ae60' : '#e74c3c'}">
                                    \${overview.data.projectStatus.backendReady ? 'Yes' : 'No'}
                                </strong>
                            </div>
                        </div>

                        <div class="card">
                            <h3>Current Tasks</h3>
                            \${overview.data.currentTasks.length > 0 ?
                                overview.data.currentTasks.map(task => \`
                                    <div class="task-item task-active">
                                        <strong>Task \${task.id}:</strong> \${task.title}
                                        <br><small>Priority: \${task.priority}</small>
                                    </div>
                                \`).join('') :
                                '<p>No active tasks</p>'
                            }
                        </div>

                        <div class="card">
                            <h3>Next Tasks</h3>
                            \${overview.data.nextTasks.slice(0, 3).map(task => \`
                                <div class="task-item">
                                    <strong>Task \${task.id}:</strong> \${task.title}
                                    <br><small>Priority: \${task.priority}</small>
                                </div>
                            \`).join('')}
                        </div>

                        <div class="card">
                            <h3>Development Streams</h3>
                            \${streams.data.streams.map(stream => \`
                                <div class="metric">
                                    <span>\${stream.name}:</span>
                                    <strong>\${stream.progress}% (\${stream.completed}/\${stream.total})</strong>
                                </div>
                                <div class="progress-bar" style="margin-bottom: 10px;">
                                    <div class="progress-fill" style="width: \${stream.progress}%"></div>
                                </div>
                            \`).join('')}
                        </div>

                        <div class="card">
                            <h3>Metrics Summary</h3>
                            <div class="metric">
                                <span>Total Tasks:</span>
                                <strong>\${metrics.data.totalTasks}</strong>
                            </div>
                            <div class="metric">
                                <span>Completed:</span>
                                <strong>\${metrics.data.completedTasks}</strong>
                            </div>
                            <div class="metric">
                                <span>Completion Rate:</span>
                                <strong>\${metrics.data.completionRate}%</strong>
                            </div>
                            <div class="metric">
                                <span>Days Elapsed:</span>
                                <strong>\${metrics.data.daysElapsed}</strong>
                            </div>
                            <div class="metric">
                                <span>Projected Completion:</span>
                                <strong>\${metrics.data.projectedCompletion} days</strong>
                            </div>
                        </div>

                        <div class="card \${overview.data.progress.backend.ready ? 'status-good' : 'status-warning'}">
                            <h3>Backend Integration</h3>
                            <div class="metric">
                                <span>Status:</span>
                                <strong>\${overview.data.progress.backend.deployment}</strong>
                            </div>
                            <div class="metric">
                                <span>MVP2 Ready:</span>
                                <strong style="color: \${overview.data.progress.backend.ready ? '#27ae60' : '#e74c3c'}">
                                    \${overview.data.progress.backend.ready ? 'Yes' : 'No'}
                                </strong>
                            </div>
                            <div class="metric">
                                <span>Readiness:</span>
                                <strong>\${overview.data.progress.backend.readiness}%</strong>
                            </div>
                            <div class="progress-bar">
                                <div class="progress-fill" style="width: \${overview.data.progress.backend.readiness}%"></div>
                            </div>
                        </div>
                    </div>
                \`;
            } catch (error) {
                document.getElementById('dashboard').innerHTML = \`
                    <div class="card status-error">
                        <h3>Error Loading Dashboard</h3>
                        <p>Failed to load dashboard data: \${error.message}</p>
                        <button class="refresh-btn" onclick="location.reload()">Try Again</button>
                    </div>
                \`;
            }
        }

        // Load dashboard on page load
        loadDashboard();

        // Auto-refresh every 30 seconds
        setInterval(loadDashboard, 30000);
    </script>
</body>
</html>
`;

  res.send(dashboardHtml);
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Server Error:', err);
  res.status(500).json({
    success: false,
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
});

// Start server
const server = app.listen(PORT, () => {
  console.log(`🚀 MVP2 Dashboard Server running on http://localhost:${PORT}`);
  console.log(`📊 Dashboard UI: http://localhost:${PORT}`);
  console.log(`🔍 API Health: http://localhost:${PORT}/api/health`);
  console.log('✅ Clean implementation - No TaskMaster dependencies');
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('🛑 Received SIGTERM, shutting down gracefully...');
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('🛑 Received SIGINT, shutting down gracefully...');
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});

module.exports = app;