#!/usr/bin/env node

/**
 * Post-Install Helper Script
 *
 * Detects newly installed packages and offers to add them to dependency rules.
 * Runs after npm install to help maintain rule coverage.
 */

const fs = require("fs")
const path = require("path")
const { execSync } = require("child_process")

class PostInstallHelper {
	constructor() {
		this.configPath = path.join(__dirname, "dependency-rules.json")
		this.packageJsonPath = path.join(process.cwd(), "package.json")
		this.lastPackagesPath = path.join(__dirname, ".last-packages.json")

		// Load current config
		if (fs.existsSync(this.configPath)) {
			this.config = JSON.parse(fs.readFileSync(this.configPath, "utf8"))
		} else {
			// Config doesn't exist yet, skip
			return
		}

		// Load current package.json
		if (fs.existsSync(this.packageJsonPath)) {
			this.packageJson = JSON.parse(
				fs.readFileSync(this.packageJsonPath, "utf8"),
			)
		} else {
			return
		}
	}

	run() {
		// Skip if config doesn't exist (system not set up yet)
		if (!this.config) {
			return
		}

		const newPackages = this.detectNewPackages()

		if (newPackages.length > 0) {
			this.offerToAddRules(newPackages)
		}

		// Update last packages snapshot
		this.saveCurrentPackagesSnapshot()
	}

	detectNewPackages() {
		const currentPackages = this.getCurrentPackages()
		const previousPackages = this.getPreviousPackages()

		// Find packages that are new (in current but not in previous)
		const newPackages = currentPackages.filter(
			(pkg) => !previousPackages.includes(pkg),
		)

		// Filter out packages that already have rules
		const managedPackages = Object.keys(this.config.rules || {})
		const unmanagedNewPackages = newPackages.filter(
			(pkg) => !managedPackages.includes(pkg),
		)

		return unmanagedNewPackages
	}

	getCurrentPackages() {
		return [
			...Object.keys(this.packageJson.dependencies || {}),
			...Object.keys(this.packageJson.devDependencies || {}),
		]
	}

	getPreviousPackages() {
		if (!fs.existsSync(this.lastPackagesPath)) {
			return []
		}

		try {
			const lastSnapshot = JSON.parse(
				fs.readFileSync(this.lastPackagesPath, "utf8"),
			)
			return lastSnapshot.packages || []
		} catch (e) {
			return []
		}
	}

	offerToAddRules(newPackages) {
		console.log("\\n🔍 Post-install dependency check\\n")
		console.log(
			`📦 Detected ${newPackages.length} new package(s) without rules:\\n`,
		)

		newPackages.forEach((pkg) => {
			const version = this.getInstalledVersion(pkg)
			console.log(`   • ${pkg}@${version}`)
		})

		console.log(
			"\\n💡 To maintain dependency validation coverage, consider adding rules for these packages.",
		)
		console.log("\\n🔧 Run the following command to manage dependency rules:")
		console.log("   npm run manage:deps")
		console.log("\\n   Or add rules manually to scripts/dependency-rules.json")

		// Check if we're in an interactive terminal
		if (process.stdout.isTTY && process.env.npm_config_yes !== "true") {
			console.log(
				"\\n❓ Would you like to add rules now? Run: npm run manage:deps",
			)
		}
	}

	getInstalledVersion(packageName) {
		return (
			this.packageJson.dependencies?.[packageName] ||
			this.packageJson.devDependencies?.[packageName] ||
			null
		)
	}

	saveCurrentPackagesSnapshot() {
		const snapshot = {
			timestamp: new Date().toISOString(),
			packages: this.getCurrentPackages(),
		}

		fs.writeFileSync(this.lastPackagesPath, JSON.stringify(snapshot, null, 2))
	}
}

// Only run if called directly (not during npm install in CI/automated environments)
if (require.main === module) {
	// Skip in CI environments or when explicitly disabled
	if (process.env.CI || process.env.SKIP_DEPS_HELPER) {
		process.exit(0)
	}

	try {
		const helper = new PostInstallHelper()
		helper.run()
	} catch (error) {
		// Don't fail the install if helper has issues
		console.error(
			"⚠️  Post-install helper encountered an issue:",
			error.message,
		)
	}
}

module.exports = PostInstallHelper
