---
allowed-tools: Read, Bash(git:*), Bash(npm run:*), Write, Edit, MultiEdit, Glob, Grep
description: Execute instructions or prompts from a specified file following AADF principles
argument-hint: [file-path]
---

# AADF Prompt File Execution

Execute instructions or prompts stored in a file following **AI Agentic Development Framework (AADF)** principles.

## File Path
**Prompt File**: $ARGUMENTS

## AADF Prompt File Protocol

### Step 1: Read and Parse Prompt File 📖
Read the specified file and parse the instructions:

```bash
# Read the prompt file content
cat "$ARGUMENTS"
```

**Supported File Types:**
- `.md` - Markdown files with structured instructions
- `.txt` - Plain text instruction files
- Any text file with executable prompts

### Step 2: Validate File Path and Content 🔍
Ensure the file exists and contains valid instructions:

**Path Resolution:**
- Absolute paths: `/full/path/to/file.md`
- Relative paths: `./instructions/prompt.md`, `prompts/task.txt`
- Project-relative: `@project-context/instructions/task.md`

**Content Validation:**
- Check file exists and is readable
- Parse instruction structure
- Identify any file references or dependencies

### Step 3: Execute Instructions Following AADF Standards 🚀
Execute the prompt content while maintaining AADF compliance:

**Execution Principles:**
- Follow conventional commit standards if commits are required
- Maintain quality gates and validation
- Apply logical batching for multi-step instructions
- Document any framework learnings discovered
- Track time and velocity metrics where applicable

### Step 4: Handle File References and Dependencies 📁
Process any file references within the prompt:

**Supported References:**
- `@file-path` - Read and include file content
- Relative path resolution from prompt file location
- Environment variable substitution if needed

## Prompt File Structure Examples

### Basic Instruction File
```markdown
# Task: Implement User Authentication

## Instructions
1. Create authentication service
2. Add login/logout functionality
3. Implement JWT token handling
4. Add proper error handling
5. Write comprehensive tests

## Files to Modify
- src/services/AuthService.ts
- src/components/LoginForm.tsx
- tests/AuthService.test.ts

## Success Criteria
- All tests pass
- TypeScript compilation successful
- Authentication flow works end-to-end
```

### Multi-Step Workflow File
```markdown
# Workflow: Feature Implementation

## Phase 1: Planning
- Read @project-context/requirements/feature-spec.md
- Create implementation plan
- Update task tracking

## Phase 2: Implementation
- Implement core functionality
- Add error handling
- Write unit tests

## Phase 3: Integration
- Integration testing
- Documentation updates
- Commit with conventional syntax
```

## Advanced Features

### Template Variables
Support for variable substitution in prompt files:
- `{{FEATURE_NAME}}` - Feature being implemented
- `{{DATE}}` - Current date
- `{{BRANCH}}` - Current git branch

### Conditional Execution
Support for conditional instructions based on environment:
```markdown
## If TypeScript Project
- Run type checking
- Update type definitions

## If Testing Required
- Write unit tests
- Run test suite
```

### File Inclusion
Include other instruction files:
```markdown
# Include common setup steps
@include setup/common-setup.md

# Feature-specific instructions
1. Implement feature X
2. Add feature Y
```

## AADF Integration

### Quality Standards
- Maintain zero-tolerance quality gates
- Follow conventional commit standards
- Apply evidence-based development principles

### Framework Evolution
- Document new patterns discovered during execution
- Update AADF framework files if significant learnings emerge
- Track execution metrics and velocity

### Cross-Project Learning
- Capture reusable patterns for future projects
- Update template libraries and best practices
- Contribute to living framework documentation

## Usage Examples

```bash
# Execute instructions from project context
/aadf-prompt-file "project-context/tasks/implement-metrics-tab.md"

# Run relative path instruction file
/aadf-prompt-file "./prompts/feature-development.txt"

# Execute complex workflow
/aadf-prompt-file "@project-context/workflows/complete-feature-cycle.md"
```

## Error Handling

**File Not Found:**
- Display clear error message
- Suggest similar file names if available
- Provide guidance on correct path format

**Invalid Content:**
- Parse what's possible
- Report parsing issues clearly
- Continue with valid portions where safe

**Execution Failures:**
- Stop on critical errors
- Report progress made before failure
- Provide recovery guidance

## Benefits

- **Consistency**: Standardized instruction execution
- **Reusability**: Store and reuse complex workflows
- **Documentation**: Instructions serve as documentation
- **Team Sharing**: Share workflows across team members
- **Version Control**: Track instruction evolution over time
- **AADF Compliance**: Automatic framework standard adherence

This command enables execution of complex, documented workflows while maintaining AADF principles and standards throughout the development process.