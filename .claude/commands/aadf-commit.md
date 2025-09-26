---
allowed-tools: Bash(git:*), Bash(npm run:*)
description: AADF-compliant commits in logical batches using conventional commits syntax
argument-hint: [description of changes made]
---

# AADF Framework Commit Workflow

Commit changes following **AI Agentic Development Framework (AADF)** with logical batching and conventional commits syntax.

## Changes Description
**Work Summary**: $ARGUMENTS

## AADF Commit Protocol

### Step 1: Analyze Changed Files 🔍
First, review what files have been changed to understand the logical story:

```bash
git status --porcelain
git diff --name-only
```

### Step 2: Create Logical Commit Batches 📦
Group changes into logical, related batches that tell the story of development progress:

**Typical AADF Commit Order:**
1. **docs**: Analysis and planning documents first
2. **feat**: New features and functionality
3. **fix**: Bug fixes and corrections
4. **refactor**: Code improvements and optimizations
5. **test**: Test additions and updates
6. **chore**: Maintenance and configuration updates

### Step 3: Conventional Commits Format 📝
Use conventional commits syntax: `<type>[optional scope]: <description>`

**Types:**
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `refactor`: Code refactoring
- `test`: Test additions/changes
- `chore`: Maintenance tasks
- `perf`: Performance improvements
- `style`: Code style changes

### Step 4: Execute Logical Commit Sequence 🚀
Commit files in batches that tell the story of the work:

**Example Sequence:**
```bash
# 1. Commit analysis/planning documents first
git add project-context/development-context/project-progress-tracker/METRICS-TAB-ANALYSIS-AND-ENHANCEMENT-PLAN.md
git commit -m "docs(dashboard): add comprehensive Metrics Tab analysis and enhancement plan

- Document current implementation strengths and limitations
- Identify missing backend API endpoints and data integration gaps
- Provide enhancement roadmap with priority levels
- Ready for implementation planning phase

🤖 Generated with [Claude Code](https://claude.ai/code)

Co-Authored-By: Claude <noreply@anthropic.com>"

# 2. Commit context document updates
git add project-context/development-context/project-progress-tracker/DASHBOARD-CONTEXT-PROMPT.md
git commit -m "docs(dashboard): update context to prioritize Metrics Tab enhancement

- Mark Metrics Tab as next planned enhancement priority
- Reference new analysis document for implementation guidance
- Update file structure documentation
- Maintain systematic enhancement approach

🤖 Generated with [Claude Code](https://claude.ai/code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

## Logical Commit Story Structure

**The Story Arc:**
1. **Planning Phase**: Analysis documents, requirements, specifications
2. **Implementation Phase**: Core functionality, features, fixes
3. **Quality Phase**: Tests, refactoring, optimizations
4. **Documentation Phase**: Updates, guides, context preservation

**Each commit should:**
- Focus on ONE logical change
- Have a clear, descriptive message
- Follow conventional commits format
- Tell part of the development story
- Enable easy review and understanding

## Usage
```bash
/aadf-commit "completed Metrics Tab analysis and updated dashboard context for next enhancement phase"
```

This command will analyze the changed files, group them logically, and create a sequence of conventional commits that tell the story of your development progress in a way that makes sense to reviewers.