/**
 * MVP2 Cross-Repository Progress Dashboard API
 * Handles real-time data loading, filtering, and coordination
 * Built upon TaskMaster dashboard architecture
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
            mobileRepoPath: '/home/adarsh/dev/wildlifeai/wildlife-watcher-mobile-app',
            backendRepoPath: '/home/adarsh/dev/wildlifeai/wildlife-watcher-backend',
            apiEndpoint: 'http://localhost:3334/api'
        };
        
        this.currentView = 'overview';
        this.filters = {
            repository: 'all',
            stream: 'all',
            status: 'all'
        };
        
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
        
        this.setupPeriodicRefresh();
    }
    
    async initialize() {
        this.updateConnectionStatus('Initializing MVP2 Dashboard...', false);
        
        try {
            await this.loadData();
            this.renderOverview();
            this.updateConnectionStatus('Connected to MVP2 Dashboard', true);
            this.updateLastUpdate();
        } catch (error) {
            console.error('Dashboard initialization error:', error);
            this.updateConnectionStatus('Connection Failed', false);
        }
    }
    
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
            // In a real implementation, this would make HTTP requests to the mobile app API
            // For now, we'll simulate with the current project state
            
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
            // Use fallback data
            this.data.mobile.status = 'disconnected';
        }
    }
    
    async loadBackendData() {
        try {
            // Simulate backend data loading
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
        // Load metrics from MVP2-METRICS-TRACKER.md equivalent
        this.data.metrics = {
            total_tasks: 23,
            completed_tasks: 10,
            completion_rate: 43.5,
            days_elapsed: this.calculateDaysElapsed(),
            estimated_days_remaining: 20,
            current_velocity: 2.5, // tasks per day
            total_estimated_hours: 88,
            hours_completed: 35,
            hours_remaining: 53,
            average_task_variance: -12.5, // negative means ahead of schedule
            quality_score: 92
        };
    }
    
    generateTaskData() {
        const allTasks = [];
        
        // Generate tasks for each stream
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
        // Foundation tasks are mostly active
        if (stream.id === 'foundation') {
            return taskId === '11.4' ? 'active' : 'pending';
        }
        
        // All other tasks are pending
        return 'pending';
    }
    
    getTaskProgress(taskId, stream) {
        if (stream.id === 'foundation') {
            return taskId === '11.4' ? 25 : 0;
        }
        return 0;
    }
    
    calculateOverallProgress() {
        // Based on current state: 10 completed out of 23 total
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
    
    renderOverview() {
        this.renderMetrics();
        this.renderRepoStatus();
        this.renderStreams();
        this.renderEASPipeline();
        this.renderAgents();
        this.renderQualityGates();
    }
    
    renderMetrics() {
        const metricsGrid = document.getElementById('metricsGrid');
        const metrics = this.data.metrics;
        
        metricsGrid.innerHTML = `
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
        
        // Show the metrics grid
        metricsGrid.style.display = 'grid';
    }
    
    renderRepoStatus() {
        const repoGrid = document.getElementById('repoStatusGrid');
        
        repoGrid.innerHTML = `
            <div class="repo-card">
                <div class="repo-header">
                    <div class="repo-title">📱 Mobile App Repository</div>
                    <div class="repo-status-badge ${this.data.mobile.status}">${this.data.mobile.status.toUpperCase()}</div>
                </div>
                <div class="repo-progress">
                    <div class="progress-text">Development Progress</div>
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: ${this.data.mobile.progress}%"></div>
                    </div>
                    <div style="font-size: 0.85em; margin-top: 5px; color: #666;">${this.data.mobile.progress}% Complete</div>
                </div>
                <div style="font-size: 0.9em; color: #666;">
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
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: ${this.data.backend.progress}%"></div>
                    </div>
                    <div style="font-size: 0.85em; margin-top: 5px; color: #666;">${this.data.backend.progress}% Ready</div>
                </div>
                <div style="font-size: 0.9em; color: #666;">
                    <div><strong>Status:</strong> ${this.data.backend.deployment_status || 'Production Ready'}</div>
                    <div><strong>Environment:</strong> ${this.data.backend.environment || 'Development Live'}</div>
                    <div><strong>Health:</strong> ${this.data.backend.health_check || 'Passing'}</div>
                </div>
            </div>
        `;
        
        repoGrid.style.display = 'grid';
    }
    
    renderStreams() {
        const streamsGrid = document.getElementById('streamsGrid');
        const container = document.getElementById('streamsContainer');
        
        let html = '';
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
                        <div class="progress-bar">
                            <div class="progress-fill" style="width: ${stream.progress}%"></div>
                        </div>
                        <div style="font-size: 0.85em; margin-top: 5px; color: #666;">
                            ${stream.progress}% • ${stream.estimated_hours}h estimated • EAS Build #${stream.eas_build}
                        </div>
                    </div>
                </div>
            `;
        });
        
        streamsGrid.innerHTML = html;
        container.style.display = 'block';
    }
    
    renderEASPipeline() {
        const easGrid = document.getElementById('easBuildsGrid');
        const container = document.getElementById('easPipeline');
        
        let html = '';
        this.easBuilds.forEach(build => {
            const statusClass = build.id === 1 ? 'pending' : 'pending';
            
            html += `
                <div class="eas-build-card ${statusClass}" onclick="dashboard.openBuildModal(${build.id})">
                    <div class="build-number">Build #${build.id}</div>
                    <div class="build-purpose">${build.purpose}</div>
                    <div class="build-status ${statusClass}">${build.status.toUpperCase()}</div>
                    ${build.device_testing ? '<div style="font-size: 0.8em; margin-top: 5px; color: #666;">📱 Device Testing Required</div>' : ''}
                </div>
            `;
        });
        
        easGrid.innerHTML = html;
        container.style.display = 'block';
    }
    
    renderAgents() {
        const agentsGrid = document.getElementById('agentsGrid');
        const container = document.getElementById('agentsContainer');
        
        let html = '';
        this.data.agents.forEach(agent => {
            html += `
                <div class="agent-card ${agent.status}" onclick="dashboard.openAgentModal('${agent.id}')">
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
                </div>
            `;
        });
        
        agentsGrid.innerHTML = html;
        container.style.display = 'block';
    }
    
    renderQualityGates() {
        const gatesGrid = document.getElementById('gatesGrid');
        const container = document.getElementById('qualityGates');
        
        let html = '';
        Object.entries(this.data.quality_gates).forEach(([key, gate]) => {
            html += `
                <div class="gate-card ${gate.status}" onclick="dashboard.openGateModal('${key}')">
                    <div class="gate-title">${this.formatGateTitle(key)}</div>
                    <div class="gate-value">${gate.value}</div>
                    ${gate.threshold ? `<div style="font-size: 0.8em; color: #666;">Threshold: ${gate.threshold}</div>` : ''}
                </div>
            `;
        });
        
        gatesGrid.innerHTML = html;
        container.style.display = 'block';
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
    
    switchView() {
        const viewMode = document.getElementById('viewMode').value;
        this.currentView = viewMode;
        
        // Hide all sections
        const sections = [
            'repoStatusGrid', 'streamsContainer', 'agentsContainer', 'qualityGates'
        ];
        sections.forEach(id => {
            document.getElementById(id).style.display = 'none';
        });
        
        // Show relevant sections based on view
        switch (viewMode) {
            case 'overview':
                this.renderOverview();
                break;
            case 'streams':
                this.renderStreams();
                break;
            case 'agents':
                this.renderAgents();
                break;
            case 'metrics':
                this.renderMetrics();
                this.renderQualityGates();
                break;
        }
    }
    
    applyFilters() {
        this.filters.repository = document.getElementById('repoFilter').value;
        this.filters.stream = document.getElementById('streamFilter').value;
        
        // Re-render with filters applied
        this.renderOverview();
    }
    
    refreshData() {
        const refreshBtn = document.getElementById('refreshBtn');
        refreshBtn.textContent = '⟳ Refreshing...';
        refreshBtn.disabled = true;
        
        setTimeout(async () => {
            await this.loadData();
            this.renderOverview();
            this.updateLastUpdate();
            
            refreshBtn.textContent = '🔄 Refresh';
            refreshBtn.disabled = false;
        }, 1000);
    }
    
    setupPeriodicRefresh() {
        setInterval(async () => {
            if (this.isConnected) {
                await this.loadData();
                this.updateLastUpdate();
            }
        }, this.config.refreshInterval);
    }
    
    updateConnectionStatus(message, connected) {
        const indicator = document.getElementById('statusIndicator');
        const status = document.getElementById('connectionStatus');
        
        indicator.className = `status-indicator ${connected ? 'connected' : ''}`;
        status.textContent = message;
    }
    
    updateLastUpdate() {
        const now = new Date();
        document.getElementById('lastUpdate').textContent = 
            `Last updated: ${now.toLocaleTimeString()}`;
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
    
    // Modal functions
    openTaskModal(taskId) {
        const task = this.data.mobile.tasks.find(t => t.id === taskId);
        const modal = document.getElementById('taskModal');
        const title = document.getElementById('modalTaskTitle');
        const body = document.getElementById('modalBody');
        
        if (!task) {
            console.warn('Task not found:', taskId);
            return;
        }
        
        title.textContent = `Task ${taskId}: ${task.title}`;
        body.innerHTML = `
            <div class="modal-section">
                <label><strong>Status:</strong></label>
                <span class="task-status-icon ${task.status}">${this.getStatusIcon(task.status)} ${task.status.toUpperCase()}</span>
            </div>
            <div class="modal-section">
                <label><strong>Stream:</strong></label>
                <span>${this.streams[task.stream].title}</span>
            </div>
            <div class="modal-section">
                <label><strong>Agent:</strong></label>
                <span>${this.agentDefinitions[task.agent].name}</span>
            </div>
            <div class="modal-section">
                <label><strong>Progress:</strong></label>
                <span>${task.progress}%</span>
            </div>
            <div class="modal-section">
                <label><strong>Estimated:</strong></label>
                <span>${task.estimated_hours} hours</span>
            </div>
        `;
        
        modal.style.display = 'block';
        document.body.style.overflow = 'hidden';
    }
    
    openBuildModal(buildId) {
        const build = this.easBuilds.find(b => b.id === buildId);
        const modal = document.getElementById('taskModal');
        const title = document.getElementById('modalTaskTitle');
        const body = document.getElementById('modalBody');
        
        title.textContent = `EAS Build #${buildId}: ${build.name}`;
        body.innerHTML = `
            <div class="modal-section">
                <label><strong>Purpose:</strong></label>
                <span>${build.purpose}</span>
            </div>
            <div class="modal-section">
                <label><strong>Status:</strong></label>
                <span class="build-status ${build.status}">${build.status.toUpperCase()}</span>
            </div>
            <div class="modal-section">
                <label><strong>Stream:</strong></label>
                <span>${this.streams[build.stream].title}</span>
            </div>
            <div class="modal-section">
                <label><strong>Device Testing:</strong></label>
                <span>${build.device_testing ? 'Required' : 'Not Required'}</span>
            </div>
            <div class="modal-section">
                <label><strong>Build Date:</strong></label>
                <span>${build.build_date || 'Not yet built'}</span>
            </div>
        `;
        
        modal.style.display = 'block';
        document.body.style.overflow = 'hidden';
    }
    
    openAgentModal(agentId) {
        const agent = this.data.agents.find(a => a.id === agentId);
        const modal = document.getElementById('taskModal');
        const title = document.getElementById('modalTaskTitle');
        const body = document.getElementById('modalBody');
        
        title.textContent = agent.name;
        body.innerHTML = `
            <div class="modal-section">
                <label><strong>Description:</strong></label>
                <span>${agent.description}</span>
            </div>
            <div class="modal-section">
                <label><strong>Status:</strong></label>
                <span class="agent-status ${agent.status}">${agent.status.toUpperCase()}</span>
            </div>
            <div class="modal-section">
                <label><strong>Current Task:</strong></label>
                <span>${agent.current_task}</span>
            </div>
            <div class="modal-section">
                <label><strong>ETA:</strong></label>
                <span>${agent.estimated_completion}</span>
            </div>
        `;
        
        modal.style.display = 'block';
        document.body.style.overflow = 'hidden';
    }
    
    openGateModal(gateKey) {
        const gate = this.data.quality_gates[gateKey];
        const modal = document.getElementById('taskModal');
        const title = document.getElementById('modalTaskTitle');
        const body = document.getElementById('modalBody');
        
        title.textContent = `Quality Gate: ${this.formatGateTitle(gateKey)}`;
        body.innerHTML = `
            <div class="modal-section">
                <label><strong>Current Value:</strong></label>
                <span>${gate.value}</span>
            </div>
            <div class="modal-section">
                <label><strong>Status:</strong></label>
                <span class="gate-status ${gate.status}">${gate.status.toUpperCase()}</span>
            </div>
            ${gate.threshold ? `
                <div class="modal-section">
                    <label><strong>Threshold:</strong></label>
                    <span>${gate.threshold}</span>
                </div>
            ` : ''}
            <div class="modal-section">
                <label><strong>Description:</strong></label>
                <span>This quality gate ensures ${this.getGateDescription(gateKey)}</span>
            </div>
        `;
        
        modal.style.display = 'block';
        document.body.style.overflow = 'hidden';
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
    
    openSettingsModal() {
        const modal = document.getElementById('taskModal');
        const title = document.getElementById('modalTaskTitle');
        const body = document.getElementById('modalBody');
        
        title.textContent = 'Dashboard Settings';
        body.innerHTML = `
            <div class="modal-section">
                <label><strong>Refresh Interval:</strong></label>
                <select onchange="dashboard.updateRefreshInterval(this.value)">
                    <option value="5000" ${this.config.refreshInterval === 5000 ? 'selected' : ''}>5 seconds</option>
                    <option value="10000" ${this.config.refreshInterval === 10000 ? 'selected' : ''}>10 seconds</option>
                    <option value="30000" ${this.config.refreshInterval === 30000 ? 'selected' : ''}>30 seconds</option>
                    <option value="60000" ${this.config.refreshInterval === 60000 ? 'selected' : ''}>1 minute</option>
                </select>
            </div>
            <div class="modal-section">
                <label><strong>API Endpoint:</strong></label>
                <input type="text" value="${this.config.apiEndpoint}" onchange="dashboard.updateApiEndpoint(this.value)">
            </div>
            <div class="modal-section">
                <label><strong>Mobile Repo Path:</strong></label>
                <input type="text" value="${this.config.mobileRepoPath}" onchange="dashboard.updateMobileRepoPath(this.value)">
            </div>
            <div class="modal-section">
                <label><strong>Backend Repo Path:</strong></label>
                <input type="text" value="${this.config.backendRepoPath}" onchange="dashboard.updateBackendRepoPath(this.value)">
            </div>
        `;
        
        modal.style.display = 'block';
        document.body.style.overflow = 'hidden';
    }
    
    closeModal() {
        document.getElementById('taskModal').style.display = 'none';
        document.body.style.overflow = 'auto';
    }
    
    // Settings update functions
    updateRefreshInterval(value) {
        this.config.refreshInterval = parseInt(value);
        this.setupPeriodicRefresh();
    }
    
    updateApiEndpoint(value) {
        this.config.apiEndpoint = value;
    }
    
    updateMobileRepoPath(value) {
        this.config.mobileRepoPath = value;
    }
    
    updateBackendRepoPath(value) {
        this.config.backendRepoPath = value;
    }
}

// Export for use in HTML
if (typeof module !== 'undefined' && module.exports) {
    module.exports = MVP2Dashboard;
}