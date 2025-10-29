#!/usr/bin/env node

/**
 * Interactive Dependency Rules Management Script
 *
 * Helps users add, modify, and remove dependency validation rules
 * with an easy-to-use CLI interface.
 */

const fs = require("fs")
const path = require("path")
const readline = require("readline")

class DependencyRulesManager {
	constructor() {
		this.configPath = path.join(__dirname, "dependency-rules.json")
		this.packageJsonPath = path.join(process.cwd(), "package.json")

		// Load existing config
		if (fs.existsSync(this.configPath)) {
			this.config = JSON.parse(fs.readFileSync(this.configPath, "utf8"))
		} else {
			console.error("❌ dependency-rules.json not found")
			process.exit(1)
		}

		// Load package.json
		if (fs.existsSync(this.packageJsonPath)) {
			this.packageJson = JSON.parse(
				fs.readFileSync(this.packageJsonPath, "utf8"),
			)
		} else {
			console.error("❌ package.json not found")
			process.exit(1)
		}

		this.rl = readline.createInterface({
			input: process.stdin,
			output: process.stdout,
		})
	}

	async run() {
		console.log("🔧 Dependency Rules Manager\n")

		const action = await this.selectAction()

		switch (action) {
			case "add":
				await this.addMissingPackages()
				break
			case "modify":
				await this.modifyExistingRule()
				break
			case "remove":
				await this.removeRule()
				break
			case "scan":
				await this.scanForUnmanagedPackages()
				break
			case "view":
				this.viewCurrentRules()
				break
			default:
				console.log("👋 Goodbye!")
		}

		this.rl.close()
	}

	async selectAction() {
		console.log("What would you like to do?\n")
		console.log("1. 📦 Add new package rules")
		console.log("2. ✏️  Modify existing rule")
		console.log("3. 🗑️  Remove rule")
		console.log("4. 🔍 Scan for unmanaged packages")
		console.log("5. 👀 View current rules")
		console.log("6. 🚪 Exit\n")

		const choice = await this.question("Select an option (1-6): ")

		const actions = {
			1: "add",
			2: "modify",
			3: "remove",
			4: "scan",
			5: "view",
			6: "exit",
		}

		return actions[choice] || "exit"
	}

	async addMissingPackages() {
		const unmanaged = this.getUnmanagedPackages()

		if (unmanaged.length === 0) {
			console.log("✅ All installed packages already have rules!\n")
			return
		}

		console.log(`\n📦 Found ${unmanaged.length} packages without rules:\n`)

		unmanaged.forEach((pkg, index) => {
			const version = this.getInstalledVersion(pkg)
			console.log(`${index + 1}. ${pkg}@${version}`)
		})

		console.log("\nSelect packages to add rules for:")
		const selection = await this.question(
			'Enter numbers (e.g., 1,3,5 or "all"): ',
		)

		let packagesToAdd
		if (selection.toLowerCase() === "all") {
			packagesToAdd = unmanaged
		} else {
			const indices = selection.split(",").map((s) => parseInt(s.trim()) - 1)
			packagesToAdd = indices.map((i) => unmanaged[i]).filter(Boolean)
		}

		for (const pkg of packagesToAdd) {
			await this.addRuleForPackage(pkg)
		}

		await this.saveConfig()
		console.log("\n✅ Rules added successfully!")
	}

	async addRuleForPackage(packageName) {
		const version = this.getInstalledVersion(packageName)
		console.log(`\n📦 Adding rule for ${packageName}@${version}\n`)

		// Suggest version format
		const versionSuggestions = this.generateVersionSuggestions(version)
		console.log("Suggested version formats:")
		versionSuggestions.forEach((suggestion, index) => {
			console.log(
				`${index + 1}. ${suggestion.format} - ${suggestion.description}`,
			)
		})

		const versionChoice = await this.question(
			`Choose version format (1-${versionSuggestions.length}) or enter custom: `,
		)
		let requiredVersion

		const choiceIndex = parseInt(versionChoice) - 1
		if (choiceIndex >= 0 && choiceIndex < versionSuggestions.length) {
			requiredVersion = versionSuggestions[choiceIndex].format
		} else {
			requiredVersion = versionChoice
		}

		// Select severity
		console.log("\nSeverity levels:")
		console.log("1. error - Blocks installation (strict compliance)")
		console.log("2. warning - Shows warning but allows installation")
		console.log("3. info - Informational only")

		const severityChoice = await this.question("Choose severity (1-3): ")
		const severities = ["error", "warning", "info"]
		const severity = severities[parseInt(severityChoice) - 1] || "warning"

		// Get reason
		const reason = await this.question("Reason for this rule (optional): ")

		// Check if optional
		const isOptional = await this.question("Is this package optional? (y/N): ")
		const optional = isOptional.toLowerCase().startsWith("y")

		// Build rule
		const rule = {
			required: requiredVersion,
			severity: severity,
		}

		if (reason.trim()) {
			rule.reason = reason.trim()
		}

		if (optional) {
			rule.optional = true
		}

		// Add to config
		this.config.rules[packageName] = rule

		console.log(`✅ Rule added for ${packageName}`)
	}

	async modifyExistingRule() {
		const packages = Object.keys(this.config.rules || {})

		if (packages.length === 0) {
			console.log("❌ No rules exist to modify!\n")
			return
		}

		console.log("\n📝 Existing rules:\n")
		packages.forEach((pkg, index) => {
			const rule = this.config.rules[pkg]
			console.log(`${index + 1}. ${pkg} (${rule.required}, ${rule.severity})`)
		})

		const choice = await this.question(
			`\nSelect rule to modify (1-${packages.length}): `,
		)
		const packageIndex = parseInt(choice) - 1

		if (packageIndex < 0 || packageIndex >= packages.length) {
			console.log("❌ Invalid selection")
			return
		}

		const packageName = packages[packageIndex]
		const currentRule = this.config.rules[packageName]

		console.log(`\n✏️ Modifying rule for ${packageName}\n`)
		console.log("Current rule:", JSON.stringify(currentRule, null, 2))

		await this.modifyRuleProperties(packageName, currentRule)
		await this.saveConfig()
		console.log("\n✅ Rule modified successfully!")
	}

	async modifyRuleProperties(packageName, rule) {
		console.log("\nWhat would you like to modify?")
		console.log("1. Required version")
		console.log("2. Severity level")
		console.log("3. Reason")
		console.log("4. Optional flag")
		console.log("5. Add installed field (known deviation)")
		console.log("6. Remove property")

		const choice = await this.question("Select property (1-6): ")

		switch (choice) {
			case "1":
				const newVersion = await this.question(
					`New required version (current: ${rule.required}): `,
				)
				if (newVersion.trim()) rule.required = newVersion.trim()
				break

			case "2":
				console.log("1. error  2. warning  3. info")
				const sevChoice = await this.question("New severity (1-3): ")
				const severities = ["error", "warning", "info"]
				const newSeverity = severities[parseInt(sevChoice) - 1]
				if (newSeverity) rule.severity = newSeverity
				break

			case "3":
				const newReason = await this.question(
					`New reason (current: "${rule.reason || "none"}"): `,
				)
				if (newReason.trim()) {
					rule.reason = newReason.trim()
				} else if (rule.reason) {
					delete rule.reason
				}
				break

			case "4":
				const optionalChoice = await this.question(
					`Optional? (current: ${rule.optional || false}) (y/N): `,
				)
				rule.optional = optionalChoice.toLowerCase().startsWith("y")
				if (!rule.optional) delete rule.optional
				break

			case "5":
				const installedVersion = await this.question(
					"Installed version (for known deviations): ",
				)
				if (installedVersion.trim()) rule.installed = installedVersion.trim()
				break

			case "6":
				await this.removeRuleProperty(rule)
				break
		}

		this.config.rules[packageName] = rule
	}

	async removeRuleProperty(rule) {
		const properties = Object.keys(rule).filter((key) => key !== "required")

		if (properties.length === 0) {
			console.log("❌ No optional properties to remove")
			return
		}

		console.log("\nRemovable properties:")
		properties.forEach((prop, index) => {
			console.log(`${index + 1}. ${prop}: ${rule[prop]}`)
		})

		const choice = await this.question(
			`Select property to remove (1-${properties.length}): `,
		)
		const propIndex = parseInt(choice) - 1

		if (propIndex >= 0 && propIndex < properties.length) {
			const propToRemove = properties[propIndex]
			delete rule[propToRemove]
			console.log(`✅ Removed ${propToRemove}`)
		}
	}

	async removeRule() {
		const packages = Object.keys(this.config.rules || {})

		if (packages.length === 0) {
			console.log("❌ No rules exist to remove!\n")
			return
		}

		console.log("\n🗑️ Current rules:\n")
		packages.forEach((pkg, index) => {
			console.log(`${index + 1}. ${pkg}`)
		})

		const choice = await this.question(
			`\nSelect rule to remove (1-${packages.length}): `,
		)
		const packageIndex = parseInt(choice) - 1

		if (packageIndex < 0 || packageIndex >= packages.length) {
			console.log("❌ Invalid selection")
			return
		}

		const packageName = packages[packageIndex]
		const confirm = await this.question(
			`❗ Remove rule for ${packageName}? (y/N): `,
		)

		if (confirm.toLowerCase().startsWith("y")) {
			delete this.config.rules[packageName]
			await this.saveConfig()
			console.log(`✅ Rule for ${packageName} removed`)
		} else {
			console.log("❌ Cancelled")
		}
	}

	async scanForUnmanagedPackages() {
		const unmanaged = this.getUnmanagedPackages()

		console.log("\n🔍 Scanning for unmanaged packages...\n")

		if (unmanaged.length === 0) {
			console.log("✅ All installed packages have rules!")
			return
		}

		console.log(`Found ${unmanaged.length} packages without rules:\n`)
		unmanaged.forEach((pkg) => {
			const version = this.getInstalledVersion(pkg)
			console.log(`📦 ${pkg}@${version}`)
		})

		const addRules = await this.question(
			"\nWould you like to add rules for these packages? (y/N): ",
		)

		if (addRules.toLowerCase().startsWith("y")) {
			for (const pkg of unmanaged) {
				await this.addRuleForPackage(pkg)
			}
			await this.saveConfig()
			console.log("\n✅ Rules added successfully!")
		}
	}

	viewCurrentRules() {
		console.log("\n👀 Current dependency rules:\n")

		const rules = this.config.rules || {}
		const packages = Object.keys(rules)

		if (packages.length === 0) {
			console.log("❌ No rules configured")
			return
		}

		packages.forEach((pkg) => {
			const rule = rules[pkg]
			const installed = this.getInstalledVersion(pkg)
			const status = installed ? `✅ ${installed}` : "❌ not installed"

			console.log(`📦 ${pkg}`)
			console.log(`   Required: ${rule.required}`)
			console.log(`   Severity: ${rule.severity}`)
			console.log(`   Status: ${status}`)

			if (rule.reason) console.log(`   Reason: ${rule.reason}`)
			if (rule.optional) console.log(`   Optional: ${rule.optional}`)
			if (rule.installed) console.log(`   Known deviation: ${rule.installed}`)

			console.log("")
		})
	}

	getUnmanagedPackages() {
		const allPackages = [
			...Object.keys(this.packageJson.dependencies || {}),
			...Object.keys(this.packageJson.devDependencies || {}),
		]

		const managedPackages = Object.keys(this.config.rules || {})

		return allPackages.filter((pkg) => !managedPackages.includes(pkg))
	}

	getInstalledVersion(packageName) {
		return (
			this.packageJson.dependencies?.[packageName] ||
			this.packageJson.devDependencies?.[packageName] ||
			null
		)
	}

	generateVersionSuggestions(version) {
		const suggestions = [
			{
				format: version,
				description: "Exact version (strict)",
			},
			{
				format: `~${version.replace(/^[~^]/, "")}`,
				description: "Patch updates allowed",
			},
			{
				format: `^${version.replace(/^[~^]/, "")}`,
				description: "Minor updates allowed",
			},
		]

		// Add range suggestion for major version
		const cleanVersion = version.replace(/^[~^]/, "")
		const majorVersion = cleanVersion.split(".")[0]
		suggestions.push({
			format: `>=${cleanVersion} <${parseInt(majorVersion) + 1}.0.0`,
			description: "Range within major version",
		})

		return suggestions
	}

	async saveConfig() {
		const configString = JSON.stringify(this.config, null, 2)
		fs.writeFileSync(this.configPath, configString)
		console.log("💾 Configuration saved")
	}

	question(prompt) {
		return new Promise((resolve) => {
			this.rl.question(prompt, resolve)
		})
	}
}

// Run the manager
if (require.main === module) {
	const manager = new DependencyRulesManager()
	manager.run().catch(console.error)
}

module.exports = DependencyRulesManager
