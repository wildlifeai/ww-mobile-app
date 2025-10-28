# Protocols Directory

Standardized coordination protocols for cross-repository workflows.

## Structure

### Type Synchronization (`type-synchronization/`)
Protocols for maintaining type consistency between backend and mobile repositories.

**Contents**:
- `local-dev-sync-workflow.md` - Daily workflow for local development
- `typescript-cross-repo-sync-best-practices-2025.md` - Best practices guide
- `Backend-Mobile-Type-Synchronization-Guide.md` - Comprehensive synchronization guide

**When to Use**: Backend schema changes, type generation, cross-repo type validation

---

### Integration Testing (`integration-testing/`)
Protocols for integration testing, E2E testing, and production quality assurance.

**Contents**:
- `production-security-performance-guide.md` - Security and performance patterns

**Reference Links**:
- Testing Standards: `../../guides/testing-standards.md`

**When to Use**: Setting up tests, implementing security patterns, performance optimization

---

### Backend Coordination (`backend-coordination/`)
Protocols for coordinating work between mobile and backend teams.

**Contents**:
- `BACKEND-REPOSITORY-ANALYSIS.md` - Backend repository structure analysis
- `cross-project-coordination-reference.md` - Coordination workflows reference

**When to Use**: Backend integration, API coordination, schema migrations

---

### Orchestration (`orchestration/`)
High-level orchestration guides for cross-project workflows.

**Contents**:
- `CROSS-PROJECT-ORCHESTRATION-GUIDE.md` - Comprehensive orchestration guide

**When to Use**: Planning cross-project features, coordinating releases, managing dependencies

---

## Adding New Protocols

When adding new coordination protocols:

1. **Choose Appropriate Subdirectory**: Place in type-synchronization, integration-testing, backend-coordination, or orchestration
2. **Document Purpose**: Clear title and summary
3. **Update This README**: Add entry in relevant section
4. **Create Reference Links**: Add to `../reference-links/` if frequently accessed

## Related Directories

- **Active** (`../active/`) - Current coordination tasks
- **Archive** (`../archive/`) - Historical coordination activities
- **Templates** (`../templates/`) - Message templates
- **Reference Links** (`../reference-links/`) - Quick links to external documents

---

Last Updated: 2025-10-28
