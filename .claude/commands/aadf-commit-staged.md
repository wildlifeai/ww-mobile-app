---
allowed-tools: Bash(git:*), Bash(npm run:*)
description: AADF-compliant commits for staged files only using conventional commits syntax
argument-hint: [description of staged changes]
---

# AADF Framework Staged Commit Workflow

Commit **only staged files** following **AI Agentic Development Framework (AADF)** with logical batching and conventional commits syntax. Ignores any unstaged changes.

## Changes Description
**Staged Work Summary**: $ARGUMENTS

## AADF Staged Commit Protocol

### Step 1: Analyze Staged Files Only 🔍
Review only the files that have been staged to understand the logical story:

```bash
git status --porcelain | grep "^[AM]"
git diff --cached --name-only
```

**Focus**: Only staged files (ignores unstaged modifications and untracked files)

### Step 2: Create Logical Commit Batches from Staged Files 📦
Group **staged changes only** into logical, related batches that tell the story of development progress:

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

### Step 4: Execute Staged-Only Commit Sequence 🚀
Commit staged files in logical batches. **Unstaged changes are ignored.**

**Example Staged-Only Sequence:**
```bash
# Check what's staged
git diff --cached --name-only

# Group staged files by type/purpose and commit in logical order
# Example: If you have docs and features staged separately

# 1. Commit staged docs first (if any)
git commit -m "docs(dashboard): add comprehensive analysis document

- Document current implementation and enhancement opportunities
- Provide structured roadmap for implementation
- Ready for development phase

🤖 Generated with [Claude Code](https://claude.ai/code)

Co-Authored-By: Claude <noreply@anthropic.com>"

# Note: This command commits ALL staged files in one logical commit
# For multiple logical commits, stage files separately and run command multiple times
```

## Staged-Only Commit Strategy

**Single Logical Commit Approach:**
- Analyzes all staged files as one logical unit
- Creates one commit with all staged changes
- Ignores any unstaged modifications completely
- Perfect for when you've carefully staged related changes

**Multi-Batch Strategy (Manual):**
1. Stage first logical group: `git add file1 file2`
2. Run: `/aadf-commit-staged "first logical change"`
3. Stage second logical group: `git add file3 file4`
4. Run: `/aadf-commit-staged "second logical change"`
5. Repeat as needed

## Key Differences from aadf-commit

- **Scope**: Only staged files vs all changed files
- **Staging**: Uses existing staging vs automatic staging
- **Control**: More granular control over what gets committed
- **Safety**: Leaves unstaged changes untouched
- **Workflow**: Supports incremental, careful staging approach

## Logical Commit Story Structure

**Each staged commit should:**
- Focus on ONE logical change (staged together)
- Have a clear, descriptive message
- Follow conventional commits format
- Tell part of the development story
- Leave unstaged changes for future commits

## Usage Examples

```bash
# Stage specific files first
git add src/components/MetricsTab.tsx tests/MetricsTab.test.tsx

# Then commit only those staged files
/aadf-commit-staged "feat(dashboard): implement interactive metrics tab component"

# Unstaged changes remain untouched for future commits
```

## When to Use aadf-commit-staged

- **Incremental Development**: When you want to commit work in smaller, precise chunks
- **Code Review Preparation**: Creating focused commits for easier review
- **Mixed Changes**: When working directory has changes for different features
- **Careful Staging**: When you've deliberately staged specific related files
- **Partial Work**: Committing completed parts while leaving WIP unstaged

This command provides precise control over what gets committed while maintaining AADF compliance and conventional commit standards.