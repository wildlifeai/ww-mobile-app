#!/usr/bin/env node

/**
 * Validation script for file system migration from react-native-fs to expo-file-system
 * Part of Task 4.1: Execute File System Migration Script
 */

const fs = require("fs")
const path = require("path")

console.log("🔍 Validating File System Migration...\n")

let hasErrors = false
let filesChecked = 0
let rnfsUsageFound = []
let expoFileSystemUsageFound = []

// Patterns to check
const oldPatterns = [
	"react-native-fs",
	"RNFS\\.",
	"RNFS from",
	"DocumentDirectoryPath",
	"CachesDirectoryPath",
	"ExternalDirectoryPath",
]

const newPatterns = [
	"expo-file-system",
	"FileSystem\\.",
	"FileSystem from",
	"documentDirectory",
	"cacheDirectory",
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
			rnfsUsageFound.push({ file, pattern })
			hasErrors = true
		}
	})

	// Check for new patterns
	newPatterns.forEach((pattern) => {
		const regex = new RegExp(pattern, "g")
		if (regex.test(content)) {
			expoFileSystemUsageFound.push({ file, pattern })
		}
	})
})

// Report results
console.log("📊 Migration Validation Results:\n")
console.log(`✓ Files checked: ${filesChecked}`)
console.log(`✓ react-native-fs usage found: ${rnfsUsageFound.length}`)
console.log(
	`✓ expo-file-system usage found: ${expoFileSystemUsageFound.length} files\n`,
)

if (rnfsUsageFound.length > 0) {
	console.log("❌ MIGRATION INCOMPLETE - Found react-native-fs usage:\n")
	rnfsUsageFound.forEach(({ file, pattern }) => {
		console.log(`  - ${file} (pattern: ${pattern})`)
	})
	console.log("\n")
} else {
	console.log(
		"✅ File System Migration COMPLETE - No react-native-fs usage found!\n",
	)
}

if (expoFileSystemUsageFound.length > 0) {
	console.log("📁 Files using expo-file-system:\n")
	const uniqueFiles = [
		...new Set(expoFileSystemUsageFound.map((item) => item.file)),
	]
	uniqueFiles.forEach((file) => {
		console.log(`  - ${file}`)
	})
	console.log("\n")
}

// Check specific migration patterns from FILE-SYSTEM-MIGRATION-EXAMPLES.md
console.log("🔍 Checking specific migration patterns:\n")

const migrationChecks = [
	{ old: "RNFS.writeFile", new: "FileSystem.writeAsStringAsync" },
	{ old: "RNFS.readFile", new: "FileSystem.readAsStringAsync" },
	{ old: "RNFS.readDir", new: "FileSystem.readDirectoryAsync" },
	{ old: "RNFS.mkdir", new: "FileSystem.makeDirectoryAsync" },
	{ old: "RNFS.unlink", new: "FileSystem.deleteAsync" },
	{ old: "RNFS.exists", new: "FileSystem.getInfoAsync" },
	{ old: "RNFS.stat", new: "FileSystem.getInfoAsync" },
	{ old: "RNFS.copyFile", new: "FileSystem.copyAsync" },
	{ old: "RNFS.moveFile", new: "FileSystem.moveAsync" },
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
	console.log("  ✅ All old RNFS methods have been migrated!")
}

console.log("\n📋 Summary:")
console.log("━".repeat(50))
console.log(`Migration Status: ${hasErrors ? "❌ INCOMPLETE" : "✅ COMPLETE"}`)
console.log(
	`Files with expo-file-system: ${
		[...new Set(expoFileSystemUsageFound.map((item) => item.file))].length
	}`,
)
console.log(`Files with react-native-fs: ${rnfsUsageFound.length}`)
console.log("━".repeat(50))

process.exit(hasErrors ? 1 : 0)
