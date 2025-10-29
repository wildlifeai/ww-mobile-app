# /aadf-update-learnings Command

**Purpose**: Automate the discovery, categorization, and documentation of learnings from git commit history into the AI Agentic Development Framework (AADF) and project learnings.

**Scope**: Project-level

---

## Command Specification

### Parameter Handling

Accept flexible single parameter: `[optional: instruction-text-or-file-path]`

**Parameter Resolution Logic**:
1. **No parameter** → Analyze all commits since last AADF framework update
2. **Path-like parameter** (contains `/` or `@project-context`) → Read file for instructions
3. **Text parameter** → Use as focus area/additional prompt
4. **Date parameter** (format: `since YYYY-MM-DD`) → Analyze commits from that date

**Examples**:
```bash
/aadf-update-learnings
/aadf-update-learnings "focus on dashboard development and coordination patterns"
/aadf-update-learnings "@project-context/instructions/learning-extraction-rules.md"
/aadf-update-learnings "since 2025-10-15"
```

---

## Core Workflow

### Phase 1: Git History Analysis

**Objective**: Extract structured commit data and identify patterns

**Steps**:

1. **Determine Analysis Timeframe**
   ```bash
   # Get last update date of AADF framework
   git log -1 --format="%ai" -- project-context/learnings/ai-agentic-development-framework.md

   # Or use parameter-specified date if provided
   # Or default to last 7 days if framework file doesn't exist
   ```

2. **Extract Commit History**
   ```bash
   # Get structured commit data
   git log --since="<determined-date>" \
     --pretty=format:"%h|%ai|%s|%b" \
     --no-merges \
     --all

   # Analyze conventional commit types
   git log --since="<date>" \
     --pretty=format:"%s" \
     --no-merges | \
     awk -F':' '{print $1}' | \
     sort | uniq -c | sort -rn

   # Extract commit scopes
   git log --since="<date>" \
     --pretty=format:"%s" \
     --no-merges | \
     grep -oP '(?<=\()[^)]+(?=\))' | \
     sort | uniq -c | sort -rn
   ```

3. **Identify Commit Patterns**
   - **Type Distribution**: `docs:`, `feat:`, `fix:`, `refactor:`, `test:`, etc.
   - **Scope Analysis**: `coordination`, `mvp2`, `dashboard`, `aadf`, `learnings`, etc.
   - **Sequence Patterns**: Planning → Implementation → Documentation chains
   - **Multi-Commit Stories**: Related commits spanning multiple files/areas

4. **Extract High-Value Commits**
   ```bash
   # Look for learning indicators in commit messages
   git log --since="<date>" \
     --grep="learning\|pattern\|insight\|discovery\|methodology\|ROI\|efficiency\|improvement" \
     --pretty=format:"%h|%ai|%s|%b" \
     --no-merges -i
   ```

---

### Phase 2: Learning Identification

**Objective**: Discover undocumented learnings and patterns

**Steps**:

1. **Scan Existing Learning Documents**
   ```bash
   # List all learning documents
   ls -lh project-context/learnings/

   # Get last update dates
   git log -1 --format="%h|%ai|%s" -- project-context/learnings/*.md
   ```

2. **Identify Documentation Gaps**
   - Compare commit topics with existing learning documents
   - Flag commits with learning potential not yet documented
   - Identify new methodology patterns in commit messages

3. **Extract Pattern Categories**

   **Framework Evolution Patterns**:
   - New orchestration workflows
   - Agent coordination improvements
   - Quality gate refinements
   - Template pattern discoveries

   **Methodology Discoveries**:
   - New development workflows (e.g., "TypeScript Error Triage Workflow")
   - Process optimizations (e.g., "repo-agnostic agent design")
   - Debugging methodologies
   - Testing strategy improvements

   **Performance Metrics**:
   - Efficiency measurements (e.g., "+28% faster", "160:1 ROI")
   - Time savings quantified
   - Resource optimization results
   - Comparative analysis data

   **Tool Integration Insights**:
   - MCP server usage patterns
   - Claude Flow coordination discoveries
   - Serena MCP capabilities
   - Context7 research patterns

   **Quality Improvements**:
   - New validation patterns
   - Error prevention mechanisms
   - Code review integration insights
   - Testing coverage strategies

   **Cross-Project Learnings**:
   - Multi-repo coordination patterns
   - Type synchronization insights
   - Backend-mobile integration discoveries
   - Coordination system improvements

4. **Analyze Commit Content**
   - Read commit diffs for context-rich commits
   - Extract code pattern improvements
   - Identify architectural decisions
   - Document problem-solution pairs

---

### Phase 3: Learning Categorization

**Objective**: Organize discoveries into actionable documentation updates

**Categories**:

1. **AADF Framework Updates**
   - Core methodology changes
   - New framework capabilities
   - Philosophy evolution
   - Architecture improvements

2. **Project-Specific Learnings**
   - Mobile app development patterns
   - React Native + Expo insights
   - Supabase integration patterns
   - Offline-first architecture learnings

3. **Tool & Technology Insights**
   - MCP server capabilities
   - Agent specialization patterns
   - IDE integration discoveries
   - Testing tool comparisons

4. **Process & Workflow Improvements**
   - Development velocity enhancements
   - Quality gate refinements
   - Coordination protocol improvements
   - Documentation strategies

5. **Measurable Outcomes**
   - ROI calculations
   - Time savings quantified
   - Efficiency improvements
   - Quality metrics

**Categorization Logic**:
- Each learning may belong to multiple categories
- Prioritize by impact and reusability
- Flag high-value patterns for immediate documentation
- Identify cross-cutting concerns

---

### Phase 4: Documentation Updates

**Objective**: Update framework and learning documents with discovered insights

**Steps**:

1. **Update AADF Framework Document**
   - Location: `project-context/learnings/ai-agentic-development-framework.md`
   - Actions:
     - Increment version number (semantic versioning)
     - Add changelog entry with commit range analyzed
     - Update relevant sections with new patterns
     - Add new sections if warranted
     - Update cross-references

2. **Create New Learning Documents**
   - Location: `project-context/learnings/`
   - Naming: `<topic>-<type>-<date>.md` (e.g., `typescript-error-triage-workflow-2025-10.md`)
   - Structure:
     - **Title & Date**: Clear identification
     - **Context**: Why this learning matters
     - **Discovery**: What was learned
     - **Evidence**: Commit references, metrics, examples
     - **Application**: How to apply the learning
     - **Related Learnings**: Cross-references

3. **Update Philosophical Foundations** (if applicable)
   - Location: `project-context/learnings/philosophical-foundations-aadf.md`
   - Update epistemological or ontological insights
   - Add applied philosophy examples
   - Document cognitive framework evolution

4. **Update Cross-References**
   - Update CLAUDE.md if framework changes affect workflow
   - Update agent-reference.md if agent patterns evolved
   - Update command-examples.md with new patterns
   - Ensure bidirectional linking between documents

5. **Maintain Document Integrity**
   - Verify all internal links work
   - Ensure consistent formatting
   - Update table of contents if needed
   - Check for duplicate content

---

### Phase 5: Output Report

**Objective**: Provide comprehensive summary of analysis and updates

**Report Structure**:

```markdown
# AADF Learning Discovery Report
**Generated**: <timestamp>
**Analysis Period**: <start-date> to <end-date>
**Focus Area**: <parameter-specified-focus OR "comprehensive">

## Analysis Summary
- **Commits Analyzed**: X commits
- **Commit Types**: <type-distribution>
- **Top Scopes**: <scope-list>
- **Date Range**: YYYY-MM-DD to YYYY-MM-DD

## Learnings Identified
### Framework Evolution (X learnings)
- [List with commit references]

### Methodology Discoveries (Y learnings)
- [List with commit references]

### Performance Metrics (Z learnings)
- [List with measurements and commit references]

### Tool Integration Insights (N learnings)
- [List with commit references]

### Quality Improvements (M learnings)
- [List with commit references]

### Cross-Project Learnings (K learnings)
- [List with commit references]

## Documentation Updates
- **AADF Framework**: <version-old> → <version-new>
  - Changelog: <summary>
  - Sections Updated: <list>
- **New Learning Documents**: <count>
  - [List of new files created]
- **Updated Cross-References**: <count>
  - [List of files updated]

## High-Value Patterns
### Pattern 1: <name>
- **Evidence**: <commits>
- **Impact**: <quantified-benefit>
- **Application**: <how-to-use>
- **Documented In**: <file-path>

### Pattern 2: <name>
[Repeat structure]

## Metrics & ROI
- **Time Saved**: <quantified>
- **Efficiency Gains**: <percentages>
- **Quality Improvements**: <metrics>
- **Framework Maturity**: <assessment>

## Suggested Follow-Ups
1. [Action item with priority]
2. [Action item with priority]
3. [Action item with priority]

## Commit References
<table-of-analyzed-commits>

---
*Report generated by /aadf-update-learnings command*
*Framework Version: <version>*
```

**Report Location**: `project-context/learnings/reports/learning-discovery-<date>.md`

---

## Allowed Tools

### Primary Tools
- **Read**: Read existing learning documents, AADF framework, commit messages
- **Write**: Create new learning documents, reports
- **Edit**: Update existing AADF framework, learning documents
- **Bash**: Git operations only (`git log`, `git show`, `git diff`)
- **Glob**: Find learning documents, search for patterns
- **Grep**: Search for learning indicators in codebase

### MCP Tools (Serena)
- **mcp__serena__search_for_pattern**: Find code patterns referenced in commits
- **mcp__serena__get_symbols_overview**: Analyze code structure changes
- **mcp__serena__read_memory**: Retrieve previous learning context
- **mcp__serena__write_memory**: Store analysis state for future runs

### Prohibited Tools
- **WebSearch**: Not needed for git history analysis
- **WebFetch**: Not needed for local git operations
- **File system modifications**: Beyond learnings directory

---

## Quality Gates

### Pre-Execution Validation
1. **Git Repository Check**: Verify we're in a valid git repository
2. **Framework File Exists**: Check for `ai-agentic-development-framework.md`
3. **Learnings Directory Exists**: Ensure `project-context/learnings/` is present
4. **Parameter Validation**: Verify parameter format is valid

### During Execution
1. **Commit Analysis Completeness**: Ensure all commits in range are processed
2. **Pattern Recognition Accuracy**: Validate learning extraction logic
3. **Categorization Consistency**: Ensure learnings are properly categorized
4. **Cross-Reference Integrity**: Verify all links are valid

### Post-Execution Validation
1. **Framework Version Incremented**: Verify semantic version bump
2. **Changelog Updated**: Ensure changelog reflects changes
3. **Cross-References Work**: Test all internal links
4. **Conventional Commit Compliance**: Verify analysis follows standards
5. **Documentation Quality**: Check formatting, clarity, completeness
6. **Duplicate Prevention**: Ensure no duplicate content created

### Success Criteria
- All identified learnings documented
- Framework version properly incremented
- Report generated with actionable insights
- No broken cross-references
- New documents follow naming conventions
- Commit references are accurate and complete

---

## Error Handling

### Common Errors

**No Commits Found**:
```markdown
**Issue**: No commits in specified date range
**Resolution**:
- Adjust date range
- Check if git repository is up to date
- Verify branch is correct
```

**AADF Framework Not Found**:
```markdown
**Issue**: Framework document missing
**Resolution**:
- Create framework document if this is first run
- Verify correct project directory
- Check CLAUDE.md for framework location
```

**Merge Conflicts**:
```markdown
**Issue**: Simultaneous updates to framework
**Resolution**:
- Resolve conflicts manually
- Re-run command after resolution
- Document conflict in changelog
```

**Invalid Parameter**:
```markdown
**Issue**: Parameter format not recognized
**Resolution**:
- Show usage examples
- Parse parameter more flexibly
- Default to comprehensive analysis
```

---

## Usage Examples

### Example 1: Default Analysis
```bash
/aadf-update-learnings
```
**Behavior**: Analyzes all commits since last AADF framework update

---

### Example 2: Focused Analysis
```bash
/aadf-update-learnings "focus on dashboard development and coordination patterns"
```
**Behavior**: Analyzes commits but emphasizes dashboard and coordination learnings

---

### Example 3: Date-Range Analysis
```bash
/aadf-update-learnings "since 2025-10-15"
```
**Behavior**: Analyzes all commits from October 15, 2025 onwards

---

### Example 4: Instruction File
```bash
/aadf-update-learnings "@project-context/instructions/learning-extraction-rules.md"
```
**Behavior**: Reads instruction file and applies custom extraction logic

---

### Example 5: Multi-Criteria Focus
```bash
/aadf-update-learnings "focus on: TypeScript patterns, MCP integration, performance metrics, testing improvements"
```
**Behavior**: Analyzes with multiple focus areas for comprehensive but targeted extraction

---

## Integration with AADF Framework

### Framework Evolution Tracking
- Each run increments framework version
- Changelog documents commit ranges analyzed
- Learning density metrics tracked over time
- Framework maturity assessment updated

### Cross-Project Application
- Patterns identified here can be exported to other projects
- Generic patterns flagged for `create-aadf-app` inclusion
- Project-specific insights kept separate from framework core

### Continuous Improvement Loop
```
Development → Commits → /aadf-update-learnings → Framework Updates → Better Development
```

---

## Performance Expectations

### Analysis Speed
- **Small range** (1-10 commits): < 30 seconds
- **Medium range** (10-50 commits): 1-3 minutes
- **Large range** (50-200 commits): 3-10 minutes
- **Very large range** (200+ commits): 10-30 minutes

### Output Quality
- **Learning Coverage**: 95%+ of high-value patterns identified
- **Categorization Accuracy**: 90%+ correctly categorized
- **Documentation Completeness**: All learnings have context + evidence
- **Cross-Reference Integrity**: 100% of links valid

---

## Maintenance & Evolution

### Command Self-Improvement
- This command analyzes commits that may improve this command
- Self-referential learning loop
- Command should suggest improvements to itself in reports

### Version History
- **v1.0**: Initial implementation (created <date>)
- Track command improvements in changelog
- Document command-specific learnings

---

## Related Commands

- `/aadf-work-smart`: Uses framework patterns for intelligent task orchestration
- `/aadf-commit`: Creates commits that this command will analyze
- `/aadf-prompt-file`: Can execute learning extraction instructions
- `/aadf-check-x-project-message`: Cross-project coordination insights

---

## Success Metrics

### Quantifiable Outcomes
- **Framework Growth Rate**: New sections/patterns per run
- **Learning Density**: Learnings per commit analyzed
- **Documentation Quality**: Completeness score (context + evidence + application)
- **Reusability Score**: How many learnings apply to other projects

### Qualitative Indicators
- Framework becomes more comprehensive over time
- Development velocity improves from documented patterns
- Fewer repeated mistakes due to captured learnings
- Better onboarding for new developers via living documentation

---

*Command Version: 1.0*
*Created: 2025-10-29*
*Last Updated: 2025-10-29*
*Framework Integration: AADF v2.0+*
