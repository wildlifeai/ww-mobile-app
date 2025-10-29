#!/usr/bin/env node
/**
 * Test Supabase Connectivity Script
 * Tests connection to Dev_Wildlife_Watcher Supabase instance
 */

const { createClient } = require("@supabase/supabase-js")
require("dotenv").config({ path: ".env.local" })

// Get credentials from environment
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY

console.log("🔍 Testing Supabase Connection...")
console.log(`📍 URL: ${supabaseUrl}`)
console.log(`🔑 Has Anon Key: ${!!supabaseAnonKey}`)
console.log(`🏗️  Project Ref: ${supabaseUrl?.split("//")[1]?.split(".")[0]}`)

if (!supabaseUrl || !supabaseAnonKey) {
	console.error("❌ Missing Supabase credentials")
	process.exit(1)
}

// Create client
const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function testConnection() {
	try {
		console.log("\n🧪 Testing Database Access...")

		// Test 1: Basic connection (list tables)
		const { data: tablesData, error: tablesError } = await supabase
			.from("users")
			.select("count")
			.limit(1)

		if (tablesError) {
			console.log(`⚠️  Table access test: ${tablesError.message}`)
		} else {
			console.log("✅ Database connection successful")
		}

		// Test 2: Auth functionality
		console.log("\n🔐 Testing Auth System...")
		const { data: authData, error: authError } =
			await supabase.auth.getSession()

		if (authError) {
			console.log(`⚠️  Auth system: ${authError.message}`)
		} else {
			console.log("✅ Auth system accessible")
			console.log(`📝 Current session: ${authData.session ? "Active" : "None"}`)
		}

		// Test 3: Check organisations table (MVP2 requirement)
		console.log("\n🏢 Testing Organisations Table...")
		const { data: orgsData, error: orgsError } = await supabase
			.from("organisations")
			.select("count")
			.limit(1)

		if (orgsError) {
			console.log(`⚠️  Organisations table: ${orgsError.message}`)
		} else {
			console.log("✅ Organisations table accessible")
		}

		// Test 4: Check user_roles table (MVP2 requirement)
		console.log("\n👤 Testing User Roles Table...")
		const { data: rolesData, error: rolesError } = await supabase
			.from("user_roles")
			.select("count")
			.limit(1)

		if (rolesError) {
			console.log(`⚠️  User roles table: ${rolesError.message}`)
		} else {
			console.log("✅ User roles table accessible")
		}

		console.log("\n🎉 Supabase connectivity test completed!")
		return true
	} catch (error) {
		console.error("❌ Connection test failed:", error.message)
		return false
	}
}

// Run test
testConnection().then((success) => {
	process.exit(success ? 0 : 1)
})
