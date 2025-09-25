/**
 * MVP2 Dashboard Hybrid API Integration
 * Connects tabbed interface to TaskMaster + MVP2 server APIs
 * Wildlife Watcher Project - Task Management Dashboard
 */

class MVP2DashboardAPI {
    constructor() {
        this.baseURL = window.location.origin;
        this.refreshing = false;
        this.data = {
            tasks: [],
            mvp2Tasks: [],
            combinedTasks: [],
            streams: {},
            agents: [],
            metrics: {},
            activity: []
        };
        this.init();
    }

    async init() {
        await this.loadInitialData();
        this.setupEventListeners();
        this.startPeriodicUpdates();
    }

    async loadInitialData() {
        try {
            await this.refreshAllData();
            this.renderAllTabs();
        } catch (error) {
            console.error('Failed to load initial data:', error);
            this.showToast('Failed to load dashboard data', 'error');
        }
    }

    async refreshAllData() {
        if (this.refreshing) return;

        this.refreshing = true;
        this.showRefreshIndicator();

        try {
            let apiDataLoaded = false;

            try {
                const [tasksResponse, mvp2Response] = await Promise.all([
                    fetch(`${this.baseURL}/api/tasks`),
                    fetch(`${this.baseURL}/api/tasks/mvp2`)
                ]);

                if (tasksResponse.ok) {
                    const tasksData = await tasksResponse.json();
                    this.data.combinedTasks = tasksData.tasks || [];
                    apiDataLoaded = true;
                }

                if (mvp2Response.ok) {
                    const mvp2Data = await mvp2Response.json();
                    this.data.mvp2Tasks = mvp2Data.tasks || [];
                    this.data.streams = mvp2Data.streams || {};
                    this.data.metrics = mvp2Data.metrics || {};
                    apiDataLoaded = true;
                }
            } catch (apiError) {
                console.log('API not available, using mock data');
            }

            // Use mock data if API is not available
            if (!apiDataLoaded) {
                this.loadMockData();
                this.addActivity('Using mock data - API not available', 'info');
            }

            // Generate activity log
            this.generateActivityLog();

            this.addActivity('Dashboard refreshed successfully', 'success');
            this.hideRefreshIndicator();

        } catch (error) {
            console.error('Refresh failed:', error);
            this.loadMockData(); // Fallback to mock data
            this.showToast('Using offline mock data', 'warning');
            this.addActivity('Dashboard using mock data', 'warning');
            this.hideRefreshIndicator();
        } finally {
            this.refreshing = false;
        }
    }

    loadMockData() {
        this.data.mvp2Tasks = [
            {
                id: 'task_12',
                title: 'Project Management Core Implementation',
                status: 'active',
                stream: 'Stream A',
                estimated_hours: 6,
                agent: 'mobile-dev',
                description: 'Implement project management core functionality with CRUD operations'
            },
            {
                id: 'task_13',
                title: 'Project Member Management',
                status: 'pending',
                stream: 'Stream A',
                estimated_hours: 8,
                agent: 'mobile-dev',
                description: 'Add/remove project members with role management'
            },
            {
                id: 'task_15',
                title: 'Deployment Workflow Foundation',
                status: 'done',
                stream: 'Stream B',
                estimated_hours: 8,
                agent: 'mobile-dev',
                description: 'Core deployment workflow implementation'
            }
        ];

        this.data.streams = {
            'foundation': {
                title: 'Foundation Layer',
                status: 'completed',
                progress: 100,
                task_count: 11,
                completed_tasks: 11,
                active_tasks: 0
            },
            'stream-a': {
                title: 'Stream A: Project Management',
                status: 'active',
                progress: 25,
                task_count: 3,
                completed_tasks: 0,
                active_tasks: 1
            },
            'stream-b': {
                title: 'Stream B: Deployment Workflows',
                status: 'ready',
                progress: 33,
                task_count: 3,
                completed_tasks: 1,
                active_tasks: 0
            }
        };

        this.data.combinedTasks = this.data.mvp2Tasks;
        this.data.metrics = {
            totalTasks: this.data.mvp2Tasks.length,
            completedTasks: this.data.mvp2Tasks.filter(t => t.status === 'done').length,
            activeTasks: this.data.mvp2Tasks.filter(t => t.status === 'active').length
        };

        // Add some initial activity
        if (this.data.activity.length === 0) {
            this.addActivity('Dashboard initialized with mock data', 'info');
            this.addActivity('Task 15 completed - Deployment Foundation', 'success');
            this.addActivity('Task 12 started - Project Management Core', 'info');
        }
    }

    renderAllTabs() {
        this.renderOverviewTab();
        this.renderStreamsTab();
        this.renderTasksTab();
        this.renderAgentsTab();
        this.renderActivityTab();
        this.renderDocumentsTab();
        this.renderSettingsTab();
    }

    renderOverviewTab() {
        const container = document.getElementById('overviewContent');
        if (!container) return;

        const totalTasks = this.data.mvp2Tasks.length || 0;
        const completedTasks = this.data.mvp2Tasks.filter(t => t.status === 'done').length;
        const activeTasks = this.data.mvp2Tasks.filter(t => t.status === 'active' || t.status === 'in_progress').length;
        const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

        container.innerHTML = `
            <div class="project-header" style="text-align: center; margin-bottom: 30px;">
                <h2 style="color: var(--primary-color); margin-bottom: 10px;">🦅 Wildlife Watcher MVP2 Dashboard</h2>
                <p style="color: #666; margin: 0;">Cross-repository progress tracking for mobile app development</p>
            </div>

            <div class="metrics-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px; margin-bottom: 20px;">
                <div class="metric-card" style="background: white; border-radius: 12px; padding: 20px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); border: 1px solid var(--border-color);">
                    <div class="metric-title" style="font-size: 0.9em; color: #666; margin-bottom: 10px; font-weight: 600;">🎯 Overall Progress</div>
                    <div class="metric-value" style="font-size: 2.5em; font-weight: bold; color: var(--primary-color); margin-bottom: 5px;">${completionRate}%</div>
                    <div class="metric-subtitle" style="font-size: 0.85em; color: #888; margin-bottom: 15px;">${completedTasks}/${totalTasks} tasks complete</div>
                    <div class="progress-bar" style="background: #f0f0f0; height: 8px; border-radius: 4px; overflow: hidden;">
                        <div class="progress-fill" style="background: linear-gradient(90deg, var(--primary-color), var(--secondary-color)); height: 100%; width: ${completionRate}%; transition: width 0.3s ease;"></div>
                    </div>
                </div>

                <div class="metric-card" style="background: white; border-radius: 12px; padding: 20px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); border: 1px solid var(--border-color);">
                    <div class="metric-title" style="font-size: 0.9em; color: #666; margin-bottom: 10px; font-weight: 600;">⚡ Active Tasks</div>
                    <div class="metric-value" style="font-size: 2.5em; font-weight: bold; color: var(--warning-color); margin-bottom: 5px;">${activeTasks}</div>
                    <div class="metric-subtitle" style="font-size: 0.85em; color: #888;">Currently in progress</div>
                </div>

                <div class="metric-card" style="background: white; border-radius: 12px; padding: 20px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); border: 1px solid var(--border-color);">
                    <div class="metric-title" style="font-size: 0.9em; color: #666; margin-bottom: 10px; font-weight: 600;">📊 Total Streams</div>
                    <div class="metric-value" style="font-size: 2.5em; font-weight: bold; color: var(--secondary-color); margin-bottom: 5px;">${Object.keys(this.data.streams).length}</div>
                    <div class="metric-subtitle" style="font-size: 0.85em; color: #888;">Development streams</div>
                </div>

                <div class="metric-card" style="background: white; border-radius: 12px; padding: 20px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); border: 1px solid var(--border-color);">
                    <div class="metric-title" style="font-size: 0.9em; color: #666; margin-bottom: 10px; font-weight: 600;">🕒 Last Updated</div>
                    <div class="metric-value" style="font-size: 1.8em; font-weight: bold; color: var(--success-color); margin-bottom: 5px;">${new Date().toLocaleTimeString()}</div>
                    <div class="metric-subtitle" style="font-size: 0.85em; color: #888;">Real-time data</div>
                </div>
            </div>
        `;
    }

    renderStreamsTab() {
        const container = document.getElementById('streamsGrid');
        if (!container) return;

        const streamsHTML = Object.entries(this.data.streams).map(([id, stream]) => `
            <div class="stream-card">
                <div class="stream-header">
                    <h3>${stream.title || id}</h3>
                    <span class="stream-status ${stream.status}">${stream.status}</span>
                </div>
                <div class="stream-progress">
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: ${stream.progress || 0}%"></div>
                    </div>
                    <span class="progress-text">${stream.progress || 0}%</span>
                </div>
                <div class="stream-stats">
                    <span>Tasks: ${stream.task_count || 0}</span>
                    <span>Completed: ${stream.completed_tasks || 0}</span>
                    <span>Active: ${stream.active_tasks || 0}</span>
                </div>
            </div>
        `).join('');

        container.innerHTML = streamsHTML || '<div class="empty-state">No streams data available</div>';
    }

    renderTasksTab() {
        const container = document.getElementById('tasksGrid');
        if (!container) return;

        const tasksHTML = this.data.mvp2Tasks.map(task => `
            <div class="task-card ${task.status}" onclick="window.dashboardAPI.showTaskModal('${task.id}')">
                <div class="task-header">
                    <span class="task-id">${task.id}</span>
                    <span class="task-status ${task.status}">${task.status}</span>
                </div>
                <div class="task-title">${task.title}</div>
                <div class="task-details">
                    <span class="task-stream">${task.stream}</span>
                    <span class="task-hours">${task.estimated_hours || 0}h</span>
                </div>
            </div>
        `).join('');

        container.innerHTML = tasksHTML || '<div class="empty-state">No tasks data available</div>';
    }

    renderAgentsTab() {
        const container = document.getElementById('agentsGridTab');
        if (!container) return;

        // Generate agent data from tasks
        const agents = this.generateAgentData();

        const agentsHTML = agents.map(agent => `
            <div class="agent-card ${agent.status}">
                <div class="agent-header">
                    <h3>${agent.name}</h3>
                    <span class="agent-status ${agent.status}">${agent.status}</span>
                </div>
                <div class="agent-task">${agent.current_task}</div>
                <div class="agent-stats">
                    <span>Active: ${agent.active_tasks}</span>
                    <span>Pending: ${agent.pending_tasks}</span>
                </div>
            </div>
        `).join('');

        container.innerHTML = agentsHTML || '<div class="empty-state">No agent data available</div>';
    }

    generateAgentData() {
        const agentMap = new Map();

        this.data.mvp2Tasks.forEach(task => {
            const agentId = task.agent || 'mobile-dev';
            if (!agentMap.has(agentId)) {
                agentMap.set(agentId, {
                    name: agentId,
                    status: 'idle',
                    current_task: 'Awaiting assignment',
                    active_tasks: 0,
                    pending_tasks: 0
                });
            }

            const agent = agentMap.get(agentId);
            if (task.status === 'active' || task.status === 'in_progress') {
                agent.active_tasks++;
                agent.status = 'active';
                agent.current_task = `Task ${task.id}: ${task.title}`;
            } else if (task.status === 'pending') {
                agent.pending_tasks++;
                if (agent.status === 'idle') {
                    agent.status = 'ready';
                }
            }
        });

        return Array.from(agentMap.values());
    }

    renderActivityTab() {
        const container = document.getElementById('activityFeed');
        if (!container) return;

        const activityHTML = this.data.activity.slice(-20).reverse().map(item => `
            <div class="activity-item ${item.type}">
                <div class="activity-time">${item.time}</div>
                <div class="activity-message">${item.message}</div>
            </div>
        `).join('');

        container.innerHTML = activityHTML || '<div class="empty-state">No recent activity</div>';
    }

    renderDocumentsTab() {
        const container = document.getElementById('documents-content');
        if (!container) return;

        container.innerHTML = `
            <div class="document-grid">
                <div class="document-card" onclick="window.dashboardAPI.loadDocument('execution-plan')">
                    <h3>📋 MVP2 Master Execution Plan</h3>
                    <p>Complete task breakdown and timeline</p>
                </div>
                <div class="document-card" onclick="window.dashboardAPI.loadDocument('metrics')">
                    <h3>📊 Metrics Tracker</h3>
                    <p>Time tracking and velocity metrics</p>
                </div>
                <div class="document-card" onclick="window.dashboardAPI.loadDocument('backend')">
                    <h3>🔧 Backend Project Status</h3>
                    <p>Cross-repository coordination status</p>
                </div>
            </div>
            <div id="document-viewer" class="document-viewer" style="display: none;">
                <div class="document-header">
                    <button onclick="window.dashboardAPI.closeDocument()" class="close-btn">✕</button>
                </div>
                <div id="document-content" class="document-content"></div>
            </div>
        `;
    }

    renderSettingsTab() {
        const container = document.getElementById('settings-content');
        if (!container) return;

        container.innerHTML = `
            <div class="settings-grid">
                <div class="setting-card">
                    <h3>🔄 Auto Refresh</h3>
                    <label class="toggle">
                        <input type="checkbox" id="auto-refresh" ${this.autoRefresh ? 'checked' : ''}>
                        <span class="slider"></span>
                    </label>
                </div>
                <div class="setting-card">
                    <h3>🎨 Theme</h3>
                    <select id="theme-select">
                        <option value="wildlife">Wildlife Theme</option>
                        <option value="dark">Dark Mode</option>
                        <option value="light">Light Mode</option>
                    </select>
                </div>
                <div class="setting-card">
                    <h3>📊 Data Source</h3>
                    <div class="data-sources">
                        <div>TaskMaster: ${this.data.combinedTasks.length} tasks</div>
                        <div>MVP2: ${this.data.mvp2Tasks.length} tasks</div>
                    </div>
                </div>
            </div>
        `;

        // Setup event listeners for settings
        document.getElementById('auto-refresh')?.addEventListener('change', (e) => {
            this.autoRefresh = e.target.checked;
            localStorage.setItem('dashboard-auto-refresh', this.autoRefresh);
        });
    }

    async loadDocument(docType) {
        try {
            const response = await fetch(`${this.baseURL}/api/document/${docType}`);
            if (response.ok) {
                const content = await response.text();
                document.getElementById('document-content').innerHTML = `<pre>${content}</pre>`;
                document.getElementById('document-viewer').style.display = 'block';
            }
        } catch (error) {
            this.showToast('Failed to load document', 'error');
        }
    }

    closeDocument() {
        document.getElementById('document-viewer').style.display = 'none';
    }

    showTaskModal(taskId) {
        const task = this.data.mvp2Tasks.find(t => t.id === taskId);
        if (!task) return;

        // Create and show modal with task details
        const modal = document.createElement('div');
        modal.className = 'task-modal';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3>Task ${task.id}: ${task.title}</h3>
                    <button onclick="this.closest('.task-modal').remove()" class="close-btn">✕</button>
                </div>
                <div class="modal-body">
                    <div><strong>Status:</strong> ${task.status}</div>
                    <div><strong>Stream:</strong> ${task.stream}</div>
                    <div><strong>Estimated Hours:</strong> ${task.estimated_hours || 'Not specified'}</div>
                    <div><strong>Agent:</strong> ${task.agent}</div>
                    <div><strong>Description:</strong> ${task.description || 'No description'}</div>
                    ${task.dependencies?.length ? `<div><strong>Dependencies:</strong> ${task.dependencies.join(', ')}</div>` : ''}
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    }

    generateActivityLog() {
        const now = new Date().toLocaleTimeString();
        const completedTasks = this.data.mvp2Tasks.filter(t => t.status === 'done').length;
        const activeTasks = this.data.mvp2Tasks.filter(t => t.status === 'active').length;

        if (completedTasks > 0) {
            this.addActivity(`${completedTasks} tasks completed`, 'success');
        }
        if (activeTasks > 0) {
            this.addActivity(`${activeTasks} tasks in progress`, 'info');
        }
    }

    addActivity(message, type = 'info') {
        this.data.activity.push({
            time: new Date().toLocaleTimeString(),
            message,
            type
        });

        // Keep only last 50 activities
        if (this.data.activity.length > 50) {
            this.data.activity = this.data.activity.slice(-50);
        }
    }

    showRefreshIndicator() {
        const indicator = document.querySelector('.status-indicator');
        const connectionStatus = document.getElementById('connectionStatus');
        const lastUpdate = document.getElementById('lastUpdate');

        if (indicator) {
            indicator.classList.add('refreshing');
        }
        if (connectionStatus) {
            connectionStatus.textContent = '🔄 Refreshing...';
        }
        if (lastUpdate) {
            lastUpdate.textContent = 'Updating data...';
        }
    }

    hideRefreshIndicator() {
        const indicator = document.querySelector('.status-indicator');
        const connectionStatus = document.getElementById('connectionStatus');
        const lastUpdate = document.getElementById('lastUpdate');

        if (indicator) {
            indicator.classList.remove('refreshing');
            indicator.classList.add('connected');
        }
        if (connectionStatus) {
            connectionStatus.textContent = '✅ Connected';
        }
        if (lastUpdate) {
            const now = new Date().toLocaleTimeString();
            lastUpdate.textContent = `Updated ${now}`;
        }
    }

    showToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.textContent = message;
        document.body.appendChild(toast);

        setTimeout(() => {
            toast.classList.add('show');
        }, 100);

        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }

    setupEventListeners() {
        // Manual refresh button
        const refreshBtn = document.getElementById('refresh-btn');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => this.refreshAllData());
        }

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey || e.metaKey) {
                const tabNum = parseInt(e.key);
                if (tabNum >= 1 && tabNum <= 7) {
                    e.preventDefault();
                    this.switchTab(tabNum - 1);
                }
            } else if (e.key === 'F5') {
                e.preventDefault();
                this.refreshAllData();
            }
        });
    }

    switchTab(tabName) {
        // Handle both string tab names and numeric indices
        const tabNames = ['overview', 'streams', 'tasks', 'agents', 'activity', 'documents', 'settings'];
        const index = typeof tabName === 'string' ? tabNames.indexOf(tabName) : tabName;

        if (index === -1) return;

        console.log(`Switching to tab: ${tabNames[index]} (index: ${index})`);

        // Remove active from all tabs and hide all content containers
        document.querySelectorAll('.tab-button').forEach(tab => {
            tab.classList.remove('active');
        });
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.remove('active');
            content.style.display = 'none';
        });

        // Add active to the selected tab and show selected content
        const selectedTab = document.querySelectorAll('.tab-button')[index];
        const selectedContent = document.querySelectorAll('.tab-content')[index];

        if (selectedTab) {
            selectedTab.classList.add('active');
        }
        if (selectedContent) {
            selectedContent.classList.add('active');
            selectedContent.style.display = 'block';
            console.log(`Content ${selectedContent.id} made active and visible`);
        }

        // Render only the active tab content
        switch (tabNames[index]) {
            case 'overview':
                this.renderOverviewTab();
                break;
            case 'streams':
                this.renderStreamsTab();
                break;
            case 'tasks':
                this.renderTasksTab();
                break;
            case 'agents':
                this.renderAgentsTab();
                break;
            case 'activity':
                this.renderActivityTab();
                break;
            case 'documents':
                this.renderDocumentsTab();
                break;
            case 'settings':
                this.renderSettingsTab();
                break;
        }
    }

    startPeriodicUpdates() {
        // Load auto-refresh preference
        this.autoRefresh = localStorage.getItem('dashboard-auto-refresh') === 'true';

        if (this.autoRefresh) {
            setInterval(() => {
                this.refreshAllData();
            }, 30000); // 30 seconds
        }
    }

    // Backward compatibility aliases for HTML onclick handlers
    refreshData() {
        return this.refreshAllData();
    }
}

// Initialize dashboard when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.dashboardAPI = new MVP2DashboardAPI();
    // Make it available as global 'dashboard' for backward compatibility
    window.dashboard = window.dashboardAPI;
});

// Export for module usage if needed
if (typeof module !== 'undefined' && module.exports) {
    module.exports = MVP2DashboardAPI;
}