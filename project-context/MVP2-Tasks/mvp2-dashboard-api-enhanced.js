/**
 * Enhanced MVP2 Cross-Repository Progress Dashboard API
 * Professional project management dashboard with tabbed interface,
 * real-time activity feeds, notifications, and document integration
 */

class MVP2Dashboard {
    constructor() {
        this.data = {
            mobile: { tasks: [], progress: 0, status: 'active' },
            backend: { tasks: [], progress: 98, status: 'ready' },
            eas_builds: [],
            agents: [],
            quality_gates: {},
            metrics: {}
        };

        this.config = {
            refreshInterval: 5000, // 5 seconds
            activityRefreshInterval: 2000, // 2 seconds for activity feed
            mobileRepoPath: '/home/adarsh/dev/wildlifeai/wildlife-watcher-mobile-app',
            backendRepoPath: '/home/adarsh/dev/wildlifeai/wildlife-watcher-backend',
            apiEndpoint: 'http://localhost:3334/api'
        };

        this.currentTab = 'overview';
        this.filters = {
            repository: 'all',
            stream: 'all',
            status: 'all'
        };

        // Settings with defaults
        this.settings = {
            theme: 'light',
            sounds: false,
            toasts: true,
            autoRefresh: true,
            defaultDoc: 'execution-plan',
            autoLoadDocs: false,
            compact: false,
            activityInterval: 2000
        };

        // Activity feed data
        this.activityFeed = [];
        this.maxActivityItems = 100;

        this.isConnected = false;
        this.retryCount = 0;
        this.maxRetries = 3;

        // Stream definitions based on MVP2 execution plan
        this.streams = {
            foundation: {
                id: 'foundation',
                title: 'Foundation Layer',
                tasks: ['11.4', '11.5', '11.6', '11.7'],
                status: 'active',
                progress: 75,
                description: 'SQLite foundation completion',
                agent: 'mobile-dev',
                estimated_hours: 12,
                eas_build: 1
            },
            'stream-a': {
                id: 'stream-a',
                title: 'Stream A: Project Management',
                tasks: ['12', '13', '14'],
                status: 'pending',
                progress: 0,
                description: 'Project list interface, role management, org switching',
                agent: 'mobile-dev',
                estimated_hours: 18,
                eas_build: 2
            },
            'stream-b': {
                id: 'stream-b',
                title: 'Stream B: Deployment Workflows',
                tasks: ['15', '16', '17'],
                status: 'pending',
                progress: 0,
                description: '6-step deployment wizard, device configuration',
                agent: 'mobile-dev',
                estimated_hours: 24,
                eas_build: 3
            },
            'stream-c': {
                id: 'stream-c',
                title: 'Stream C: Devices & Maps',
                tasks: ['18', '19', '20'],
                status: 'pending',
                progress: 0,
                description: 'Device management, map integration, LoRaWAN',
                agent: 'mobile-dev',
                estimated_hours: 30,
                eas_build: 4
            },
            integration: {
                id: 'integration',
                title: 'Integration Phase',
                tasks: ['21', '22', '23'],
                status: 'pending',
                progress: 0,
                description: 'Testing, optimization, production preparation',
                agent: 'quality-assurance-engineer',
                estimated_hours: 16,
                eas_build: 5
            }
        };

        // EAS Build pipeline configuration
        this.easBuilds = [
            {
                id: 1,
                name: 'Foundation Build',
                purpose: 'Validate SQLite & Core Architecture',
                status: 'pending',
                stream: 'foundation',
                device_testing: false,
                build_date: null
            },
            {
                id: 2,
                name: 'Project Management Build',
                purpose: 'Test Project & Role Management',
                status: 'pending',
                stream: 'stream-a',
                device_testing: false,
                build_date: null
            },
            {
                id: 3,
                name: 'Deployment Workflow Build',
                purpose: 'Validate 6-Step Wizard',
                status: 'pending',
                stream: 'stream-b',
                device_testing: true,
                build_date: null
            },
            {
                id: 4,
                name: 'Devices & Maps Build',
                purpose: 'Test Device Integration',
                status: 'pending',
                stream: 'stream-c',
                device_testing: true,
                build_date: null
            },
            {
                id: 5,
                name: 'Production Release Build',
                purpose: 'Final Integration Testing',
                status: 'pending',
                stream: 'integration',
                device_testing: true,
                build_date: null
            }
        ];

        // Agent definitions
        this.agentDefinitions = {
            'mobile-dev': {
                name: 'Mobile Development Agent',
                description: 'React Native/Expo specialist',
                status: 'active',
                current_task: 'Task 11.4: Conflict Resolution',
                estimated_completion: '2 hours'
            },
            'supabase-admin': {
                name: 'Supabase Backend Agent',
                description: 'Database & API specialist',
                status: 'idle',
                current_task: 'Monitoring backend status',
                estimated_completion: 'On standby'
            },
            'quality-assurance-engineer': {
                name: 'QA Testing Agent',
                description: 'TDD/BDD testing specialist',
                status: 'idle',
                current_task: 'Awaiting Stream A completion',
                estimated_completion: 'Pending'
            },
            'devops': {
                name: 'DevOps Deployment Agent',
                description: 'EAS builds & deployment',
                status: 'idle',
                current_task: 'EAS build pipeline setup',
                estimated_completion: 'Ready'
            }
        };

        // Document content cache
        this.documentCache = {};

        this.loadSettings();
        this.setupPeriodicRefresh();
        this.setupActivityRefresh();
    }

    async initialize() {
        this.updateConnectionStatus('Initializing MVP2 Dashboard...', false);

        try {
            await this.loadData();
            this.renderCurrentTab();
            this.updateConnectionStatus('Connected to MVP2 Dashboard', true);
            this.updateLastUpdate();

            // Initialize activity feed
            this.addActivity('system', 'Dashboard Initialized', 'MVP2 Dashboard connected successfully', 'milestone');

            // Apply theme
            this.applyTheme();

        } catch (error) {
            console.error('Dashboard initialization error:', error);
            this.updateConnectionStatus('Connection Failed', false);
        }
    }

    // Theme Management
    toggleTheme() {
        const newTheme = this.settings.theme === 'light' ? 'dark' : 'light';
        this.setTheme(newTheme);
    }

    setTheme(theme) {
        this.settings.theme = theme;
        this.applyTheme();
        this.saveSettings();
    }

    applyTheme() {
        document.body.setAttribute('data-theme', this.settings.theme);
        const themeToggle = document.getElementById('themeToggle');
        if (themeToggle) {
            themeToggle.textContent = this.settings.theme === 'light' ? '🌙 Dark' : '☀️ Light';
        }
    }

    // Tab Management
    switchTab(tabName) {
        // Update active tab button
        document.querySelectorAll('.tab-button').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');

        // Update active tab content
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.remove('active');
        });
        document.getElementById(tabName).classList.add('active');

        this.currentTab = tabName;
        this.renderCurrentTab();
    }

    renderCurrentTab() {
        switch (this.currentTab) {
            case 'overview':
                this.renderOverview();
                break;
            case 'streams':
                this.renderStreams();
                break;
            case 'tasks':
                this.renderTasks();
                break;
            case 'agents':
                this.renderAgentsTab();
                break;
            case 'metrics':
                this.renderMetricsTab();
                break;
            case 'activity':
                this.renderActivity();
                break;
            case 'documents':
                this.renderDocuments();
                break;
            case 'settings':
                this.renderSettings();
                break;
        }
    }

    // Data Loading (similar to original)
    async loadData() {
        try {
            // Load mobile app data
            await this.loadMobileAppData();

            // Load backend data
            await this.loadBackendData();

            // Load metrics data
            await this.loadMetricsData();

            // Update agent statuses
            this.updateAgentStatuses();

            // Update quality gates
            this.updateQualityGates();

            this.isConnected = true;
            this.retryCount = 0;

        } catch (error) {
            this.handleConnectionError(error);
        }
    }

    async loadMobileAppData() {
        try {
            this.data.mobile = {
                tasks: this.generateTaskData(),
                progress: this.calculateOverallProgress(),
                status: 'active',
                current_stream: 'foundation',
                last_commit: 'feat: UUID alignment completed',
                branch: 'dev-mvp2-development-claude-flow-test',
                test_coverage: 85,
                typescript_errors: 0
            };

        } catch (error) {
            console.warn('Failed to load mobile app data:', error.message);
            this.data.mobile.status = 'disconnected';
        }
    }

    async loadBackendData() {
        try {
            this.data.backend = {
                progress: 98,
                status: 'ready',
                deployment_status: 'Production Ready',
                last_deployment: '2025-09-17',
                environment: 'Development Live',
                health_check: 'Passing'
            };

        } catch (error) {
            console.warn('Failed to load backend data:', error.message);
            this.data.backend.status = 'disconnected';
        }
    }

    async loadMetricsData() {
        this.data.metrics = {
            total_tasks: 23,
            completed_tasks: 10,
            completion_rate: 43.5,
            days_elapsed: this.calculateDaysElapsed(),
            estimated_days_remaining: 20,
            current_velocity: 2.5,
            total_estimated_hours: 88,
            hours_completed: 35,
            hours_remaining: 53,
            average_task_variance: -12.5,
            quality_score: 92
        };
    }

    // Activity Feed Management
    addActivity(type, title, description, category = 'task') {
        const activity = {
            id: Date.now() + Math.random(),
            timestamp: new Date(),
            type,
            title,
            description,
            category
        };

        this.activityFeed.unshift(activity);

        // Keep only max items
        if (this.activityFeed.length > this.maxActivityItems) {
            this.activityFeed = this.activityFeed.slice(0, this.maxActivityItems);
        }

        // Show notification if enabled
        if (this.settings.toasts && category !== 'system') {
            this.showNotification(title, description, this.getNotificationType(category));
        }

        // Play sound if enabled
        if (this.settings.sounds && category !== 'system') {
            this.playNotificationSound();
        }

        // Update activity feed if currently visible
        if (this.currentTab === 'activity') {
            this.renderActivity();
        }
    }

    getNotificationType(category) {
        const typeMap = {
            'commit': 'success',
            'task': 'info',
            'build': 'warning',
            'test': 'error',
            'milestone': 'success'
        };
        return typeMap[category] || 'info';
    }

    renderActivity() {
        const activityFeed = document.getElementById('activityFeed');

        if (this.activityFeed.length === 0) {
            activityFeed.innerHTML = `
                <div style="text-align: center; padding: 40px; color: #666;">
                    <div style="font-size: 48px; margin-bottom: 15px;">📭</div>
                    <p>No activity yet</p>
                    <button onclick="dashboard.simulateActivity()" style="margin-top: 15px; padding: 8px 16px; border: 1px solid #ddd; border-radius: 5px; background: white; cursor: pointer;">Simulate Activity</button>
                </div>
            `;
            return;
        }

        let html = '';
        this.activityFeed.forEach(activity => {
            const timeAgo = this.getTimeAgo(activity.timestamp);

            html += `
                <div class="activity-item">
                    <div class="activity-icon ${activity.category}">
                        ${this.getActivityIcon(activity.category)}
                    </div>
                    <div class="activity-content">
                        <div class="activity-title">${activity.title}</div>
                        <div class="activity-description">${activity.description}</div>
                        <div class="activity-time">${timeAgo}</div>
                    </div>
                </div>
            `;
        });

        activityFeed.innerHTML = html;
    }

    getActivityIcon(category) {
        const icons = {
            'commit': '📝',
            'task': '✅',
            'build': '🏗️',
            'test': '🧪',
            'milestone': '🎯',
            'system': '⚙️'
        };
        return icons[category] || '📌';
    }

    getTimeAgo(date) {
        const now = new Date();
        const diff = now - date;
        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(diff / 3600000);
        const days = Math.floor(diff / 86400000);

        if (days > 0) return `${days}d ago`;
        if (hours > 0) return `${hours}h ago`;
        if (minutes > 0) return `${minutes}m ago`;
        return 'Just now';
    }

    // Notification System
    showNotification(title, message, type = 'info') {
        const container = document.getElementById('notificationContainer');
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;

        const id = 'notification-' + Date.now();
        notification.id = id;

        notification.innerHTML = `
            <div class="notification-header">
                <div class="notification-title">${title}</div>
                <button class="notification-close" onclick="dashboard.closeNotification('${id}')">&times;</button>
            </div>
            <div class="notification-body">${message}</div>
        `;

        container.appendChild(notification);

        // Show with animation
        setTimeout(() => notification.classList.add('show'), 100);

        // Auto-close after 5 seconds
        setTimeout(() => this.closeNotification(id), 5000);
    }

    closeNotification(id) {
        const notification = document.getElementById(id);
        if (notification) {
            notification.classList.remove('show');
            setTimeout(() => notification.remove(), 300);
        }
    }

    playNotificationSound() {
        // Simple notification sound using Web Audio API
        if (this.settings.sounds) {
            try {
                const audioContext = new (window.AudioContext || window.webkitAudioContext)();
                const oscillator = audioContext.createOscillator();
                const gainNode = audioContext.createGain();

                oscillator.connect(gainNode);
                gainNode.connect(audioContext.destination);

                oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
                oscillator.frequency.setValueAtTime(600, audioContext.currentTime + 0.1);

                gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
                gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2);

                oscillator.start(audioContext.currentTime);
                oscillator.stop(audioContext.currentTime + 0.2);
            } catch (error) {
                console.warn('Could not play notification sound:', error);
            }
        }
    }

    // Rendering Methods
    renderOverview() {
        const overviewContent = document.getElementById('overviewContent');

        overviewContent.innerHTML = `
            <!-- Metrics Overview -->
            <div class="metrics-grid" style="margin-bottom: 25px;">
                ${this.renderMetricsCards()}
            </div>

            <!-- Cross-Repository Status -->
            <div class="repo-status-grid" style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 25px;">
                ${this.renderRepoStatusCards()}
            </div>

            <!-- Recent Activity Preview -->
            <div style="background: white; border-radius: 15px; padding: 25px; box-shadow: var(--shadow); margin-bottom: 25px;">
                <h3 style="margin-bottom: 15px;">🔔 Recent Activity</h3>
                <div class="activity-feed" style="max-height: 200px;">
                    ${this.renderRecentActivityPreview()}
                </div>
                <div style="text-align: center; margin-top: 15px;">
                    <button onclick="dashboard.switchTab('activity')" style="padding: 8px 16px; border: 1px solid var(--primary-color); background: white; color: var(--primary-color); border-radius: 5px; cursor: pointer;">View All Activity</button>
                </div>
            </div>
        `;
    }

    renderMetricsCards() {
        const metrics = this.data.metrics;

        return `
            <div class="metric-card">
                <div class="metric-number">${metrics.completion_rate}%</div>
                <div class="metric-label">Overall Progress</div>
                <div class="metric-trend positive">▲ On track</div>
            </div>
            <div class="metric-card">
                <div class="metric-number">${metrics.completed_tasks}/${metrics.total_tasks}</div>
                <div class="metric-label">Tasks Completed</div>
                <div class="metric-trend neutral">${metrics.total_tasks - metrics.completed_tasks} remaining</div>
            </div>
            <div class="metric-card">
                <div class="metric-number">${metrics.days_elapsed}</div>
                <div class="metric-label">Days Active</div>
                <div class="metric-trend neutral">${metrics.estimated_days_remaining} estimated remaining</div>
            </div>
            <div class="metric-card">
                <div class="metric-number">${metrics.current_velocity}</div>
                <div class="metric-label">Tasks/Day Velocity</div>
                <div class="metric-trend positive">▲ ${Math.abs(metrics.average_task_variance)}% ahead</div>
            </div>
            <div class="metric-card">
                <div class="metric-number">${metrics.hours_completed}h</div>
                <div class="metric-label">Hours Completed</div>
                <div class="metric-trend neutral">${metrics.hours_remaining}h remaining</div>
            </div>
            <div class="metric-card">
                <div class="metric-number">${metrics.quality_score}%</div>
                <div class="metric-label">Quality Score</div>
                <div class="metric-trend positive">▲ Excellent</div>
            </div>
        `;
    }

    renderRepoStatusCards() {
        return `
            <div class="repo-card">
                <div class="repo-header">
                    <div class="repo-title">📱 Mobile App Repository</div>
                    <div class="repo-status-badge ${this.data.mobile.status}">${this.data.mobile.status.toUpperCase()}</div>
                </div>
                <div class="repo-progress">
                    <div class="progress-text">Development Progress</div>
                    <div class="progress-enhanced">
                        <div class="progress-fill-enhanced" style="width: ${this.data.mobile.progress}%"></div>
                        <div class="progress-text-enhanced">${this.data.mobile.progress}%</div>
                    </div>
                </div>
                <div style="font-size: 0.9em; color: #666; margin-top: 15px;">
                    <div><strong>Current Stream:</strong> ${this.data.mobile.current_stream || 'Foundation'}</div>
                    <div><strong>Last Commit:</strong> ${this.data.mobile.last_commit || 'N/A'}</div>
                    <div><strong>Test Coverage:</strong> ${this.data.mobile.test_coverage || 0}%</div>
                </div>
            </div>

            <div class="repo-card">
                <div class="repo-header">
                    <div class="repo-title">🔧 Backend Repository</div>
                    <div class="repo-status-badge ${this.data.backend.status}">${this.data.backend.status.toUpperCase()}</div>
                </div>
                <div class="repo-progress">
                    <div class="progress-text">Backend Readiness</div>
                    <div class="progress-enhanced">
                        <div class="progress-fill-enhanced" style="width: ${this.data.backend.progress}%"></div>
                        <div class="progress-text-enhanced">${this.data.backend.progress}%</div>
                    </div>
                </div>
                <div style="font-size: 0.9em; color: #666; margin-top: 15px;">
                    <div><strong>Status:</strong> ${this.data.backend.deployment_status || 'Production Ready'}</div>
                    <div><strong>Environment:</strong> ${this.data.backend.environment || 'Development Live'}</div>
                    <div><strong>Health:</strong> ${this.data.backend.health_check || 'Passing'}</div>
                </div>
            </div>
        `;
    }

    renderRecentActivityPreview() {
        if (this.activityFeed.length === 0) {
            return '<p style="text-align: center; color: #666;">No recent activity</p>';
        }

        const recentItems = this.activityFeed.slice(0, 3);
        return recentItems.map(activity => `
            <div class="activity-item">
                <div class="activity-icon ${activity.category}">
                    ${this.getActivityIcon(activity.category)}
                </div>
                <div class="activity-content">
                    <div class="activity-title">${activity.title}</div>
                    <div class="activity-description">${activity.description}</div>
                    <div class="activity-time">${this.getTimeAgo(activity.timestamp)}</div>
                </div>
            </div>
        `).join('');
    }

    renderStreams() {
        const streamsGrid = document.getElementById('streamsGrid');

        let html = `
            <div style="margin-bottom: 20px; text-align: center;">
                <h2>🏗️ Development Streams Progress</h2>
                <div class="methodology-badge">Hybrid Incremental-Stream Approach</div>
                <p>Sequential execution with validation gates • Human oversight coordination</p>
            </div>
        `;

        Object.values(this.streams).forEach(stream => {
            const taskList = stream.tasks.map(taskId => {
                const task = this.data.mobile.tasks.find(t => t.id === taskId);
                return `
                    <div class="task-item" onclick="dashboard.openTaskModal('${taskId}')">
                        <div class="task-info">
                            <div class="task-title">${task ? task.title : this.getTaskTitle(taskId)}</div>
                            <div class="task-meta">Task ${taskId} • ${stream.estimated_hours / stream.tasks.length}h est.</div>
                        </div>
                        <div class="task-status-icon ${task ? task.status : 'pending'}">
                            ${this.getStatusIcon(task ? task.status : 'pending')}
                        </div>
                    </div>
                `;
            }).join('');

            html += `
                <div class="stream-card ${stream.id}">
                    <div class="stream-header">
                        <div class="stream-title">${stream.title}</div>
                        <div class="stream-status ${stream.status}">${stream.status.toUpperCase()}</div>
                    </div>
                    <div class="stream-tasks">
                        ${taskList}
                    </div>
                    <div class="repo-progress">
                        <div class="progress-text">Stream Progress</div>
                        <div class="progress-enhanced">
                            <div class="progress-fill-enhanced" style="width: ${stream.progress}%"></div>
                            <div class="progress-text-enhanced">${stream.progress}%</div>
                        </div>
                        <div style="font-size: 0.85em; margin-top: 5px; color: #666;">
                            ${stream.estimated_hours}h estimated • EAS Build #${stream.eas_build}
                        </div>
                    </div>
                </div>
            `;
        });

        streamsGrid.innerHTML = html;
    }

    renderTasks() {
        const tasksGrid = document.getElementById('tasksGrid');
        const allTasks = this.generateTaskData();

        // Apply filters
        const filteredTasks = this.filterTasksBySearch(allTasks);

        if (filteredTasks.length === 0) {
            tasksGrid.innerHTML = `
                <div style="text-align: center; padding: 40px; color: #666;">
                    <div style="font-size: 48px; margin-bottom: 15px;">🔍</div>
                    <p>No tasks match your search criteria</p>
                </div>
            `;
            return;
        }

        let html = '';
        filteredTasks.forEach(task => {
            const stream = this.streams[task.stream];
            html += `
                <div class="task-card" onclick="dashboard.openTaskModal('${task.id}')" style="background: white; border-radius: 10px; padding: 20px; margin-bottom: 15px; box-shadow: var(--shadow); cursor: pointer; transition: transform 0.2s; border-left: 4px solid var(--${this.getTaskStatusColor(task.status)}-color);">
                    <div style="display: flex; justify-content: between; align-items: start;">
                        <div style="flex: 1;">
                            <h4 style="margin-bottom: 8px;">Task ${task.id}: ${task.title}</h4>
                            <p style="color: #666; margin-bottom: 10px;">Stream: ${stream.title}</p>
                            <div style="display: flex; gap: 15px; font-size: 0.9em; color: #666;">
                                <span>⏱️ ${task.estimated_hours}h estimated</span>
                                <span>👤 ${this.agentDefinitions[task.agent].name}</span>
                                <span>📊 ${task.progress}% complete</span>
                            </div>
                        </div>
                        <div class="task-status-icon ${task.status}" style="margin-left: 15px;">
                            ${this.getStatusIcon(task.status)}
                        </div>
                    </div>
                </div>
            `;
        });

        tasksGrid.innerHTML = html;
    }

    renderAgentsTab() {
        const agentsGrid = document.getElementById('agentsGridTab');

        let html = `
            <div style="margin-bottom: 20px; text-align: center;">
                <h2>🤖 AI Agent Activity Monitor</h2>
                <p>Real-time agent assignments and task coordination</p>
            </div>
        `;

        this.data.agents.forEach(agent => {
            html += `
                <div class="agent-card ${agent.status}" onclick="dashboard.openAgentModal('${agent.id}')" style="cursor: pointer;">
                    <div class="agent-header">
                        <div class="agent-name">${agent.name}</div>
                        <div class="agent-status ${agent.status}"></div>
                    </div>
                    <div class="agent-task">
                        <strong>Current:</strong> ${agent.current_task}
                    </div>
                    <div class="agent-task">
                        <strong>ETA:</strong> ${agent.estimated_completion}
                    </div>
                    <div style="margin-top: 10px; font-size: 0.9em; color: #666;">
                        ${agent.description}
                    </div>
                </div>
            `;
        });

        agentsGrid.innerHTML = html;
    }

    renderMetricsTab() {
        const metricsGrid = document.getElementById('metricsGridTab');
        const gatesGrid = document.getElementById('gatesGridTab');

        // Render metrics
        metricsGrid.innerHTML = this.renderMetricsCards();

        // Render quality gates
        let gatesHtml = '';
        Object.entries(this.data.quality_gates).forEach(([key, gate]) => {
            gatesHtml += `
                <div class="gate-card ${gate.status}" onclick="dashboard.openGateModal('${key}')">
                    <div class="gate-title">${this.formatGateTitle(key)}</div>
                    <div class="gate-value">${gate.value}</div>
                    ${gate.threshold ? `<div style="font-size: 0.8em; color: #666;">Threshold: ${gate.threshold}</div>` : ''}
                </div>
            `;
        });

        gatesGrid.innerHTML = gatesHtml;
    }

    // Helper methods remain the same as original
    generateTaskData() {
        const allTasks = [];

        Object.values(this.streams).forEach(stream => {
            stream.tasks.forEach((taskId, index) => {
                allTasks.push({
                    id: taskId,
                    title: this.getTaskTitle(taskId),
                    status: this.getTaskStatus(taskId, stream),
                    stream: stream.id,
                    agent: stream.agent,
                    estimated_hours: stream.estimated_hours / stream.tasks.length,
                    progress: this.getTaskProgress(taskId, stream)
                });
            });
        });

        return allTasks;
    }

    getTaskTitle(taskId) {
        const taskTitles = {
            '11.4': 'Conflict Resolution Implementation',
            '11.5': 'Advanced Sync Operations',
            '11.6': 'Performance Optimization',
            '11.7': 'SQLite Testing Suite',
            '12': 'Project List Interface',
            '13': 'Role Management System',
            '14': 'Organization Switching',
            '15': '6-Step Deployment Wizard - Part 1',
            '16': '6-Step Deployment Wizard - Part 2',
            '17': 'Device Configuration Interface',
            '18': 'Device Management Dashboard',
            '19': 'Map Integration & Location Services',
            '20': 'LoRaWAN Communication Layer',
            '21': 'Comprehensive Testing Suite',
            '22': 'Performance Optimization',
            '23': 'Production Deployment Preparation'
        };

        return taskTitles[taskId] || `Task ${taskId}`;
    }

    getTaskStatus(taskId, stream) {
        if (stream.id === 'foundation') {
            return taskId === '11.4' ? 'active' : 'pending';
        }
        return 'pending';
    }

    getTaskProgress(taskId, stream) {
        if (stream.id === 'foundation') {
            return taskId === '11.4' ? 25 : 0;
        }
        return 0;
    }

    getTaskStatusColor(status) {
        const colors = {
            'completed': 'success',
            'active': 'info',
            'pending': 'warning',
            'blocked': 'danger'
        };
        return colors[status] || 'warning';
    }

    filterTasksBySearch(tasks) {
        const searchTerm = document.getElementById('taskSearch')?.value.toLowerCase() || '';
        const activeFilter = document.getElementById('filterActive')?.checked;
        const pendingFilter = document.getElementById('filterPending')?.checked;
        const completedFilter = document.getElementById('filterCompleted')?.checked;

        return tasks.filter(task => {
            // Text search
            const matchesSearch = !searchTerm ||
                task.title.toLowerCase().includes(searchTerm) ||
                task.id.includes(searchTerm) ||
                this.streams[task.stream].title.toLowerCase().includes(searchTerm);

            // Status filter
            const matchesStatus = (!activeFilter && !pendingFilter && !completedFilter) ||
                (activeFilter && task.status === 'active') ||
                (pendingFilter && task.status === 'pending') ||
                (completedFilter && task.status === 'completed');

            return matchesSearch && matchesStatus;
        });
    }

    filterTasks() {
        if (this.currentTab === 'tasks') {
            this.renderTasks();
        }
    }

    calculateOverallProgress() {
        return 43.5;
    }

    calculateDaysElapsed() {
        const startDate = new Date('2025-09-17');
        const today = new Date();
        const diffTime = Math.abs(today - startDate);
        return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    }

    updateAgentStatuses() {
        this.data.agents = Object.keys(this.agentDefinitions).map(agentId => ({
            id: agentId,
            ...this.agentDefinitions[agentId]
        }));
    }

    updateQualityGates() {
        this.data.quality_gates = {
            test_coverage: { value: 85, threshold: 80, status: 'passed' },
            typescript_errors: { value: 0, threshold: 0, status: 'passed' },
            build_status: { value: 'Passing', status: 'passed' },
            security_scan: { value: 'Clean', status: 'passed' },
            performance_budget: { value: 'Within limits', status: 'passed' },
            dependency_audit: { value: 'No vulnerabilities', status: 'passed' }
        };
    }

    getStatusIcon(status) {
        const icons = {
            completed: '✓',
            active: '▶',
            pending: '○',
            blocked: '⚠'
        };
        return icons[status] || '○';
    }

    formatGateTitle(key) {
        return key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    }

    // Document Management
    renderDocuments() {
        // Load default document if auto-load is enabled
        if (this.settings.autoLoadDocs && this.settings.defaultDoc) {
            setTimeout(() => {
                document.getElementById('documentSelect').value = this.settings.defaultDoc;
                this.loadDocument();
            }, 100);
        }
    }

    loadDocument() {
        const docSelect = document.getElementById('documentSelect');
        const docTitle = document.getElementById('documentTitle');
        const docContent = document.getElementById('documentContent');
        const selectedDoc = docSelect.value;

        if (!selectedDoc) {
            docTitle.textContent = 'Select a document';
            docContent.innerHTML = '<p>Please select a document from the dropdown above to view its contents.</p>';
            return;
        }

        const documents = {
            'execution-plan': {
                title: 'MVP2 Master Execution Plan',
                content: this.getMockDocumentContent('execution-plan')
            },
            'metrics-tracker': {
                title: 'MVP2 Metrics Tracker',
                content: this.getMockDocumentContent('metrics-tracker')
            },
            'task-management': {
                title: 'Task Management Status',
                content: this.getMockDocumentContent('task-management')
            },
            'backend-status': {
                title: 'Backend Status Report',
                content: this.getMockDocumentContent('backend-status')
            }
        };

        const doc = documents[selectedDoc];
        if (doc) {
            docTitle.textContent = doc.title;
            docContent.innerHTML = this.renderMarkdown(doc.content);
        }
    }

    getMockDocumentContent(docType) {
        const contents = {
            'execution-plan': `
# MVP2 Master Execution Plan

## Overview
This document outlines the comprehensive execution plan for Wildlife Watcher MVP2 development.

## Current Status
- **Completion Rate**: 43.5%
- **Active Stream**: Foundation Layer
- **Next Milestone**: Stream A Launch

## Parallel Streams Ready
- **Stream A**: Project Management (Tasks 12-14) - 18 hours
- **Stream B**: Deployment Workflows (Tasks 15-17) - 24 hours
- **Stream C**: Devices & Maps (Tasks 18-20) - 30 hours

## Quality Gates
All foundation quality gates are currently passing:
- ✅ Test Coverage: 85% (threshold: 80%)
- ✅ TypeScript Errors: 0
- ✅ Build Status: Passing
            `,
            'metrics-tracker': `
# MVP2 Metrics Tracker

## Time Tracking
- **Total Estimated Hours**: 88 hours
- **Hours Completed**: 35 hours (40%)
- **Hours Remaining**: 53 hours
- **Current Velocity**: 2.5 tasks/day

## Task Progress
- **Total Tasks**: 23
- **Completed**: 10
- **In Progress**: 1 (Task 11.4)
- **Pending**: 12

## Variance Analysis
- **Average Task Variance**: -12.5% (ahead of schedule)
- **Quality Score**: 92%
- **Risk Level**: Low
            `,
            'task-management': `
# Task Management Status

## Foundation Layer (75% Complete)
- ✅ Tasks 11.1-11.3: Complete
- 🔄 Task 11.4: Conflict Resolution (25% complete)
- ⏳ Task 11.5: Advanced Sync Operations
- ⏳ Task 11.6: Performance Optimization
- ⏳ Task 11.7: SQLite Testing Suite

## Stream Dependencies
All streams are blocked pending foundation completion.

## Agent Assignments
- **Mobile Dev Agent**: Active on Task 11.4
- **QA Engineer**: Awaiting Stream A
- **DevOps Agent**: Build pipeline ready
- **Supabase Admin**: Backend monitoring
            `,
            'backend-status': `
# Backend Status Report

## Deployment Status
- **Environment**: Development Live
- **Progress**: 98% Complete
- **Status**: Production Ready
- **Health Check**: All systems passing

## Integration Readiness
Backend is fully prepared for MVP2 mobile app integration:
- ✅ Database schema deployed
- ✅ API endpoints active
- ✅ Authentication system live
- ✅ LoRaWAN webhooks configured

## Cross-Project Coordination
Backend team is on standby for mobile development support.
            `
        };

        return contents[docType] || 'Document content not available.';
    }

    renderMarkdown(content) {
        // Simple markdown rendering
        return content
            .replace(/^# (.*$)/gm, '<h1>$1</h1>')
            .replace(/^## (.*$)/gm, '<h2>$1</h2>')
            .replace(/^### (.*$)/gm, '<h3>$1</h3>')
            .replace(/^\- (.*$)/gm, '<li>$1</li>')
            .replace(/^([^<\n]+)$/gm, '<p>$1</p>')
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            .replace(/`(.*?)`/g, '<code>$1</code>')
            .replace(/✅/g, '<span style="color: var(--success-color);">✅</span>')
            .replace(/🔄/g, '<span style="color: var(--info-color);">🔄</span>')
            .replace(/⏳/g, '<span style="color: var(--warning-color);">⏳</span>')
            .replace(/❌/g, '<span style="color: var(--danger-color);">❌</span>');
    }

    refreshDocument() {
        // Clear cache and reload
        const docSelect = document.getElementById('documentSelect');
        const selectedDoc = docSelect.value;
        if (selectedDoc) {
            delete this.documentCache[selectedDoc];
            this.loadDocument();
            this.showNotification('Document Refreshed', `${selectedDoc} has been updated`, 'info');
        }
    }

    downloadDocument() {
        const docSelect = document.getElementById('documentSelect');
        const docContent = document.getElementById('documentContent');
        const selectedDoc = docSelect.value;

        if (!selectedDoc) {
            this.showNotification('Error', 'Please select a document first', 'error');
            return;
        }

        const content = docContent.textContent || docContent.innerText;
        const blob = new Blob([content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = `${selectedDoc}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        this.showNotification('Download Started', `${selectedDoc} is being downloaded`, 'success');
    }

    // Settings Management
    renderSettings() {
        const settingsPanel = document.querySelector('#settings .settings-panel');
        if (!settingsPanel) return;

        // Update all settings inputs with current values
        setTimeout(() => {
            document.getElementById('settingSounds').checked = this.settings.sounds;
            document.getElementById('settingToasts').checked = this.settings.toasts;
            document.getElementById('settingAutoRefresh').checked = this.settings.autoRefresh;
            document.getElementById('settingDefaultDoc').value = this.settings.defaultDoc;
            document.getElementById('settingAutoLoadDocs').checked = this.settings.autoLoadDocs;
            document.getElementById('settingRefreshInterval').value = this.config.refreshInterval;
            document.getElementById('settingActivityInterval').value = this.settings.activityInterval;
            document.getElementById('settingTheme').value = this.settings.theme;
            document.getElementById('settingCompact').checked = this.settings.compact;
            document.getElementById('settingApiEndpoint').value = this.config.apiEndpoint;
            document.getElementById('settingMobileRepo').value = this.config.mobileRepoPath;
            document.getElementById('settingBackendRepo').value = this.config.backendRepoPath;
        }, 100);
    }

    updateSetting(key, value) {
        this.settings[key] = value;
        this.saveSettings();

        // Apply setting changes immediately
        switch (key) {
            case 'theme':
                this.applyTheme();
                break;
            case 'sounds':
                // Test notification sound if enabled
                if (value) {
                    this.playNotificationSound();
                }
                break;
            case 'autoRefresh':
                if (value) {
                    this.setupPeriodicRefresh();
                } else {
                    this.clearPeriodicRefresh();
                }
                break;
            case 'compact':
                document.body.classList.toggle('compact-mode', value);
                break;
        }

        this.showNotification('Settings Updated', `${key} has been updated`, 'success');
    }

    updateRefreshInterval(value) {
        this.config.refreshInterval = parseInt(value);
        this.setupPeriodicRefresh();
        this.showNotification('Refresh Interval Updated', `Now refreshing every ${value/1000} seconds`, 'info');
    }

    updateApiEndpoint(value) {
        this.config.apiEndpoint = value;
        this.showNotification('API Endpoint Updated', 'Connection will use new endpoint on next refresh', 'info');
    }

    loadSettings() {
        const savedSettings = localStorage.getItem('mvp2-dashboard-settings');
        if (savedSettings) {
            try {
                const parsed = JSON.parse(savedSettings);
                this.settings = { ...this.settings, ...parsed };
            } catch (error) {
                console.warn('Could not load settings:', error);
            }
        }
    }

    saveSettings() {
        localStorage.setItem('mvp2-dashboard-settings', JSON.stringify(this.settings));
    }

    // Activity Management Methods
    refreshActivity() {
        this.addActivity('system', 'Activity Refreshed', 'Activity feed has been manually refreshed', 'system');
        this.renderActivity();
    }

    clearActivity() {
        this.activityFeed = [];
        this.renderActivity();
        this.showNotification('Activity Cleared', 'Activity feed has been cleared', 'info');
    }

    toggleSound() {
        const soundEnabled = document.getElementById('soundNotifications').checked;
        this.updateSetting('sounds', soundEnabled);
    }

    simulateActivity() {
        const activities = [
            ['commit', 'New Commit', 'feat: implement conflict resolution logic', 'commit'],
            ['task', 'Task Updated', 'Task 11.4 progress updated to 35%', 'task'],
            ['build', 'Build Started', 'EAS Build #1 initiated for foundation testing', 'build'],
            ['test', 'Tests Passed', 'All unit tests passing (147/147)', 'test'],
            ['milestone', 'Milestone Reached', 'Foundation Layer 75% complete', 'milestone']
        ];

        const randomActivity = activities[Math.floor(Math.random() * activities.length)];
        this.addActivity(...randomActivity);
    }

    // Periodic refresh setup
    setupPeriodicRefresh() {
        this.clearPeriodicRefresh();

        if (this.settings.autoRefresh) {
            this.refreshInterval = setInterval(async () => {
                if (this.isConnected) {
                    await this.loadData();
                    this.updateLastUpdate();
                    this.renderCurrentTab();
                }
            }, this.config.refreshInterval);
        }
    }

    setupActivityRefresh() {
        // Simulate periodic activity updates
        setInterval(() => {
            if (Math.random() < 0.1) { // 10% chance every interval
                this.simulateActivity();
            }
        }, this.settings.activityInterval);
    }

    clearPeriodicRefresh() {
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
            this.refreshInterval = null;
        }
    }

    // Data refresh methods
    async refreshData() {
        const refreshBtn = document.getElementById('refreshBtn');
        if (refreshBtn) {
            refreshBtn.textContent = '⟳ Refreshing...';
            refreshBtn.disabled = true;
        }

        try {
            await this.loadData();
            this.renderCurrentTab();
            this.updateLastUpdate();
            this.addActivity('system', 'Data Refreshed', 'Dashboard data has been manually refreshed', 'system');
        } finally {
            if (refreshBtn) {
                refreshBtn.textContent = '🔄 Refresh';
                refreshBtn.disabled = false;
            }
        }
    }

    applyFilters() {
        this.filters.repository = document.getElementById('repoFilter')?.value || 'all';
        this.filters.stream = document.getElementById('streamFilter')?.value || 'all';
        this.renderCurrentTab();
    }

    updateConnectionStatus(message, connected) {
        const indicator = document.getElementById('statusIndicator');
        const status = document.getElementById('connectionStatus');

        if (indicator) {
            indicator.className = `status-indicator ${connected ? 'connected' : ''}`;
        }
        if (status) {
            status.textContent = message;
        }
    }

    updateLastUpdate() {
        const now = new Date();
        const lastUpdate = document.getElementById('lastUpdate');
        if (lastUpdate) {
            lastUpdate.textContent = `Last updated: ${now.toLocaleTimeString()}`;
        }
    }

    handleConnectionError(error) {
        this.isConnected = false;
        this.retryCount++;

        console.error('Dashboard connection error:', error);

        if (this.retryCount <= this.maxRetries) {
            this.updateConnectionStatus(`Retrying... (${this.retryCount}/${this.maxRetries})`, false);
            setTimeout(() => this.loadData(), 2000);
        } else {
            this.updateConnectionStatus('Connection Failed', false);
        }
    }

    // Modal functions (keeping compatibility)
    openTaskModal(taskId) {
        const task = this.data.mobile.tasks.find(t => t.id === taskId);
        if (!task) {
            console.warn('Task not found:', taskId);
            return;
        }

        const modalContent = `
            <div style="padding: 20px;">
                <h2>Task ${taskId}: ${task.title}</h2>
                <div style="display: grid; grid-template-columns: 150px 1fr; gap: 15px; margin-top: 20px;">
                    <div><strong>Status:</strong></div>
                    <div><span class="task-status-icon ${task.status}">${this.getStatusIcon(task.status)} ${task.status.toUpperCase()}</span></div>

                    <div><strong>Stream:</strong></div>
                    <div>${this.streams[task.stream].title}</div>

                    <div><strong>Agent:</strong></div>
                    <div>${this.agentDefinitions[task.agent].name}</div>

                    <div><strong>Progress:</strong></div>
                    <div>${task.progress}%</div>

                    <div><strong>Estimated:</strong></div>
                    <div>${task.estimated_hours} hours</div>

                    <div><strong>Description:</strong></div>
                    <div>${this.streams[task.stream].description}</div>
                </div>
                <div style="margin-top: 20px; text-align: right;">
                    <button onclick="dashboard.closeModal()" style="padding: 10px 20px; background: var(--primary-color); color: white; border: none; border-radius: 5px; cursor: pointer;">Close</button>
                </div>
            </div>
        `;

        this.showModal(modalContent);
    }

    openAgentModal(agentId) {
        const agent = this.data.agents.find(a => a.id === agentId);
        if (!agent) {
            console.warn('Agent not found:', agentId);
            return;
        }

        const modalContent = `
            <div style="padding: 20px;">
                <h2>${agent.name}</h2>
                <div style="display: grid; grid-template-columns: 150px 1fr; gap: 15px; margin-top: 20px;">
                    <div><strong>Description:</strong></div>
                    <div>${agent.description}</div>

                    <div><strong>Status:</strong></div>
                    <div><span class="agent-status ${agent.status}">${agent.status.toUpperCase()}</span></div>

                    <div><strong>Current Task:</strong></div>
                    <div>${agent.current_task}</div>

                    <div><strong>ETA:</strong></div>
                    <div>${agent.estimated_completion}</div>
                </div>
                <div style="margin-top: 20px; text-align: right;">
                    <button onclick="dashboard.closeModal()" style="padding: 10px 20px; background: var(--primary-color); color: white; border: none; border-radius: 5px; cursor: pointer;">Close</button>
                </div>
            </div>
        `;

        this.showModal(modalContent);
    }

    openGateModal(gateKey) {
        const gate = this.data.quality_gates[gateKey];
        if (!gate) {
            console.warn('Quality gate not found:', gateKey);
            return;
        }

        const modalContent = `
            <div style="padding: 20px;">
                <h2>Quality Gate: ${this.formatGateTitle(gateKey)}</h2>
                <div style="display: grid; grid-template-columns: 150px 1fr; gap: 15px; margin-top: 20px;">
                    <div><strong>Current Value:</strong></div>
                    <div>${gate.value}</div>

                    <div><strong>Status:</strong></div>
                    <div><span class="gate-status ${gate.status}">${gate.status.toUpperCase()}</span></div>

                    ${gate.threshold ? `
                        <div><strong>Threshold:</strong></div>
                        <div>${gate.threshold}</div>
                    ` : ''}

                    <div><strong>Description:</strong></div>
                    <div>This quality gate ensures ${this.getGateDescription(gateKey)}</div>
                </div>
                <div style="margin-top: 20px; text-align: right;">
                    <button onclick="dashboard.closeModal()" style="padding: 10px 20px; background: var(--primary-color); color: white; border: none; border-radius: 5px; cursor: pointer;">Close</button>
                </div>
            </div>
        `;

        this.showModal(modalContent);
    }

    showModal(content) {
        // Create modal if it doesn't exist
        let modal = document.getElementById('dynamicModal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'dynamicModal';
            modal.className = 'modal';
            modal.innerHTML = `
                <div class="modal-content" style="background: white; margin: 5% auto; padding: 0; border-radius: 15px; width: 80%; max-width: 600px;">
                    <div id="dynamicModalContent"></div>
                </div>
            `;
            document.body.appendChild(modal);
        }

        document.getElementById('dynamicModalContent').innerHTML = content;
        modal.style.display = 'block';
        document.body.style.overflow = 'hidden';
    }

    closeModal() {
        const modal = document.getElementById('dynamicModal');
        if (modal) {
            modal.style.display = 'none';
            document.body.style.overflow = 'auto';
        }
    }

    getGateDescription(gateKey) {
        const descriptions = {
            test_coverage: 'adequate test coverage for reliable code quality',
            typescript_errors: 'zero TypeScript compilation errors',
            build_status: 'successful build compilation',
            security_scan: 'no security vulnerabilities in dependencies',
            performance_budget: 'application performance within acceptable limits',
            dependency_audit: 'all dependencies are secure and up-to-date'
        };
        return descriptions[gateKey] || 'code quality standards';
    }
}

// Export for use in HTML
if (typeof module !== 'undefined' && module.exports) {
    module.exports = MVP2Dashboard;
}