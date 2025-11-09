# Claude Code Agents Directory Structure

This directory contains sub-agent definitions organized by type and purpose. Each agent has specific capabilities, tool restrictions, and naming conventions that trigger automatic delegation.

## Directory Structure

```
.claude/agents/
├── README.md                    # This file
├── _templates/                  # Agent templates
│   ├── base-agent.yaml
│   └── agent-types.md
├── coordination/                # Coordination agents (NEW)
│   └── ww-aadf-coordinator.md  # Dynamic project coordination
├── development/                 # Development agents
│   ├── backend/
│   ├── frontend/
│   ├── fullstack/
│   └── api/
├── testing/                     # Testing agents
│   ├── unit/
│   ├── integration/
│   ├── e2e/
│   └── performance/
├── architecture/                # Architecture agents
│   ├── system-design/
│   ├── database/
│   ├── cloud/
│   └── security/
├── devops/                      # DevOps agents
│   ├── ci-cd/
│   ├── infrastructure/
│   ├── monitoring/
│   └── deployment/
├── documentation/               # Documentation agents
│   ├── api-docs/
│   ├── user-guides/
│   ├── technical/
│   └── readme/
├── analysis/                    # Analysis agents
│   ├── code-review/
│   ├── performance/
│   ├── security/
│   └── refactoring/
├── data/                        # Data agents
│   ├── etl/
│   ├── analytics/
│   ├── ml/
│   └── visualization/
└── specialized/                 # Specialized agents
    ├── mobile/
    ├── embedded/
    ├── blockchain/
    └── ai-ml/
```

## Naming Conventions

Agent files follow this naming pattern:
`[type]-[specialization]-[capability].agent.yaml`

Examples:
- `dev-backend-api.agent.yaml`
- `test-unit-jest.agent.yaml`
- `arch-cloud-aws.agent.yaml`
- `docs-api-openapi.agent.yaml`

## Automatic Delegation Triggers

Claude Code automatically delegates to agents based on:
1. **Keywords in user request**: "test", "deploy", "document", "review"
2. **File patterns**: `*.test.js` → testing agent, `*.tf` → infrastructure agent
3. **Task complexity**: Multi-step tasks spawn coordinator agents
4. **Domain detection**: Database queries → data agent, API endpoints → backend agent

## Tool Restrictions

Each agent type has specific tool access:
- **Development agents**: Full file system access, code execution
- **Testing agents**: Test runners, coverage tools, limited write access
- **Architecture agents**: Read-only access, diagram generation
- **Documentation agents**: Markdown tools, read access, limited write to docs/
- **DevOps agents**: Infrastructure tools, deployment scripts, environment access
- **Analysis agents**: Read-only access, static analysis tools
- **Coordination agents**: Full coordination hub access, message sending, inbox monitoring

## Wildlife Watcher AADF Specialized Agents

### Coordination Agents

**ww-aadf-coordinator** (`coordination/ww-aadf-coordinator.md`)
- **Purpose**: Large-scale coordinated projects with milestone-based execution
- **Use Cases**:
  - Projects with 3+ coordinated tasks across mobile and backend teams
  - Milestone-based workflows (Local → Cloud-Dev → Preview → Stakeholder)
  - Deployment orchestration between teams
  - Task dependency management and parallel execution
  - Session recovery for projects exceeding 200k token context
- **Capabilities**:
  - Project initialization and master plan management
  - Project-specific inbox monitoring and message routing
  - Milestone validation (Development → Preview → Completion phases)
  - Deployment sequencing (backend before mobile)
  - Stakeholder feedback collection and triage
  - Session state snapshots and continuation prompts
- **System**: Dynamic Cross-Project Coordination System
- **Location**: `~/dev/wildlifeai/cross-project-coordination/projects/`
- **Documentation**: `QUICK-START-DYNAMIC-COORDINATION.md`, `DYNAMIC-PROJECT-COORDINATION-DESIGN.md`

**Coordination System Architecture**:

1. **Flat-Inbox System** (Day-to-Day Coordination)
   - Agent: `cross-project-coordinator.md` (existing)
   - Use: Simple schema changes, status updates, task requests
   - Location: `~/dev/wildlifeai/cross-project-coordination/inbox/`
   - Structure: `inbox/[sender]-to-[receiver]/`

2. **Dynamic System** (Large Coordinated Projects)
   - Agent: `ww-aadf-coordinator.md` (NEW)
   - Use: 3+ tasks, milestones, deployment coordination
   - Location: `~/dev/wildlifeai/cross-project-coordination/projects/`
   - Structure: Per-project folders with master plans, inboxes, milestones

**When to Use Which**:
- Use **cross-project-coordinator** for: Schema changes, simple task requests, status updates
- Use **ww-aadf-coordinator** for: MVP2 Tranche 1 Foundation, BLE DFU integration, Auth redesign, API migrations

**Key Difference**:
- **cross-project-coordinator**: Flat inbox (`inbox/backend-to-mobile/`), no project context
- **ww-aadf-coordinator**: Project-isolated (`projects/mvp2-tranche1/inboxes/mobile/`), milestone tracking