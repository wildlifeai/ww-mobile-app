/**
 * Change Detection Service for TaskMaster AI Dashboard
 * Intelligent monitoring system for MVP2 project files
 * Provides refresh indicators when data changes
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { EventEmitter } = require('events');

class ChangeDetectionService extends EventEmitter {
    constructor(options = {}) {
        super();

        // Configuration
        this.config = {
            baseDir: options.baseDir || '/home/adarsh/dev/wildlifeai/wildlife-watcher-mobile-app/project-context',
            checkInterval: options.checkInterval || 5000, // 5 seconds
            retentionTime: options.retentionTime || 24 * 60 * 60 * 1000, // 24 hours
            maxChangeHistory: options.maxChangeHistory || 1000,
            ...options
        };

        // Monitoring state
        this.isMonitoring = false;
        this.monitoringInterval = null;
        this.lastCheck = null;
        this.changeHistory = [];

        // File tracking maps
        this.fileStates = new Map(); // filepath -> { mtime, hash, size }
        this.taskStates = new Map();  // taskId -> status
        this.contentHashes = new Map(); // filepath -> hash

        // Key files to monitor
        this.monitoredFiles = [
            // Master execution plan
            'MVP2-Tasks/MVP2-MASTER-EXECUTION-PLAN.md',
            // Task specifications
            'development-context/MVP2/tasks/task_011.txt',
            'development-context/MVP2/tasks/task_012.txt',
            'development-context/MVP2/tasks/task_013.txt',
            'development-context/MVP2/tasks/task_014.txt',
            'development-context/MVP2/tasks/task_015.txt',
            'development-context/MVP2/tasks/task_016.txt',
            'development-context/MVP2/tasks/task_017.txt',
            'development-context/MVP2/tasks/task_018.txt',
            'development-context/MVP2/tasks/task_019.txt',
            'development-context/MVP2/tasks/task_020.txt',
            'development-context/MVP2/tasks/task_021.txt',
            'development-context/MVP2/tasks/task_022.txt',
            'development-context/MVP2/tasks/task_023.txt',
            // Metrics and progress
            'MVP2-Tasks/MVP2-METRICS-TRACKER.md',
            'superclaude-task-management.md',
            // Context preservation
            'task-context-preservation.json'
        ];

        // Change detection state
        this.currentState = {
            hasChanges: false,
            lastChangeTime: null,
            changeCount: 0,
            refreshRecommended: false
        };

        // Initialize
        this.init();
    }

    /**
     * Initialize the change detection service
     */
    async init() {
        try {
            console.log('🔍 Initializing Change Detection Service...');

            // Perform initial scan of all monitored files
            await this.performInitialScan();

            // Start monitoring if not already started
            if (!this.isMonitoring) {
                this.startMonitoring();
            }

            console.log(`✅ Change Detection Service initialized - monitoring ${this.fileStates.size} files`);
        } catch (error) {
            console.error('❌ Failed to initialize Change Detection Service:', error);
            throw error;
        }
    }

    /**
     * Perform initial scan of all monitored files
     */
    async performInitialScan() {
        const startTime = Date.now();
        let scannedCount = 0;

        for (const relativePath of this.monitoredFiles) {
            const fullPath = path.join(this.config.baseDir, relativePath);

            try {
                if (await this.fileExists(fullPath)) {
                    const fileState = await this.getFileState(fullPath);
                    this.fileStates.set(fullPath, fileState);

                    // Extract task states for task files
                    if (relativePath.includes('tasks/task_') && relativePath.endsWith('.txt')) {
                        await this.extractTaskState(fullPath);
                    }

                    scannedCount++;
                }
            } catch (error) {
                console.warn(`⚠️  Could not scan file ${relativePath}:`, error.message);
            }
        }

        console.log(`📊 Initial scan completed: ${scannedCount} files in ${Date.now() - startTime}ms`);
        this.lastCheck = new Date();
    }

    /**
     * Start monitoring for changes
     */
    startMonitoring() {
        if (this.isMonitoring) {
            console.log('🔍 Change monitoring already active');
            return;
        }

        console.log(`🚀 Starting change monitoring (interval: ${this.config.checkInterval}ms)`);
        this.isMonitoring = true;

        this.monitoringInterval = setInterval(() => {
            this.checkForChanges().catch(error => {
                console.error('❌ Error during change check:', error);
            });
        }, this.config.checkInterval);

        // Clean up old change history periodically
        setInterval(() => {
            this.cleanupHistory();
        }, 60000); // Every minute
    }

    /**
     * Stop monitoring for changes
     */
    stopMonitoring() {
        if (!this.isMonitoring) {
            return;
        }

        console.log('⏹️  Stopping change monitoring');
        this.isMonitoring = false;

        if (this.monitoringInterval) {
            clearInterval(this.monitoringInterval);
            this.monitoringInterval = null;
        }
    }

    /**
     * Check for changes in monitored files
     */
    async checkForChanges() {
        const checkStart = Date.now();
        const changes = [];
        let hasNewChanges = false;

        for (const [filePath, oldState] of this.fileStates.entries()) {
            try {
                if (await this.fileExists(filePath)) {
                    const newState = await this.getFileState(filePath);

                    // Compare states
                    const change = await this.compareFileStates(filePath, oldState, newState);

                    if (change) {
                        changes.push(change);
                        this.fileStates.set(filePath, newState);
                        hasNewChanges = true;

                        // Extract task state changes for task files
                        if (filePath.includes('tasks/task_') && filePath.endsWith('.txt')) {
                            const taskChange = await this.detectTaskStatusChange(filePath);
                            if (taskChange) {
                                changes.push(taskChange);
                            }
                        }
                    }
                }
            } catch (error) {
                console.warn(`⚠️  Error checking file ${filePath}:`, error.message);
            }
        }

        // Update current state
        if (hasNewChanges) {
            this.currentState.hasChanges = true;
            this.currentState.lastChangeTime = new Date();
            this.currentState.changeCount += changes.length;
            this.currentState.refreshRecommended = true;

            // Add changes to history
            changes.forEach(change => {
                this.changeHistory.push({
                    ...change,
                    timestamp: new Date().toISOString()
                });
            });

            // Emit change event
            this.emit('changes-detected', {
                changes,
                totalChanges: changes.length,
                timestamp: new Date()
            });

            console.log(`🔄 Detected ${changes.length} changes in ${Date.now() - checkStart}ms`);
        }

        this.lastCheck = new Date();
    }

    /**
     * Get current file state (mtime, hash, size)
     */
    async getFileState(filePath) {
        const stats = await fs.promises.stat(filePath);
        const content = await fs.promises.readFile(filePath, 'utf8');
        const hash = this.generateHash(content);

        return {
            mtime: stats.mtime.getTime(),
            size: stats.size,
            hash: hash
        };
    }

    /**
     * Compare old and new file states
     */
    async compareFileStates(filePath, oldState, newState) {
        // Check modification time first (fastest check)
        if (oldState.mtime === newState.mtime) {
            return null; // No change
        }

        // Check if it's a real content change
        if (oldState.hash === newState.hash) {
            // File was touched but content unchanged
            return null;
        }

        // Determine change type
        const changeType = this.classifyChange(filePath, oldState, newState);
        const relativePath = path.relative(this.config.baseDir, filePath);

        return {
            type: changeType,
            file: relativePath,
            change: `Content modified (${oldState.size} -> ${newState.size} bytes)`,
            previousHash: oldState.hash,
            newHash: newState.hash,
            sizeChange: newState.size - oldState.size
        };
    }

    /**
     * Classify the type of change
     */
    classifyChange(filePath, oldState, newState) {
        const fileName = path.basename(filePath);

        if (fileName.includes('task_') && fileName.endsWith('.txt')) {
            return 'task_spec';
        } else if (fileName.includes('METRICS-TRACKER')) {
            return 'metrics';
        } else if (fileName.includes('EXECUTION-PLAN')) {
            return 'execution_plan';
        } else if (fileName.includes('task-management')) {
            return 'progress';
        } else if (fileName.endsWith('.json')) {
            return 'config';
        } else {
            return 'file_structure';
        }
    }

    /**
     * Extract task state from task file content
     */
    async extractTaskState(filePath) {
        try {
            const content = await fs.promises.readFile(filePath, 'utf8');
            const fileName = path.basename(filePath);
            const taskId = fileName.replace('task_', '').replace('.txt', '');

            // Simple status extraction (could be enhanced with more sophisticated parsing)
            let status = 'pending';
            if (content.includes('Status: completed') || content.includes('COMPLETED')) {
                status = 'completed';
            } else if (content.includes('Status: in_progress') || content.includes('IN_PROGRESS')) {
                status = 'in_progress';
            } else if (content.includes('Status: active') || content.includes('ACTIVE')) {
                status = 'active';
            }

            this.taskStates.set(taskId, status);
        } catch (error) {
            console.warn(`⚠️  Could not extract task state from ${filePath}:`, error.message);
        }
    }

    /**
     * Detect task status changes
     */
    async detectTaskStatusChange(filePath) {
        const fileName = path.basename(filePath);
        const taskId = fileName.replace('task_', '').replace('.txt', '');

        try {
            const content = await fs.promises.readFile(filePath, 'utf8');

            let newStatus = 'pending';
            if (content.includes('Status: completed') || content.includes('COMPLETED')) {
                newStatus = 'completed';
            } else if (content.includes('Status: in_progress') || content.includes('IN_PROGRESS')) {
                newStatus = 'in_progress';
            } else if (content.includes('Status: active') || content.includes('ACTIVE')) {
                newStatus = 'active';
            }

            const oldStatus = this.taskStates.get(taskId);

            if (oldStatus && oldStatus !== newStatus) {
                this.taskStates.set(taskId, newStatus);

                return {
                    type: 'task_status',
                    file: fileName,
                    change: `${oldStatus} → ${newStatus}`,
                    taskId: taskId,
                    previousStatus: oldStatus,
                    newStatus: newStatus
                };
            }

            // Update status even if no change (for initial state)
            this.taskStates.set(taskId, newStatus);

        } catch (error) {
            console.warn(`⚠️  Could not detect status change for ${taskId}:`, error.message);
        }

        return null;
    }

    /**
     * Generate hash for content
     */
    generateHash(content) {
        return crypto.createHash('sha256').update(content, 'utf8').digest('hex').substring(0, 16);
    }

    /**
     * Check if file exists
     */
    async fileExists(filePath) {
        try {
            await fs.promises.access(filePath, fs.constants.F_OK);
            return true;
        } catch {
            return false;
        }
    }

    /**
     * Clean up old change history
     */
    cleanupHistory() {
        const cutoffTime = Date.now() - this.config.retentionTime;

        this.changeHistory = this.changeHistory
            .filter(change => new Date(change.timestamp).getTime() > cutoffTime)
            .slice(-this.config.maxChangeHistory);
    }

    /**
     * Get current change detection status
     */
    getStatus() {
        return {
            hasChanges: this.currentState.hasChanges,
            lastCheck: this.lastCheck ? this.lastCheck.toISOString() : null,
            changesSince: this.currentState.lastChangeTime ? this.currentState.lastChangeTime.toISOString() : null,
            refreshRecommended: this.currentState.refreshRecommended,
            monitoringActive: this.isMonitoring,
            filesMonitored: this.fileStates.size,
            totalChanges: this.changeHistory.length
        };
    }

    /**
     * Get summary of recent changes
     */
    getChangesSummary(since = null) {
        let changes = this.changeHistory;

        if (since) {
            const sinceTime = new Date(since).getTime();
            changes = changes.filter(change =>
                new Date(change.timestamp).getTime() > sinceTime
            );
        }

        // Group changes by type
        const changesByType = {};
        changes.forEach(change => {
            if (!changesByType[change.type]) {
                changesByType[change.type] = [];
            }
            changesByType[change.type].push(change);
        });

        return {
            totalChanges: changes.length,
            changesByType,
            recentChanges: changes.slice(-10), // Last 10 changes
            hasTaskStatusChanges: changes.some(c => c.type === 'task_status'),
            hasMetricsChanges: changes.some(c => c.type === 'metrics'),
            hasProgressChanges: changes.some(c => c.type === 'progress')
        };
    }

    /**
     * Acknowledge changes (mark as seen)
     */
    acknowledgeChanges() {
        this.currentState.hasChanges = false;
        this.currentState.refreshRecommended = false;
        this.currentState.changeCount = 0;

        console.log('✅ Changes acknowledged - refresh indicators reset');

        this.emit('changes-acknowledged', {
            timestamp: new Date(),
            acknowledgedChanges: this.changeHistory.length
        });
    }

    /**
     * Force a manual check for changes
     */
    async forceCheck() {
        console.log('🔄 Forcing manual change check...');
        await this.checkForChanges();
        return this.getStatus();
    }

    /**
     * Get detailed file states for debugging
     */
    getFileStates() {
        const states = {};
        for (const [filePath, state] of this.fileStates.entries()) {
            const relativePath = path.relative(this.config.baseDir, filePath);
            states[relativePath] = {
                ...state,
                mtimeFormatted: new Date(state.mtime).toISOString()
            };
        }
        return states;
    }

    /**
     * Add a file to monitoring
     */
    addMonitoredFile(relativePath) {
        if (!this.monitoredFiles.includes(relativePath)) {
            this.monitoredFiles.push(relativePath);

            // Immediately scan the new file
            const fullPath = path.join(this.config.baseDir, relativePath);
            this.getFileState(fullPath)
                .then(state => {
                    this.fileStates.set(fullPath, state);
                    console.log(`➕ Added file to monitoring: ${relativePath}`);
                })
                .catch(error => {
                    console.warn(`⚠️  Could not add file to monitoring: ${relativePath}`, error.message);
                });
        }
    }

    /**
     * Remove a file from monitoring
     */
    removeMonitoredFile(relativePath) {
        const index = this.monitoredFiles.indexOf(relativePath);
        if (index > -1) {
            this.monitoredFiles.splice(index, 1);
            const fullPath = path.join(this.config.baseDir, relativePath);
            this.fileStates.delete(fullPath);
            console.log(`➖ Removed file from monitoring: ${relativePath}`);
        }
    }

    /**
     * Destroy the service and clean up resources
     */
    destroy() {
        console.log('🧹 Destroying Change Detection Service...');
        this.stopMonitoring();
        this.removeAllListeners();
        this.fileStates.clear();
        this.taskStates.clear();
        this.contentHashes.clear();
        this.changeHistory = [];
    }
}

module.exports = ChangeDetectionService;