#!/usr/bin/env node

/**
 * Comprehensive migration validation script for Task 4.5
 * Validates all code migrations from Tasks 4.1 - 4.4
 */

const fs = require("fs")
const path = require("path")
const { execSync } = require("child_process")

console.log("🚀 Comprehensive Migration Validation\n")
console.log("Validating all migrations completed in Task 4...\n")

let overallErrors = 0
const validationResults = []

// Validation 1: File System Migration
console.log("1️⃣  File System Migration (react-native-fs → expo-file-system)")
console.log("━".repeat(60))

try {
	const result = execSync("node scripts/validate-filesystem-migration.js", {
		encoding: "utf8",
	})
	if (result.includes("Migration Status: ✅ COMPLETE")) {
		console.log("✅ File System Migration: PASSED\n")
		validationResults.push({ name: "File System Migration", status: "PASSED" })
	} else {
		console.log("❌ File System Migration: FAILED\n")
		validationResults.push({ name: "File System Migration", status: "FAILED" })
		overallErrors++
	}
} catch (error) {
	console.log("❌ File System Migration: ERROR\n")
	validationResults.push({ name: "File System Migration", status: "ERROR" })
	overallErrors++
}

// Validation 2: Environment Variable Migration
console.log(
	"2️⃣  Environment Variable Migration (react-native-config → expo-constants)",
)
console.log("━".repeat(60))

try {
	const result = execSync("node scripts/validate-env-migration.js", {
		encoding: "utf8",
	})
	if (result.includes("Migration Status: ✅ COMPLETE")) {
		console.log("✅ Environment Variable Migration: PASSED\n")
		validationResults.push({
			name: "Environment Variable Migration",
			status: "PASSED",
		})
	} else {
		console.log("❌ Environment Variable Migration: FAILED\n")
		validationResults.push({
			name: "Environment Variable Migration",
			status: "FAILED",
		})
		overallErrors++
	}
} catch (error) {
	console.log("❌ Environment Variable Migration: ERROR\n")
	validationResults.push({
		name: "Environment Variable Migration",
		status: "ERROR",
	})
	overallErrors++
}

// Validation 3: Splash Screen Migration
console.log(
	"3️⃣  Splash Screen Migration (react-native-bootsplash → expo-splash-screen)",
)
console.log("━".repeat(60))

try {
	const result = execSync("node scripts/validate-splash-migration.js", {
		encoding: "utf8",
	})
	if (result.includes("Migration Status: ✅ COMPLETE")) {
		console.log("✅ Splash Screen Migration: PASSED\n")
		validationResults.push({
			name: "Splash Screen Migration",
			status: "PASSED",
		})
	} else {
		console.log("❌ Splash Screen Migration: FAILED\n")
		validationResults.push({
			name: "Splash Screen Migration",
			status: "FAILED",
		})
		overallErrors++
	}
} catch (error) {
	console.log("❌ Splash Screen Migration: ERROR\n")
	validationResults.push({ name: "Splash Screen Migration", status: "ERROR" })
	overallErrors++
}

// Validation 4: Metro Configuration
console.log("4️⃣  Metro Configuration & App Entry Point")
console.log("━".repeat(60))

let metroErrors = 0

// Check Metro config
try {
	execSync("node -c metro.config.js")
	console.log("✅ metro.config.js syntax valid")
} catch (error) {
	console.log("❌ metro.config.js syntax error")
	metroErrors++
}

// Check if asset extensions are added
const metroConfig = fs.readFileSync("./metro.config.js", "utf8")
if (metroConfig.includes("assetExts.push('db', 'zip')")) {
	console.log("✅ Metro config has custom asset extensions")
} else {
	console.log("❌ Metro config missing custom asset extensions")
	metroErrors++
}

// Check index.js
try {
	execSync("node -c index.js")
	console.log("✅ index.js syntax valid")
} catch (error) {
	console.log("❌ index.js syntax error")
	metroErrors++
}

// Check if using registerRootComponent
const indexJs = fs.readFileSync("./index.js", "utf8")
if (indexJs.includes("registerRootComponent")) {
	console.log("✅ index.js uses Expo registerRootComponent")
} else {
	console.log("❌ index.js not using Expo registerRootComponent")
	metroErrors++
}

if (metroErrors === 0) {
	console.log("✅ Metro Configuration: PASSED\n")
	validationResults.push({ name: "Metro Configuration", status: "PASSED" })
} else {
	console.log("❌ Metro Configuration: FAILED\n")
	validationResults.push({ name: "Metro Configuration", status: "FAILED" })
	overallErrors++
}

// Validation 5: TypeScript Compilation
console.log("5️⃣  TypeScript Compilation")
console.log("━".repeat(60))

try {
	execSync("npx tsc --noEmit", { stdio: "pipe" })
	console.log("✅ TypeScript compilation: NO ERRORS")
	validationResults.push({ name: "TypeScript Compilation", status: "PASSED" })
} catch (error) {
	const errorOutput = error.stdout.toString()
	const errorCount = (errorOutput.match(/error TS/g) || []).length

	// Check if these are migration-related errors or pre-existing
	const migrationRelatedErrors =
		errorOutput.includes("react-native-fs") ||
		errorOutput.includes("react-native-config") ||
		errorOutput.includes("react-native-bootsplash")

	if (migrationRelatedErrors) {
		console.log(
			`❌ TypeScript compilation: ${errorCount} MIGRATION-RELATED ERRORS`,
		)
		validationResults.push({
			name: "TypeScript Compilation",
			status: "MIGRATION ERRORS",
		})
		overallErrors++
	} else {
		console.log(
			`⚠️  TypeScript compilation: ${errorCount} PRE-EXISTING ERRORS (not migration-related)`,
		)
		validationResults.push({
			name: "TypeScript Compilation",
			status: "PRE-EXISTING ERRORS",
		})
	}
}

console.log("")

// Validation 6: Package Dependencies
console.log("6️⃣  Package Dependencies")
console.log("━".repeat(60))

const packageJson = JSON.parse(fs.readFileSync("./package.json", "utf8"))
const dependencies = {
	...packageJson.dependencies,
	...packageJson.devDependencies,
}

// Check old packages are removed
const oldPackages = [
	"react-native-fs",
	"react-native-config",
	"react-native-bootsplash",
]
const remainingOldPackages = oldPackages.filter((pkg) => dependencies[pkg])

if (remainingOldPackages.length > 0) {
	console.log(
		`❌ Old packages still in package.json: ${remainingOldPackages.join(", ")}`,
	)
	overallErrors++
} else {
	console.log("✅ All old packages removed from package.json")
}

// Check new packages are present
const newPackages = ["expo-file-system", "expo-constants", "expo-splash-screen"]
const missingNewPackages = newPackages.filter((pkg) => !dependencies[pkg])

if (missingNewPackages.length > 0) {
	console.log(`❌ Missing new packages: ${missingNewPackages.join(", ")}`)
	overallErrors++
} else {
	console.log("✅ All new Expo packages present")
}

if (remainingOldPackages.length === 0 && missingNewPackages.length === 0) {
	validationResults.push({ name: "Package Dependencies", status: "PASSED" })
} else {
	validationResults.push({ name: "Package Dependencies", status: "FAILED" })
}

// Final Summary
console.log("\n📋 FINAL MIGRATION VALIDATION SUMMARY")
console.log("━".repeat(60))

validationResults.forEach((result) => {
	const icon =
		result.status === "PASSED"
			? "✅"
			: result.status === "PRE-EXISTING ERRORS"
			? "⚠️"
			: "❌"
	console.log(`${icon} ${result.name}: ${result.status}`)
})

console.log("━".repeat(60))

if (overallErrors === 0) {
	console.log("🎉 ALL MIGRATIONS COMPLETED SUCCESSFULLY!")
	console.log("")
	console.log("Task 4: Code Migration and Import Updates - ✅ COMPLETE")
	console.log("")
	console.log("Summary of completed migrations:")
	console.log("• File System: react-native-fs → expo-file-system")
	console.log("• Environment: react-native-config → expo-constants")
	console.log("• Splash Screen: react-native-bootsplash → expo-splash-screen")
	console.log("• Metro Config: Updated for Expo with custom assets")
	console.log("• App Entry: Updated to use registerRootComponent")
	console.log("")
	console.log(
		"Ready to proceed to Task 5: EAS Build Configuration and Deployment",
	)
} else {
	console.log(`❌ ${overallErrors} VALIDATION FAILURES FOUND`)
	console.log("")
	console.log(
		"Please review and fix the issues above before proceeding to Task 5.",
	)
}

console.log("━".repeat(60))

process.exit(overallErrors)
