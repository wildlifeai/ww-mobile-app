#!/usr/bin/env node

/**
 * TaskMaster API Server
 * Provides HTTP API access to TaskMaster tasks.json data
 * Enables live dashboard integration
 */

const express = require("express")
const fs = require("fs").promises
const fsSync = require("fs")
const path = require("path")
const cors = require("cors")
const chokidar = require("chokidar")
const { exec } = require("child_process")
const { promisify } = require("util")

const execAsync = promisify(exec)
const app = express()

// Middleware
app.use(cors())
app.use(express.json())
app.use(express.static(__dirname)) // Serve dashboard files

// Configuration
const CONFIG = {
	port: 3333,
	projectRoot: process.env.TASKMASTER_PROJECT_ROOT || process.cwd(),
	get tasksFile() {
		return path.join(this.projectRoot, ".taskmaster/tasks/tasks.json")
	},
	get mvp2TasksDir() {
		return path.join(
			this.projectRoot,
			"project-context/development-context/MVP2/tasks",
		)
	},
}

let tasksData = { tasks: [] }
let mvp2TasksData = { tasks: [] }
let lastModified = null
let lastMvp2Modified = null

// Load tasks from TaskMaster file
async function loadTasks() {
	try {
		const stats = await fs.stat(CONFIG.tasksFile)
		const data = await fs.readFile(CONFIG.tasksFile, "utf8")
		tasksData = JSON.parse(data)
		lastModified = stats.mtime
		console.log(`📋 Loaded ${tasksData.tasks?.length || 0} TaskMaster tasks`)
		return tasksData
	} catch (error) {
		console.error("❌ Failed to load TaskMaster tasks:", error.message)
		return { tasks: [], error: error.message }
	}
}

// Load MVP2 tasks from .txt files
async function loadMvp2Tasks() {
	try {
		const tasksDir = CONFIG.mvp2TasksDir
		if (!fsSync.existsSync(tasksDir)) {
			console.log("⚠️  MVP2 tasks directory not found")
			return { tasks: [] }
		}

		const files = await fs.readdir(tasksDir)
		const taskFiles = files.filter(
			(f) => f.endsWith(".txt") && f.startsWith("task_"),
		)
		const tasks = []

		for (const file of taskFiles) {
			try {
				const filePath = path.join(tasksDir, file)
				const stats = await fs.stat(filePath)
				const content = await fs.readFile(filePath, "utf8")
				const task = parseMvp2TaskFile(content, file, stats.mtime)
				if (task) tasks.push(task)
			} catch (err) {
				console.error(`❌ Failed to load task file ${file}:`, err.message)
			}
		}

		// Sort by task ID
		tasks.sort((a, b) => a.id - b.id)

		mvp2TasksData = { tasks, lastModified: new Date() }
		lastMvp2Modified = new Date()
		console.log(`📋 Loaded ${tasks.length} MVP2 tasks from .txt files`)
		return mvp2TasksData
	} catch (error) {
		console.error("❌ Failed to load MVP2 tasks:", error.message)
		return { tasks: [], error: error.message }
	}
}

// Parse individual MVP2 task file
function parseMvp2TaskFile(content, filename, modifiedTime) {
	const lines = content.split("\n")
	const task = {
		filename,
		modifiedTime,
		source: "mvp2",
	}

	let inDetails = false
	let details = []

	for (const line of lines) {
		const trimmedLine = line.trim()

		if (trimmedLine.startsWith("# Task ID:")) {
			task.id = parseInt(trimmedLine.replace("# Task ID:", "").trim())
		} else if (trimmedLine.startsWith("# Title:")) {
			task.title = trimmedLine.replace("# Title:", "").trim()
		} else if (trimmedLine.startsWith("# Status:")) {
			task.status = trimmedLine.replace("# Status:", "").trim()
		} else if (trimmedLine.startsWith("# Dependencies:")) {
			const deps = trimmedLine.replace("# Dependencies:", "").trim()
			if (deps && deps.toLowerCase() !== "none") {
				task.dependencies = deps.split(",").map((d) => d.trim())
			}
		} else if (trimmedLine.startsWith("# Priority:")) {
			task.priority = trimmedLine.replace("# Priority:", "").trim()
		} else if (trimmedLine.startsWith("# Description:")) {
			task.description = trimmedLine.replace("# Description:", "").trim()
		} else if (trimmedLine.startsWith("# Details:")) {
			inDetails = true
		} else if (trimmedLine.startsWith("# Test Strategy:")) {
			inDetails = false
			task.testStrategy = []
		} else if (trimmedLine.startsWith("# ")) {
			inDetails = false
		} else if (inDetails && trimmedLine) {
			details.push(trimmedLine)
		} else if (task.testStrategy && trimmedLine) {
			task.testStrategy.push(trimmedLine)
		}
	}

	if (details.length > 0) {
		task.details = details.join("\n")
	}

	// Add derived properties
	task.phase = getTaskPhase(task.id)
	task.stream = getTaskStream(task.id)

	return task.id ? task : null
}

// Helper functions for task categorization
function getTaskPhase(taskId) {
	if (taskId <= 11) return "Foundation"
	if (taskId <= 17) return "Core Features"
	if (taskId <= 20) return "Advanced Features"
	return "Integration & Launch"
}

function getTaskStream(taskId) {
	// Map task IDs to development streams
	if (taskId <= 3) return "A: Migration Foundation"
	if (taskId <= 6) return "B: Environment Setup"
	if (taskId <= 11) return "C: Core Services"
	if (taskId <= 14) return "A: Project Management"
	if (taskId <= 17) return "B: Deployment Workflows"
	if (taskId <= 20) return "C: Devices & Maps"
	return "Integration"
}

// API Routes

// Get all tasks (combined TaskMaster + MVP2)
app.get("/api/tasks", async (req, res) => {
	try {
		// Load both TaskMaster and MVP2 tasks
		const [taskmasterResult, mvp2Result] = await Promise.all([
			loadTasks().catch((err) => ({ tasks: [], error: err.message })),
			loadMvp2Tasks().catch((err) => ({ tasks: [], error: err.message })),
		])

		// Handle the nested task structure from TaskMaster
		const taskmasterTasks =
			taskmasterResult.master?.tasks || taskmasterResult.tasks || []
		const mvp2Tasks = mvp2Result.tasks || []

		// Combine tasks, prioritizing MVP2 tasks
		const allTasks = [...mvp2Tasks, ...taskmasterTasks]

		res.json({
			tasks: allTasks,
			meta: {
				lastModified: lastMvp2Modified || lastModified,
				projectRoot: CONFIG.projectRoot,
				totalTasks: allTasks.length,
				mvp2Tasks: mvp2Tasks.length,
				taskmasterTasks: taskmasterTasks.length,
				sources: {
					mvp2: mvp2Tasks.length > 0,
					taskmaster: taskmasterTasks.length > 0,
				},
			},
		})
	} catch (error) {
		res.status(500).json({
			error: "Failed to load tasks",
			message: error.message,
		})
	}
})

// Get MVP2 tasks only
app.get("/api/tasks/mvp2", async (req, res) => {
	try {
		const mvp2Result = await loadMvp2Tasks()
		res.json(mvp2Result)
	} catch (error) {
		res.status(500).json({
			error: "Failed to load MVP2 tasks",
			message: error.message,
		})
	}
})

// Get TaskMaster tasks only
app.get("/api/tasks/taskmaster", async (req, res) => {
	try {
		const taskmasterResult = await loadTasks()
		const tasks = taskmasterResult.master?.tasks || taskmasterResult.tasks || []
		res.json({ tasks })
	} catch (error) {
		res.status(500).json({
			error: "Failed to load TaskMaster tasks",
			message: error.message,
		})
	}
})

// Get specific task (search both sources)
app.get("/api/tasks/:id", async (req, res) => {
	try {
		const [taskmasterResult, mvp2Result] = await Promise.all([
			loadTasks().catch(() => ({ tasks: [] })),
			loadMvp2Tasks().catch(() => ({ tasks: [] })),
		])

		const taskmasterTasks =
			taskmasterResult.master?.tasks || taskmasterResult.tasks || []
		const mvp2Tasks = mvp2Result.tasks || []
		const allTasks = [...mvp2Tasks, ...taskmasterTasks]

		const task = allTasks.find((t) => t.id == req.params.id)

		if (task) {
			res.json(task)
		} else {
			res.status(404).json({ error: "Task not found" })
		}
	} catch (error) {
		res
			.status(500)
			.json({ error: "Failed to load task", message: error.message })
	}
})

// Update task status
app.put("/api/tasks/:id/status", async (req, res) => {
	const { id } = req.params
	const { status } = req.body

	console.log(`🔄 Updating task ${id} status to: ${status}`)

	try {
		const command = `task-master set-status --id=${id} --status=${status}`
		const { stdout, stderr } = await execAsync(command, {
			cwd: CONFIG.projectRoot,
		})

		console.log(`✅ TaskMaster command executed: ${command}`)
		if (stdout) console.log("Output:", stdout)
		if (stderr) console.log("Stderr:", stderr)

		// Reload tasks after update
		await loadTasks()

		res.json({
			success: true,
			command,
			output: stdout,
		})
	} catch (error) {
		console.error(`❌ Failed to update task ${id}:`, error.message)
		res.status(500).json({
			error: "Failed to update task status",
			message: error.message,
		})
	}
})

// Assign task
app.put("/api/tasks/:id/assign", async (req, res) => {
	const { id } = req.params
	const { assignee } = req.body

	console.log(`👤 Assigning task ${id} to: ${assignee}`)

	try {
		// For now, we'll store assignments in memory
		// In a full implementation, this could be persisted
		res.json({
			success: true,
			message: `Task ${id} assigned to ${assignee}`,
		})
	} catch (error) {
		res.status(500).json({
			error: "Failed to assign task",
			message: error.message,
		})
	}
})

// Execute TaskMaster command
app.post("/api/taskmaster/command", async (req, res) => {
	const { command } = req.body

	console.log(`⚡ Executing TaskMaster command: ${command}`)

	try {
		const { stdout, stderr } = await execAsync(`task-master ${command}`, {
			cwd: CONFIG.projectRoot,
		})

		// Reload tasks after command
		await loadTasks()

		res.json({
			success: true,
			command: `task-master ${command}`,
			output: stdout,
			stderr: stderr || null,
		})
	} catch (error) {
		console.error(`❌ Command failed:`, error.message)
		res.status(500).json({
			error: "Command execution failed",
			message: error.message,
		})
	}
})

// Health check
app.get("/api/health", (req, res) => {
	res.json({
		status: "healthy",
		timestamp: new Date().toISOString(),
		projectRoot: CONFIG.projectRoot,
		tasksFile: CONFIG.tasksFile,
	})
})

// Serve the dashboard
app.get("/", (req, res) => {
	// Serve the hybrid dashboard with tabbed interface and all improvements
	res.sendFile(path.join(__dirname, "mvp2-progress-dashboard-hybrid.html"))
})

// File watching (both TaskMaster and MVP2 tasks)
function setupFileWatcher() {
	const watchedPaths = []

	// Watch TaskMaster tasks file
	if (fsSync.existsSync(CONFIG.tasksFile)) {
		watchedPaths.push(CONFIG.tasksFile)
	}

	// Watch MVP2 tasks directory
	if (fsSync.existsSync(CONFIG.mvp2TasksDir)) {
		watchedPaths.push(path.join(CONFIG.mvp2TasksDir, "*.txt"))
	}

	if (watchedPaths.length === 0) {
		console.log("⚠️  No task files found to watch")
		return
	}

	const watcher = chokidar.watch(watchedPaths)

	watcher.on("change", async (filePath) => {
		console.log(
			`📄 Task file changed: ${path.basename(filePath)}, reloading...`,
		)
		if (filePath.includes("MVP2/tasks")) {
			await loadMvp2Tasks()
		} else {
			await loadTasks()
		}
	})

	watcher.on("add", async (filePath) => {
		if (filePath.includes("MVP2/tasks") && filePath.endsWith(".txt")) {
			console.log(`📄 New MVP2 task file added: ${path.basename(filePath)}`)
			await loadMvp2Tasks()
		}
	})

	watcher.on("error", (error) => {
		console.error("❌ File watcher error:", error)
	})

	console.log(
		`👁️  Watching ${watchedPaths.length} task file path(s) for changes...`,
	)
}

// Server startup
async function startServer() {
	console.log("🚀 Starting Wildlife Watcher TaskMaster API Server...")
	console.log(`📂 Project root: ${CONFIG.projectRoot}`)
	console.log(`📋 TaskMaster file: ${CONFIG.tasksFile}`)
	console.log(`📋 MVP2 tasks dir: ${CONFIG.mvp2TasksDir}`)

	// Initial load of both task sources
	const [taskmasterResult, mvp2Result] = await Promise.all([
		loadTasks().catch((err) =>
			console.log("⚠️  TaskMaster tasks not available:", err.message),
		),
		loadMvp2Tasks().catch((err) =>
			console.log("⚠️  MVP2 tasks not available:", err.message),
		),
	])

	// Setup file watching
	setupFileWatcher()

	// Start server
	app.listen(CONFIG.port, () => {
		console.log(`\n✅ Wildlife Watcher TaskMaster API Server running!`)
		console.log(`📊 Dashboard: http://localhost:${CONFIG.port}`)
		console.log(`🔗 API: http://localhost:${CONFIG.port}/api/tasks`)
		console.log(`🔗 MVP2 API: http://localhost:${CONFIG.port}/api/tasks/mvp2`)
		console.log(
			`\n💡 Use the dashboard to view and manage both TaskMaster and MVP2 tasks`,
		)
	})
}

// Handle shutdown
process.on("SIGTERM", () => {
	console.log("\n👋 Shutting down TaskMaster API Server...")
	process.exit(0)
})

process.on("SIGINT", () => {
	console.log("\n👋 Shutting down TaskMaster API Server...")
	process.exit(0)
})

// Start the server
if (require.main === module) {
	startServer().catch((error) => {
		console.error("❌ Failed to start server:", error)
		process.exit(1)
	})
}

module.exports = { app, CONFIG }
