# Serena MCP Setup Guide - Wildlife Watcher Mobile App

## Overview
Serena is a Model Context Protocol (MCP) server that provides semantic coding tools for intelligent code analysis and manipulation. It offers context-aware file operations, symbolic search, and memory management for AI-assisted development.

## Installation & Setup

### 1. Add Serena MCP Server to Claude Code
```bash
# Navigate to your project directory
cd /home/adarsh/dev/wildlifeai/wildlife-watcher-mobile-app

# Add Serena MCP server to Claude Code configuration
claude mcp add serena -- uvx --from git+https://github.com/oraios/serena serena start-mcp-server --context ide-assistant --project $(pwd)
```

This command:
- Adds a new MCP server called "serena"
- Uses `uvx` (universal executor) to run from the GitHub repository
- Configures it for IDE assistant context with the current project path
- Updates the local Claude configuration file: `/home/adarsh/.claude.json`

### 2. Verify Installation
After installation, Serena should be available in Claude Code. The server will:
- Automatically start when Claude Code launches
- Connect to the project at `/home/adarsh/dev/wildlifeai/wildlife-watcher-mobile-app`
- Provide semantic analysis capabilities for the codebase

**Verification Commands:**
```bash
# Check MCP server status
claude mcp list

# Expected output should show:
# serena: uvx --from git+https://github.com/oraios/serena serena start-mcp-server --context ide-assistant --project /home/adarsh/dev/wildlifeai/wildlife-watcher-mobile-app - ✓ Connected
```

### 3. Initial Onboarding Process
On first use, Serena requires an onboarding process to learn about the project:

1. **Onboarding Check**: Serena automatically checks if onboarding was completed
2. **Project Analysis**: If not completed, it analyzes the codebase structure
3. **Memory Creation**: Creates memory files with project information
4. **Ready for Use**: After onboarding, provides full semantic capabilities

## Key Capabilities

### Semantic Code Analysis
- **Symbol Overview**: Get high-level view of code symbols in files
- **Symbol Search**: Find functions, classes, methods by name patterns
- **Reference Finding**: Locate all references to specific symbols
- **Pattern Matching**: Advanced regex-based code search

### Intelligent File Operations
- **Context-Aware Reading**: Read only necessary parts of code files
- **Symbolic Editing**: Edit entire functions, classes, or methods
- **Precise Insertion**: Add code before/after specific symbols
- **Safe Replacement**: Replace symbol bodies with validation

### Project Memory System
- **Persistent Knowledge**: Store project information across sessions
- **Smart Retrieval**: Access relevant project context when needed
- **Learning Capability**: Builds understanding of codebase over time
- **Memory Organization**: Categorized storage for different types of information

## Available Tools

### File & Directory Operations
```bash
mcp__serena__list_dir           # List directories and files
mcp__serena__find_file          # Find files by name patterns
mcp__serena__search_for_pattern # Advanced pattern search in codebase
```

### Symbol Analysis
```bash
mcp__serena__get_symbols_overview    # Get overview of code symbols
mcp__serena__find_symbol            # Find specific symbols by name path
mcp__serena__find_referencing_symbols # Find references to symbols
```

### Code Editing
```bash
mcp__serena__replace_symbol_body    # Replace entire symbol implementation
mcp__serena__insert_after_symbol    # Insert code after symbol definition
mcp__serena__insert_before_symbol   # Insert code before symbol definition
```

### Memory Management
```bash
mcp__serena__write_memory          # Store project information
mcp__serena__read_memory           # Retrieve stored information
mcp__serena__list_memories         # List available memory files
mcp__serena__delete_memory         # Remove memory files
```

### Quality Assurance
```bash
mcp__serena__think_about_collected_information  # Analyze gathered information
mcp__serena__think_about_task_adherence        # Check task alignment
mcp__serena__think_about_whether_you_are_done  # Completion validation
```

## Project-Specific Memory Files

After onboarding, Serena creates these memory files for the Wildlife Watcher Mobile App:

1. **`project_overview.md`** - Project purpose, architecture, MVP2 status
2. **`tech_stack.md`** - React Native, Expo SDK, TypeScript, Supabase stack
3. **`coding_style_conventions.md`** - TypeScript patterns, testing standards
4. **`suggested_commands.md`** - Essential development commands and workflows
5. **`task_completion_checklist.md`** - MVP2 quality gates and validation

## Best Practices

### Efficient Code Reading
- **Start with Overview**: Use `get_symbols_overview` before reading entire files
- **Targeted Reading**: Use `find_symbol` to read specific functions/classes
- **Progressive Discovery**: Build understanding incrementally rather than reading everything

### Smart Code Editing
- **Symbol-Based Editing**: Use symbolic tools for entire functions/classes
- **Precise Changes**: Use pattern-based editing for small code modifications
- **Validation**: Always verify changes with available testing tools

### Memory Usage
- **Context Relevance**: Only read memories relevant to current task
- **Information Quality**: Store high-quality, actionable information
- **Regular Updates**: Keep memories current with project evolution

## Integration with Wildlife Watcher Mobile App Development

### React Native Component Work
Serena excels at:
- Analyzing component structure in `src/components/`
- Finding TypeScript interfaces and type definitions in `src/types/`
- Tracking hook implementations and custom hooks usage
- Understanding navigation patterns in `src/navigation/`

### Service Layer Analysis
- Navigate complex service architecture in `src/services/`
- Understand offline-first patterns in `DatabaseService.ts`
- Find and analyze BLE integration in `CameraService.ts`
- Track Redux/RTK Query integration patterns

### Testing Integration
- Navigate test organization in project structure
- Understand testing patterns and conventions
- Find and analyze test dependencies
- Validate test coverage completeness

### State Management
- Analyze Redux store structure in `src/store/`
- Track RTK Query API slice definitions
- Understand offline state synchronization
- Find action creators and reducers

## Mobile App Specific Use Cases

### 1. MVP2 Task Implementation
Use Serena to:
- Quickly locate relevant components for feature implementation
- Find all usages of specific services or hooks
- Understand data flow patterns across components
- Verify implementation against specifications

### 2. Offline-First Architecture
- Analyze DatabaseService implementation patterns
- Track sync operations and conflict resolution
- Understand queue management for offline operations
- Find all database transaction patterns

### 3. BLE & LoRaWAN Integration
- Navigate camera communication service implementations
- Find webhook handler patterns
- Track device state management
- Understand sensor data processing

### 4. Cross-Project Coordination
- Store backend API contract information in memory
- Track type definitions shared with backend
- Document integration points with backend services
- Monitor schema alignment requirements

## Troubleshooting

### Common Issues
1. **MCP Server Not Starting**: Check that `uvx` is installed and accessible
   ```bash
   # Install uvx if not available
   curl -LsSf https://astral.sh/uv/install.sh | sh
   source $HOME/.local/bin/env
   ```

2. **Project Path Issues**: Ensure the project path in configuration is correct
   ```bash
   # Verify configuration
   cat ~/.claude.json | grep -A 5 "serena"
   ```

3. **Permission Problems**: Verify file system permissions for the project directory
   ```bash
   # Check permissions
   ls -la /home/adarsh/dev/wildlifeai/wildlife-watcher-mobile-app
   ```

4. **Memory Not Loading**: Check if onboarding was completed successfully
   - Serena will prompt for onboarding on first use
   - Allow the onboarding process to complete before using advanced features

### Verification Commands
```bash
# Check Claude MCP configuration
claude mcp list

# Verify all connected servers
# Expected output:
# context7: ✓ Connected
# playwright: ✓ Connected
# supabase: ✓ Connected
# serena: ✓ Connected
```

## Benefits for Wildlife Watcher Mobile App Development

### Productivity Gains
- **Faster Code Navigation**: Quickly find and understand React Native components
- **Intelligent Refactoring**: Make targeted changes with confidence
- **Context Preservation**: Maintain understanding across development sessions
- **Token Efficiency**: Use symbolic reading to reduce token consumption

### Code Quality
- **Better Understanding**: Deeper insight into component and service architecture
- **Consistent Changes**: Follow established TypeScript and React Native patterns
- **Reduced Errors**: Context-aware editing reduces mistakes
- **Pattern Recognition**: Identify and follow MVP2 implementation patterns

### MVP2 Development
- **Task Alignment**: Store and retrieve task specifications from memory
- **Progress Tracking**: Document implementation progress across sessions
- **Quality Gates**: Validate against MVP2 testing standards
- **Cross-Project Sync**: Maintain backend integration knowledge

## Advanced Usage

### Custom Memory Creation
Store MVP2-specific information for future development sessions:
- Task implementation patterns
- Common debugging solutions
- Integration test scenarios
- Performance optimization notes

### Complex Refactoring
Use combination of:
1. Symbol finding to locate target code
2. Reference analysis to understand impact
3. Targeted editing to make changes
4. Quality validation to verify correctness

### Performance Analysis
- Leverage pattern search to identify performance-critical code
- Find all database query patterns for optimization
- Analyze component re-render patterns
- Identify expensive operations in offline sync

## Integration with AADF Framework

Serena MCP integrates with the **AI Agentic Development Framework (AADF)** to enhance:

### Evidence-Based Development
- Store Context7 research results in memory
- Track vendor documentation patterns
- Document proven solution approaches
- Maintain implementation evidence

### Quality Gate Integration
- Validate against MVP2 testing standards stored in memory
- Cross-reference implementation against stored specifications
- Track quality metrics across sessions
- Document zero-tolerance violations and resolutions

### Cross-Project Coordination
- Store backend schema information
- Track API contract evolution
- Document integration dependencies
- Maintain type definition alignment

## Next Steps

1. **Complete Onboarding**: Run Serena for first time to complete project analysis
2. **Create Memories**: Store MVP2 task specifications and patterns
3. **Test Capabilities**: Try symbol search and intelligent reading features
4. **Integrate Workflow**: Use Serena alongside Context7 for optimal efficiency

## Related Documentation

- **AADF Framework**: `@project-context/learnings/ai-agentic-development-framework.md`
- **MVP2 Implementation**: `@project-context/development-context/MVP2/implementation-spec-v1.4.md`
- **Testing Standards**: `@project-context/development-context/MVP2/implementation/guides/testing-standards.md`
- **Backend Setup**: `~/dev/wildlifeai/wildlife-watcher-backend/project-context/learnings/serena-mcp-setup-guide.md`

---

*This guide documents the setup and usage of Serena MCP server for enhanced AI-assisted development in the Wildlife Watcher Mobile App project.*
*Last Updated: 2025-10-14*
