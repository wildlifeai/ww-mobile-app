#!/usr/bin/env node

/**
 * Validation script for splash screen migration from react-native-bootsplash to expo-splash-screen
 * Part of Task 4.3: Execute Splash Screen Migration Script
 */

const fs = require("fs")
const path = require("path")

console.log("🔍 Validating Splash Screen Migration...\n")

let hasErrors = false
let filesChecked = 0
let oldSplashUsage = []
let expoSplashUsage = []

// Patterns to check
const oldPatterns = [
	"import.*from.*['\"]react-native-bootsplash['\"]",
	"require\\(['\"]react-native-bootsplash['\"]\\)",
	"RNBootSplash\\.",
	"BootSplash\\.",
]

const newPatterns = [
	"import.*from.*['\"]expo-splash-screen['\"]",
	"SplashScreen\\.",
	"hideAsync\\(\\)",
	"preventAutoHideAsync\\(\\)",
]

// Find all JS/TS files
function findFiles(dir, fileList = []) {
	try {
		const files = fs.readdirSync(dir)
		files.forEach((file) => {
			const filePath = path.join(dir, file)
			const stat = fs.statSync(filePath)
			if (
				stat.isDirectory() &&
				!filePath.includes("node_modules") &&
				!filePath.includes(".git")
			) {
				findFiles(filePath, fileList)
			} else if (file.match(/\.(js|jsx|ts|tsx)$/)) {
				fileList.push(filePath)
			}
		})
	} catch (error) {
		// Ignore directories we can't read
	}
	return fileList
}

// Check files for patterns
const srcFiles = findFiles("./src")
const componentFiles = findFiles("./components")
const allFiles = [...srcFiles, ...componentFiles]

console.log(`Checking ${allFiles.length} files...\n`)

allFiles.forEach((file) => {
	filesChecked++
	const content = fs.readFileSync(file, "utf8")

	// Check for old patterns
	oldPatterns.forEach((pattern) => {
		const regex = new RegExp(pattern, "g")
		if (regex.test(content)) {
			oldSplashUsage.push({ file, pattern })
			hasErrors = true
		}
	})

	// Check for new patterns
	newPatterns.forEach((pattern) => {
		const regex = new RegExp(pattern, "g")
		if (regex.test(content)) {
			expoSplashUsage.push({ file, pattern })
		}
	})
})

// Report results
console.log("📊 Splash Screen Migration Results:\n")
console.log(`✓ Files checked: ${filesChecked}`)
console.log(`✓ react-native-bootsplash usage found: ${oldSplashUsage.length}`)
console.log(
	`✓ expo-splash-screen usage found: ${
		[...new Set(expoSplashUsage.map((item) => item.file))].length
	} files\n`,
)

if (oldSplashUsage.length > 0) {
	console.log(
		"❌ MIGRATION INCOMPLETE - Found react-native-bootsplash usage:\n",
	)
	oldSplashUsage.forEach(({ file, pattern }) => {
		console.log(`  - ${file} (pattern: ${pattern})`)
	})
	console.log("\n")
} else {
	console.log(
		"✅ Splash Screen Migration COMPLETE - No react-native-bootsplash usage found!\n",
	)
}

if (expoSplashUsage.length > 0) {
	console.log("📁 Files using expo-splash-screen:\n")
	const uniqueFiles = [...new Set(expoSplashUsage.map((item) => item.file))]
	uniqueFiles.forEach((file) => {
		console.log(`  - ${file}`)
	})
	console.log("\n")
}

// Check specific migration patterns
console.log("🔍 Checking specific migration patterns:\n")

const migrationChecks = [
	{ old: "RNBootSplash.hide()", new: "SplashScreen.hideAsync()" },
	{ old: "RNBootSplash.show()", new: "SplashScreen.preventAutoHideAsync()" },
	{ old: "BootSplash.hide()", new: "SplashScreen.hideAsync()" },
	{ old: "BootSplash.show()", new: "SplashScreen.preventAutoHideAsync()" },
]

let oldMethodsFound = false
migrationChecks.forEach(({ old, new: newMethod }) => {
	const oldFound = allFiles.some((file) => {
		const content = fs.readFileSync(file, "utf8")
		return content.includes(old)
	})

	if (oldFound) {
		console.log(`  ❌ Found old method: ${old} (should be ${newMethod})`)
		oldMethodsFound = true
	}
})

if (!oldMethodsFound) {
	console.log("  ✅ All old splash screen methods have been migrated!")
}

// Check for proper async/await usage
console.log("\n🔍 Checking async/await usage:\n")

const filesWithHideAsync = allFiles.filter((file) => {
	const content = fs.readFileSync(file, "utf8")
	return content.includes("SplashScreen.hideAsync()")
})

if (filesWithHideAsync.length > 0) {
	console.log("  ✅ Found SplashScreen.hideAsync() usage in:")
	filesWithHideAsync.forEach((file) => {
		const content = fs.readFileSync(file, "utf8")
		// Check if it's properly awaited
		if (content.includes("await SplashScreen.hideAsync()")) {
			console.log(`    ✅ ${file} (properly awaited)`)
		} else {
			console.log(`    ⚠️  ${file} (not awaited - might be intentional)`)
		}
	})
} else {
	console.log("  ⚠️  No SplashScreen.hideAsync() usage found")
}

// Check app.config.js for splash configuration
console.log("\n🔍 Checking app.config.js splash configuration:\n")

try {
	const appConfigPath = "./app.config.js"
	if (fs.existsSync(appConfigPath)) {
		const appConfigContent = fs.readFileSync(appConfigPath, "utf8")

		if (appConfigContent.includes("splash:")) {
			console.log("  ✅ app.config.js has splash configuration")

			if (
				appConfigContent.includes("image:") &&
				appConfigContent.includes("resizeMode:")
			) {
				console.log("  ✅ Splash screen image and resize mode configured")
			} else {
				console.log("  ⚠️  Splash screen configuration might be incomplete")
			}
		} else {
			console.log("  ⚠️  app.config.js missing splash configuration")
		}
	} else {
		console.log("  ⚠️  app.config.js not found")
	}
} catch (error) {
	console.log("  ❌ Error reading app.config.js:", error.message)
}

console.log("\n📋 Summary:")
console.log("━".repeat(50))
console.log(`Migration Status: ${hasErrors ? "❌ INCOMPLETE" : "✅ COMPLETE"}`)
console.log(
	`Files with expo-splash-screen: ${
		[...new Set(expoSplashUsage.map((item) => item.file))].length
	}`,
)
console.log(`Files with react-native-bootsplash: ${oldSplashUsage.length}`)
console.log(`Files using hideAsync(): ${filesWithHideAsync.length}`)
console.log("━".repeat(50))

process.exit(hasErrors ? 1 : 0)
