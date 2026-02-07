#!/usr/bin/env node

/**
 * Dependency Rules CLI - Quick commands for common operations
 *
 * Usage:
 *   npm run deps add [package]     - Add rule for specific package
 *   npm run deps scan              - Scan for unmanaged packages
 *   npm run deps list              - List all rules
 *   npm run deps manage            - Full interactive manager
 */

const { execSync } = require("child_process")
const path = require("path")

const command = process.argv[2]
const packageName = process.argv[3]

switch (command) {
	case "add":
		if (packageName) {
			addRuleForPackage(packageName)
		} else {
			runInteractiveManager("add")
		}
		break

	case "scan":
		runInteractiveManager("scan")
		break

	case "list":
		listRules()
		break

	case "manage":
		runInteractiveManager()
		break

	default:
		showHelp()
}

function addRuleForPackage(pkgName) {
	// For specific package, pre-populate the manager
	console.log(`🎯 Adding rule for ${pkgName}...`)

	// This would require extending the manager to accept package names
	// For now, fallback to interactive mode
	runInteractiveManager("add")
}

function runInteractiveManager(action = null) {
	const managerScript = path.join(__dirname, "manage-dependency-rules.js")

	try {
		if (action) {
			// Future enhancement: pass action to manager
			execSync(`node ${managerScript}`, { stdio: "inherit" })
		} else {
			execSync(`node ${managerScript}`, { stdio: "inherit" })
		}
	} catch (error) {
		console.error("❌ Failed to run dependency manager:", error.message)
		process.exit(1)
	}
}

function listRules() {
	const fs = require("fs")
	const configPath = path.join(__dirname, "dependency-rules.json")

	if (!fs.existsSync(configPath)) {
		console.log("❌ No dependency rules found")
		return
	}

	const config = JSON.parse(fs.readFileSync(configPath, "utf8"))
	const rules = config.rules || {}
	const packages = Object.keys(rules)

	if (packages.length === 0) {
		console.log("❌ No rules configured")
		return
	}

	console.log("📋 Current dependency rules:\\n")

	packages.forEach((pkg) => {
		const rule = rules[pkg]
		const severity = rule.severity || "warning"
		const severityIcon =
			severity === "error" ? "❌" : severity === "warning" ? "⚠️" : "ℹ️"

		console.log(`${severityIcon} ${pkg}`)
		console.log(`   Required: ${rule.required}`)
		console.log(`   Severity: ${severity}`)

		if (rule.reason) console.log(`   Reason: ${rule.reason}`)
		if (rule.optional) console.log(`   Optional: yes`)
		if (rule.installed) console.log(`   Known deviation: ${rule.installed}`)

		console.log("")
	})
}

function showHelp() {
	console.log("🔧 Dependency Rules CLI\\n")
	console.log("Usage:")
	console.log("  npm run deps add [package]  - Add rule for package")
	console.log("  npm run deps scan           - Scan for unmanaged packages")
	console.log("  npm run deps list           - List all current rules")
	console.log("  npm run deps manage         - Full interactive manager\\n")
	console.log("Examples:")
	console.log("  npm run deps add axios")
	console.log("  npm run deps scan")
	console.log("  npm run deps list")
}
