# MCP (Model Context Protocol) Setup Guide

## Overview

Model Context Protocol (MCP) tools provide enhanced capabilities for AI-assisted development. This guide covers setup for the Wildlife Watcher mobile app development environment.

## Prerequisites

- Claude Code access (claude.ai/code)
- Terminal access
- Git installed

## Quick Setup

### 1. Claude Flow

Claude Flow provides workflow orchestration and coordination capabilities.

```bash
claude mcp add claude-flow npx claude-flow@alpha mcp start
```

**Purpose:** Workflow automation, agent coordination, task tracking

### 2. Serena MCP Server

Serena provides symbolic code analysis and intelligent editing.

```bash
# Install uv package manager
curl -LsSf https://astral.sh/uv/install.sh | sh
source $HOME/.local/bin/env

# Start Serena MCP server
uvx --from git+https://github.com/oraios/serena serena start-mcp-server
```

**Purpose:** Symbolic code analysis, intelligent editing, cross-project memory

### 3. Context7 (Included with Claude)

Context7 provides library documentation access.

**Purpose:** Research library documentation, find vendor-specific patterns

### 4. Supabase MCP (Optional)

For direct Supabase operations.

```bash
# Install Supabase MCP server
npm install -g @supabase/mcp-server

# Configure in Claude settings
```

**Purpose:** Database operations, migrations, type generation

## Available MCP Tools

### Context7 Tools (Mandatory First Step)

**When to use:** ALWAYS before implementing any new feature

- `mcp__context7__resolve-library-id` - Find library ID from name
- `mcp__context7__get-library-docs` - Fetch comprehensive documentation

**Example:**
```javascript
// Research React Native SQLite before implementation
mcp__context7__resolve-library-id({ libraryName: "react-native-sqlite" })
mcp__context7__get-library-docs({
  context7CompatibleLibraryID: "/resolved/library",
  topic: "uuid-handling",
  tokens: 15000
})
```

**Evidence:** 10x debugging efficiency improvement (2.5h → 15min)

### Supabase MCP Tools

**When to use:** Database schema changes, migrations, type generation

- `mcp__supabase__list_tables` - List all database tables
- `mcp__supabase__execute_sql` - Run SQL queries
- `mcp__supabase__list_migrations` - View migration history
- `mcp__supabase__apply_migration` - Apply schema changes
- `mcp__supabase__generate_typescript_types` - Generate TypeScript types

### Serena MCP Tools

**When to use:** Complex code analysis, intelligent editing

- **Symbolic Code Analysis** - Understand structure without reading entire files
- **Intelligent Editing** - Precise modifications using symbols/regex
- **Cross-Project Memory** - Persistent knowledge across sessions
- **Advanced Search** - Pattern-based code discovery

### IDE Integration

**When to use:** TypeScript/linting diagnostics, notebook execution

- `mcp__ide__getDiagnostics` - Get VS Code language diagnostics
- `mcp__ide__executeCode` - Execute Python in Jupyter notebooks

## Tool Coordination Strategy

1. **Context7** - MANDATORY FIRST for library docs and vendor patterns
2. **Claude Code** - PRIMARY for file ops, coding, testing, git, npm
3. **Specialized Agents** - Domain expertise (see CLAUDE-optimized.md)
4. **MCP Tools** - Coordination, memory, metrics, integration

**Proven Workflow:**
Context7 Research → Claude Code Implementation → Specialized Agents → MCP Coordination

## Troubleshooting

### Claude Flow Not Starting

**Error:** "Command not found: claude"

**Solution:**
```bash
# Install Claude CLI
npm install -g @anthropics/claude-cli

# Verify installation
claude --version
```

### Serena Server Fails

**Error:** "Failed to start MCP server"

**Solution:**
```bash
# Reinstall uv
curl -LsSf https://astral.sh/uv/install.sh | sh

# Reload shell
source ~/.bashrc  # or ~/.zshrc

# Retry Serena installation
uvx --from git+https://github.com/oraios/serena serena start-mcp-server
```

### Context7 API Errors

**Error:** "API rate limit exceeded"

**Solution:** Context7 has rate limits. Wait 1 minute and retry, or reduce token count in requests.

## Additional Resources

- [Claude Flow Documentation](https://github.com/ruvnet/claude-flow)
- [Serena GitHub](https://github.com/oraios/serena)
- [MCP Specification](https://modelcontextprotocol.io)
- Full MCP tool guide in [CLAUDE-optimized.md](../../CLAUDE-optimized.md)

## Next Steps

After setup:
1. Review [CLAUDE-optimized.md](../../CLAUDE-optimized.md) for comprehensive development guidelines
2. Read [Developer-Onboarding-Guide.md](./Developer-Onboarding-Guide.md)
3. Follow [Quick-Start-Checklist.md](./Quick-Start-Checklist.md)
