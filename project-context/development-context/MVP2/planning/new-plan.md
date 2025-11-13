> help me improve this prompt:
  There have been several things I have been working on in parallel and I need help to oragnise and re-plan it into a strtcurre, emart approach to execute. These activities include Requirements Changes,
Code review based refacoring and current work on Stream A - Tasks 12 -14, amongst others, as per @project-context/development-context/MVP2/implementation/execution/MVP2-MASTER-EXECUTION-PLAN.md and
  @project-context/development-context/MVP2/implementation/tasks/. The plan and task have been derived from  @project-context/development-context/MVP2/implementation-spec-v1.4.md. Please check the relevant
project status document(s)
  etc. to understand where we have got to, including @project-context/development-context/MVP2/implementation/execution/MVP2-METRICS-TRACKER.md. For the code review see docusments in the
@project-context/code-review/ folder to understand what these are and current status. Furthermore, recenty stakeholders have made recent  refinements and requirements changes that will impact our current
specification, master plan and tasks. the documents are the in mobile git repo at @project-context/development-context/documentation-cleanup.

  The stakeholder requirements review/refinements is based on @project-context/development-context/documentation-cleanup/WILDLIFE-WATCHER-APP-STAKEHOLDER-OVERVIEW.md, high llevel based on
project-context/development-context/MVP2/implementation-spec-v1.4.md. The stakeholders have used that as the starting point and create anew document foe their desiered end state for MVP2 see
@project-context/development-context/documentation-cleanup/WILDLIFE-WATCHER-APP-STAKEHOLDER-OVERVIEW-GOAL.md. The folder also contains supporting documents realted to the end state goals that go into
further details as specific features. based on this we have started some design work - in the backend Git repo we have created an updated dbml in the backend repo
((/home/adarsh/dev/wildlifeai/wildlife-watcher-backend/dbml/mvp2-revised.md) and compared it the the current state of the backend databse
(/home/adarsh/dev/wildlifeai/wildlife-watcher-backend/dbml/mvp2-schema-current/wildlife-watcher-mvp2-schema.dbml) - a comaprision of the two was documented in
/home/adarsh/dev/wildlifeai/wildlife-watcher-backend/dbml/SCHEMA-COMPARISON-MVP2-REVISED.md.

  So, i need to know a smart way to merge and order these into the current plan, in a smart efficient way (AADF Framework). So far we have completed tasks 1 - 13. I need to know whoch of these tasks will be
 impacted and how. Also, pending tasks 14 - 23 will likely need some updates and modifications, so i also need to know how and what.

  So we are convergeing and handling code review, refactor, requirements/spec chnages and impact on completed and future task ending up with a revised plan of attack.
  ⎿  Read project-context/development-context/MVP2/implementation/execution/MVP2-MASTER-EXECUTION-PLAN.md (1362 lines)
  ⎿  Listed directory project-context/development-context/MVP2/implementation/tasks/
  ⎿  Read project-context/development-context/MVP2/implementation-spec-v1.4.md (1725 lines)
  ⎿  Read project-context/development-context/MVP2/implementation/execution/MVP2-METRICS-TRACKER.md (1265 lines)
  ⎿  Listed directory project-context/code-review/
  ⎿  Listed directory project-context/development-context/documentation-cleanup/
  ⎿  Read project-context/development-context/documentation-cleanup/WILDLIFE-WATCHER-APP-STAKEHOLDER-OVERVIEW.md (2010 lines)
  ⎿  Read project-context/development-context/documentation-cleanup/WILDLIFE-WATCHER-APP-STAKEHOLDER-OVERVIEW-GOAL.md (2095 lines)

● I'll help you improve this prompt by making it clearer, more structured, and actionable. Here's a refined version:

  ---
  Refined Prompt: MVP2 Project Convergence & Reorganization

  Context

  We have three parallel workstreams that need to converge into a unified, revised execution plan:

  1. Requirements Changes: Stakeholder refinements to MVP2 scope
  2. Code Review Refactoring: Technical debt and architecture improvements identified
  3. Active Development: Stream A (Tasks 12-14) in progress

  Current State Assessment

  Completed Work (Tasks 1-13):

- Location: @project-context/development-context/MVP2/implementation/execution/MVP2-METRICS-TRACKER.md
- Status: Need impact analysis from requirements changes

  Pending Work (Tasks 14-23):

- Location: @project-context/development-context/MVP2/implementation/tasks/
- Status: Need revision based on new requirements

  Current Plan:

- Master Plan: @project-context/development-context/MVP2/implementation/execution/MVP2-MASTER-EXECUTION-PLAN.md
- Original Spec: @project-context/development-context/MVP2/implementation-spec-v1.4.md

  Requirements Changes Analysis

  Stakeholder Documents (in @project-context/development-context/documentation-cleanup/):

  1. Baseline: WILDLIFE-WATCHER-APP-STAKEHOLDER-OVERVIEW.md (current state based on implementation-spec-v1.4.md)
  2. Target State: WILDLIFE-WATCHER-APP-STAKEHOLDER-OVERVIEW-GOAL.md (desired MVP2 end state)
  3. Supporting Details: Additional feature-specific documents in same folder

  Backend Schema Impact (in backend repo /home/adarsh/dev/wildlifeai/wildlife-watcher-backend/dbml/):

- Current Schema: mvp2-schema-current/wildlife-watcher-mvp2-schema.dbml
- Revised Schema: mvp2-revised.md
- Gap Analysis: SCHEMA-COMPARISON-MVP2-REVISED.md

  Code Review Findings

- Location: @project-context/code-review/
- Status: Needs integration into revised plan

  Deliverables Requested

  Using AADF Framework, provide:

  1. Impact Analysis Report:
    - Which of Tasks 1-13 (completed) are affected by requirements changes?
    - What rework/refactoring is needed for completed tasks?
    - How do code review findings intersect with requirements changes?
  2. Task Revision Plan:
    - Which of Tasks 14-23 (pending) need modification?
    - What specific changes are needed per task?
    - New tasks required to bridge gaps between current and goal state?
  3. Unified Execution Strategy:
    - Optimal sequencing: code review fixes → requirement updates → new development
    - Parallel execution opportunities (what can be done simultaneously?)
    - Risk mitigation for convergence (avoiding rework)
  4. Revised Master Plan:
    - Updated MVP2-MASTER-EXECUTION-PLAN.md structure
    - New timeline estimates
    - Quality gates and validation checkpoints
    - Backend-mobile coordination touchpoints

  Analysis Approach

  Phase 1: Discovery (use Plan agent):

  1. Compare stakeholder OVERVIEW.md vs OVERVIEW-GOAL.md → document delta
  2. Review SCHEMA-COMPARISON-MVP2-REVISED.md → extract breaking changes
  3. Analyze code-review/ folder → categorize findings by severity
  4. Review MVP2-METRICS-TRACKER.md → understand actual vs planned state

  Phase 2: Impact Assessment:

  1. Map requirements delta → affected tasks (1-23)
  2. Map schema changes → affected mobile components
  3. Map code review findings → refactoring priorities
  4. Identify conflicts/synergies between the three workstreams

  Phase 3: Strategy Formulation:

  1. Sequence operations for minimal rework (AADF principle)
  2. Identify parallel execution paths
  3. Define validation gates (prevent drift)
  4. Estimate effort (hours) for convergence work

  Phase 4: Plan Generation:

  1. Revised task breakdown (numbered, sequenced)
  2. Updated timeline with milestones
  3. Cross-project coordination requirements
  4. Success metrics and quality gates

  Constraints & Preferences

- Framework: AADF (AI Agentic Development Framework)
- Methodology: Evidence-based, parallel execution where possible
- Priority: Minimize rework, maximize efficiency
- Output: Actionable, detailed, ready to execute

  ---
  Key Improvements Made:

  1. Clear Structure: Organized into logical sections (Context → State → Changes → Deliverables → Approach)
  2. Explicit Deliverables: 4 specific outputs you need
  3. Phased Approach: 4-phase execution strategy
  4. Document References: Organized by category with clear paths
  5. Action-Oriented: Focus on "what to do" not just "what happened"
  6. AADF Integration: Explicitly calls out framework usage
  7. Constraints: Added missing project constraints

  Would you like me to execute this refined prompt, or would you like to make adjustments first?
