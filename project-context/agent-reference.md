# Claude Flow Agent Reference

## Available Agents (54 Total)

### Core Development
- `coder` - Implementation specialist for writing clean, efficient code
- `reviewer` - Code review and quality assurance specialist
- `tester` - Comprehensive testing and quality assurance specialist
- `planner` - Strategic planning and task orchestration agent
- `researcher` - Deep research and information gathering specialist

### Swarm Coordination
- `hierarchical-coordinator` - Queen-led hierarchical swarm coordination with specialized worker delegation
- `mesh-coordinator` - Peer-to-peer mesh network swarm with distributed decision making and fault tolerance
- `adaptive-coordinator` - Dynamic topology switching coordinator with self-organizing swarm patterns and real-time optimization
- `collective-intelligence-coordinator` - Neural center orchestrating collective decision-making and shared intelligence
- `swarm-memory-manager` - Distributed memory coordination and optimization specialist

### Consensus & Distributed Systems
- `byzantine-coordinator` - Coordinates Byzantine fault-tolerant consensus protocols with malicious actor detection
- `raft-manager` - Manages Raft consensus algorithm with leader election and log replication
- `gossip-coordinator` - Coordinates gossip-based consensus protocols for scalable eventually consistent systems
- `consensus-builder` - Byzantine fault-tolerant consensus and voting mechanism specialist
- `crdt-synchronizer` - Implements Conflict-free Replicated Data Types for eventually consistent state synchronization
- `quorum-manager` - Implements dynamic quorum adjustment and intelligent membership management
- `security-manager` - Implements comprehensive security mechanisms for distributed consensus protocols

### Performance & Optimization
- `perf-analyzer` - Performance bottleneck analyzer for identifying and resolving workflow inefficiencies
- `performance-benchmarker` - Implements comprehensive performance benchmarking for distributed consensus protocols
- `task-orchestrator` - Central coordination agent for task decomposition, execution planning, and result synthesis
- `memory-coordinator` - Manage persistent memory across sessions and facilitate cross-agent memory sharing
- `smart-agent` - Intelligent agent coordination and dynamic spawning specialist

### GitHub & Repository Management
- `github-modes` - Comprehensive GitHub integration modes for workflow orchestration, PR management, and repository coordination with batch optimization
- `pr-manager` - Comprehensive pull request management with swarm coordination for automated reviews, testing, and merge workflows
- `swarm-pr` - Pull request swarm management agent that coordinates multi-agent code review, validation, and integration workflows with automated PR lifecycle management
- `code-review-swarm` - Deploy specialized AI agents to perform comprehensive, intelligent code reviews that go beyond traditional static analysis
- `issue-tracker` - Intelligent issue management and project coordination with automated tracking, progress monitoring, and team coordination
- `release-manager` - Automated release coordination and deployment with ruv-swarm orchestration for seamless version management, testing, and deployment across multiple packages
- `release-swarm` - Orchestrate complex software releases using AI swarms that handle everything from changelog generation to multi-platform deployment
- `workflow-automation` - GitHub Actions workflow automation agent that creates intelligent, self-organizing CI/CD pipelines with adaptive multi-agent coordination and automated optimization
- `project-board-sync` - Synchronize AI swarms with GitHub Projects for visual task management, progress tracking, and team coordination
- `repo-architect` - Repository structure optimization and multi-repo management with ruv-swarm coordination for scalable project architecture and development workflows
- `multi-repo-swarm` - Cross-repository swarm orchestration for organization-wide automation and intelligent collaboration
- `swarm-issue` - GitHub issue-based swarm coordination agent that transforms issues into intelligent multi-agent tasks with automatic decomposition and progress tracking
- `sync-coordinator` - Multi-repository synchronization coordinator that manages version alignment, dependency synchronization, and cross-package integration with intelligent swarm orchestration

### SPARC Methodology
- `sparc-coord` - SPARC methodology orchestrator for systematic development phase coordination
- `sparc-coder` - Transform specifications into working code with TDD practices
- `specification` - SPARC Specification phase specialist for requirements analysis
- `pseudocode` - SPARC Pseudocode phase specialist for algorithm design
- `architecture` - SPARC Architecture phase specialist for system design
- `refinement` - SPARC Refinement phase specialist for iterative improvement

### Specialized Development
- `backend-dev` - Specialized agent for backend API development, including REST and GraphQL endpoints
- `mobile-dev` - Expert agent for React Native mobile application development across iOS and Android
- `ml-developer` - Specialized agent for machine learning model development, training, and deployment
- `cicd-engineer` - Specialized agent for GitHub Actions CI/CD pipeline creation and optimization
- `api-docs` - Expert agent for creating and maintaining OpenAPI/Swagger documentation
- `system-architect` - Expert agent for system architecture design, patterns, and high-level technical decisions
- `code-analyzer` - Advanced code quality analysis agent for comprehensive code reviews and improvements
- `base-template-generator` - Use when you need to create foundational templates, boilerplate code, or starter configurations for new projects, components, or features
- `react-native-expo-architect` - Expert guidance on React Native with TypeScript and Expo development, including architecture design, performance optimization, security implementation
- `supabase-edge-function-generator` - Create, modify, or optimize Supabase Edge Functions for serverless backend operations
- `supabase-schema-manager` - Manage Supabase database schema using declarative schema management

### Testing & Validation
- `tdd-london-swarm` - TDD London School specialist for mock-driven development within swarm coordination
- `production-validator` - Production validation specialist ensuring applications are fully implemented and deployment-ready

### Migration & Planning
- `migration-planner` - Comprehensive migration plan for converting commands to agent-based system
- `swarm-init` - Swarm initialization and topology optimization specialist

### Project Context Management
- `project-context-manager` - Access, understand, or manage information in the project-context folder including migration plans, development execution plans, or any project-specific documentation

### Cross-Project Coordination
#### cross-project-coordinator
**Purpose**: Coordinate between Wildlife Watcher mobile and backend repositories

**When to Use**:
- After receiving coordination messages from backend team
- When backend schema changes require type regeneration
- For task requests from backend team
- For deployment/milestone status updates

**Capabilities**:
- Reads and parses coordination messages
- Executes type synchronization workflows
- Creates coordination messages for backend team
- Archives processed messages
- Logs coordination activity
- Validates type drift prevention

**Example Invocations**:
```bash
# Check inbox and action schema-change messages
/aadf-work-smart "Check coordination inbox and action schema-change message"

# Create coordination message for backend
/aadf-work-smart "Create coordination message notifying backend of mobile deployment"

# Verify type sync status
/aadf-work-smart "Verify mobile types are in sync with backend schema"
```

**Documentation**:
- Quick Start: `~/dev/wildlifeai/cross-project-coordination/COORDINATION-QUICK-START.md`
- Type Sync: `~/dev/wildlifeai/cross-project-coordination/TYPE-SYNC-GUIDE.md`
- System Reference: `~/dev/wildlifeai/cross-project-coordination/SYSTEM-REFERENCE-GUIDE.md`

### Frontend & Design
- `frontend-design-expert` - Expert guidance on frontend development, UI/UX design, modern web technologies, design systems, accessibility, performance optimization

### Output & Configuration
- `statusline-setup` - Configure the user's Claude Code status line setting
- `output-style-setup` - Create a Claude Code output style

### General Purpose
- `general-purpose` - General-purpose agent for researching complex questions, searching for code, and executing multi-step tasks

## Agent Selection Guidelines

### When to Use Specialized Agents:
1. **Complex Tasks**: Use specialized agents for domain-specific work
2. **Parallel Work**: Spawn multiple agents for concurrent operations
3. **Code Quality**: Use review/analysis agents after implementation
4. **Architecture**: Use architect agents before major implementations
5. **Testing**: Use TDD agents for test-first development

### Agent Coordination Patterns:
- **Sequential**: One agent completes before next starts
- **Parallel**: Multiple agents work simultaneously
- **Hierarchical**: Coordinator manages worker agents
- **Mesh**: Agents collaborate peer-to-peer
- **Adaptive**: Topology changes based on task needs