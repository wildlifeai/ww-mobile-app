# Serena MCP Onboarding Status

## Current Status: ✅ Server Installed & Connected

**Date**: 2025-10-14
**Project**: Wildlife Watcher Mobile App
**Location**: `/home/adarsh/dev/wildlifeai/wildlife-watcher-mobile-app`

## Installation Summary

### ✅ Completed Steps:
1. **Server Installation**: Serena MCP server successfully added to Claude Code
2. **Configuration**: Project path configured correctly
3. **Connection Verified**: Server shows as "✓ Connected" in `claude mcp list`
4. **Initial Setup**: `.serena/` directory created with project configuration
5. **Git Integration**: `.serena/` added to `.gitignore`
6. **Documentation**: Comprehensive setup guide created

### 📋 Configuration Details:

**Project Configuration** (`.serena/project.yml`):
- Language: TypeScript
- Project Name: wildlife-watcher-mobile-app
- Read-only Mode: false
- Gitignore Integration: true
- All tools enabled (none excluded)

**Directory Structure**:
```
.serena/
├── .gitignore
├── project.yml
└── memories/ (empty - pending onboarding completion)
```

## Onboarding Process

### What Serena Onboarding Does:

Serena's onboarding process analyzes the codebase to create project-specific memory files:

1. **Project Overview** (`project_overview.md`)
   - Project purpose and architecture
   - MVP2 status and features
   - Key capabilities and components

2. **Technology Stack** (`tech_stack.md`)
   - React Native and Expo configuration
   - TypeScript patterns and practices
   - Supabase integration details
   - Testing frameworks (Maestro)

3. **Coding Conventions** (`coding_style_conventions.md`)
   - TypeScript style standards
   - Component organization patterns
   - Testing methodology (TDD/BDD)
   - Documentation requirements

4. **Essential Commands** (`suggested_commands.md`)
   - Build and test commands
   - Development workflows
   - Common operations

5. **Completion Checklist** (`task_completion_checklist.md`)
   - MVP2 quality gates
   - Testing standards
   - Validation procedures

### Triggering Onboarding:

The onboarding process can be triggered in two ways:

#### Method 1: Automatic (Recommended)
Serena will automatically run onboarding when you first use any Serena tool that requires project knowledge:
- `mcp__serena__get_symbols_overview`
- `mcp__serena__find_symbol`
- `mcp__serena__search_for_pattern`
- Any editing or analysis tool

#### Method 2: Manual (If Available)
If you have direct access to Serena tools, you can explicitly call:
```
mcp__serena__onboarding()
```

## Tool Availability Note

**Important**: Serena MCP tools may not be immediately visible in the current Claude Code session. This is normal and can occur when:

1. **First-time Installation**: Tools may require a Claude Code restart to register
2. **MCP Server Initialization**: The server needs to complete initial setup
3. **Tool Discovery**: Claude Code needs to refresh its available tools list

### Making Serena Tools Available:

To ensure Serena tools are accessible:

1. **Restart Claude Code**:
   - Exit the current session
   - Restart Claude Code
   - The tools should appear after restart

2. **Verify Tool Registration**:
   After restart, check for these tool prefixes:
   - `mcp__serena__get_symbols_overview`
   - `mcp__serena__find_symbol`
   - `mcp__serena__read_memory`
   - `mcp__serena__write_memory`

3. **First Tool Use**:
   Try using any Serena tool - onboarding will trigger automatically:
   ```
   Use mcp__serena__get_symbols_overview to analyze src/services/DatabaseService.ts
   ```

## Expected Onboarding Output

When onboarding completes successfully, you'll see:

### Memory Files Created:
```
.serena/memories/
├── project_overview.md
├── tech_stack.md
├── coding_style_conventions.md
├── suggested_commands.md
└── task_completion_checklist.md
```

### Onboarding Analysis Will Include:

**Project Structure Analysis**:
- `/src` - Source code organization
- `/src/components` - React Native components
- `/src/services` - Business logic and integrations
- `/src/store` - Redux state management
- `/src/navigation` - Navigation configuration
- `/src/types` - TypeScript definitions

**Key Features Identified**:
- Offline-first architecture
- Supabase backend integration
- BLE camera communication
- LoRaWAN webhook monitoring
- Multi-tenancy (organization-based)
- 6-step deployment wizard

**Testing Infrastructure**:
- Maestro TDD/BDD framework
- Test organization patterns
- Quality gates and standards

## Post-Onboarding Usage

Once onboarding completes, you can use Serena for:

### Code Analysis:
```typescript
// Get overview of a component
mcp__serena__get_symbols_overview({ file: "src/components/Projects/ProjectCard.tsx" })

// Find specific functions
mcp__serena__find_symbol({ name: "syncOfflineData" })

// Find all references
mcp__serena__find_referencing_symbols({ location: "src/services/DatabaseService.ts:45" })
```

### Intelligent Editing:
```typescript
// Replace function implementation
mcp__serena__replace_symbol_body({
  location: "src/services/DatabaseService.ts:100",
  new_body: "// updated implementation"
})

// Insert code before/after symbols
mcp__serena__insert_after_symbol({
  location: "src/services/DatabaseService.ts:50",
  content: "// new helper function"
})
```

### Memory Management:
```typescript
// Store implementation patterns
mcp__serena__write_memory({
  name: "offline_sync_patterns",
  content: "Documented patterns for offline data synchronization..."
})

// Retrieve stored knowledge
mcp__serena__read_memory({ name: "offline_sync_patterns" })

// List all memories
mcp__serena__list_memories()
```

## Integration with Development Workflow

### Evidence-Based Development Pattern:
1. **Research Phase**: Use Context7 for vendor documentation
2. **Analysis Phase**: Use Serena for code structure analysis
3. **Implementation Phase**: Use Claude Code for development
4. **Validation Phase**: Use Serena memory for quality gates

### MVP2 Task Implementation:
1. Check task specification in memory
2. Analyze existing code with Serena
3. Store implementation patterns
4. Track progress in memory

### Cross-Session Continuity:
- Store task progress in Serena memory
- Document implementation decisions
- Maintain architectural knowledge
- Track quality gate results

## Troubleshooting

### Issue: Serena Tools Not Available
**Solution**: Restart Claude Code to register MCP tools

### Issue: Onboarding Not Triggered
**Solution**: Explicitly use a Serena analysis tool to force onboarding

### Issue: Memory Files Not Created
**Solution**:
1. Check `.serena/project.yml` exists
2. Verify write permissions on `.serena/memories/`
3. Try manual onboarding (if tool available)

### Issue: Server Connection Lost
**Solution**:
```bash
# Check server status
claude mcp list

# If not connected, restart
# (Claude Code will auto-restart the server)
```

## Next Actions

### Immediate (Now):
- ✅ Server installed and connected
- ✅ Configuration complete
- ✅ Documentation created
- ⏳ Awaiting tool availability (restart may be needed)

### After Restart:
1. Verify Serena tools appear in tool list
2. Use `mcp__serena__get_symbols_overview` on a service file
3. Confirm onboarding triggers and completes
4. Verify memory files created in `.serena/memories/`

### Ongoing:
- Use Serena for code analysis during MVP2 tasks
- Store implementation patterns in memory
- Document quality gate results
- Maintain cross-session knowledge

## Resources

- **Setup Guide**: `project-context/learnings/serena-mcp-setup-guide.md`
- **Serena GitHub**: https://github.com/oraios/serena
- **AADF Framework**: `project-context/learnings/ai-agentic-development-framework.md`
- **MVP2 Specs**: `project-context/development-context/MVP2/implementation-spec-v1.4.md`

---

*Onboarding Status: Pending Tool Availability*
*Next Step: Restart Claude Code to enable Serena tools*
*Last Updated: 2025-10-14*
