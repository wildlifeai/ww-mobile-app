# Orchestration Protocol

High-level orchestration guides for cross-project workflows.

## Contents

- **CROSS-PROJECT-ORCHESTRATION-GUIDE.md** - Comprehensive guide to orchestrating cross-repository coordination

## Key Concepts

- **Parallel Execution**: Tracks 1-3 run simultaneously, Track 4 sequential
- **Agent-Based Coordination**: Specialized agents for mobile, backend, docs
- **Dependency Management**: Clear intra-track and cross-track dependencies
- **Quality Gates**: Validation at each coordination checkpoint

## Orchestration Patterns

- **Schema Change Flow**: Backend migration → notification → mobile type update → validation
- **Feature Development**: Parallel backend/mobile work with synchronization points
- **Release Coordination**: Backend deployment → mobile compatibility verification → mobile deployment

---

See parent README: [../README.md](../README.md)
