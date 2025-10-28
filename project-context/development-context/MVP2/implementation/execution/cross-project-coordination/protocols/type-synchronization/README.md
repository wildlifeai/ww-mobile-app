# Type Synchronization Protocol

Protocols and guides for maintaining type consistency between backend and mobile repositories.

## Contents

- **local-dev-sync-workflow.md** - Daily workflow for local development type synchronization
- **typescript-cross-repo-sync-best-practices-2025.md** - Best practices for cross-repository type management
- **Backend-Mobile-Type-Synchronization-Guide.md** - Comprehensive guide to type synchronization infrastructure

## Key Concepts

- **Type Generation**: Automated generation from Supabase schema
- **Git Hooks**: Pre-commit validation preventing stale types
- **GitHub Actions**: CI/CD validation blocking PR merges on type drift
- **Local Workflow**: 3-second type regeneration with `npm run types:local`

## Success Metrics

- 80% coverage via git hooks
- 95% coverage with CI/CD validation
- 160:1 ROI (15 min setup → 40 hours saved annually)

---

See parent README: [../README.md](../README.md)
