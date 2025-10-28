# 🎨 Visual System Overview: Cross-Repository Coordination

This document provides visual representations of the coordination system to help understand its architecture and workflows.

---

## 📐 System Architecture

### High-Level Component View

```mermaid
graph TB
    subgraph "Developer Workstation"
        HUB[Cross-Project Coordination Hub<br/>~/dev/wildlifeai/cross-project-coordination/]

        subgraph "Repositories"
            MOBILE[Mobile App<br/>Repository]
            BACKEND[Backend<br/>Repository]
            WEB[Web Portal<br/>Repository<br/>Future]
        end

        subgraph "Automation Services"
            WATCHER[File Watcher<br/>inotify/polling]
            NOTIFIER[Notification<br/>Manager]
            LOGGER[Activity<br/>Logger]
            METRICS[Metrics<br/>Collector]
        end
    end

    subgraph "External Systems"
        GH[GitHub Actions<br/>CI/CD]
        SUPABASE[Supabase<br/>Database]
    end

    MOBILE -->|symlink| HUB
    BACKEND -->|symlink| HUB
    WEB -->|symlink| HUB

    HUB --> WATCHER
    WATCHER --> NOTIFIER
    WATCHER --> LOGGER
    LOGGER --> METRICS

    HUB -->|type validation| GH
    BACKEND -->|schema changes| SUPABASE
    SUPABASE -->|type generation| MOBILE

    style HUB fill:#4a90e2,stroke:#2e5c8a,color:#fff
    style WATCHER fill:#50c878,stroke:#2d7a4d,color:#fff
    style GH fill:#f5a623,stroke:#c47f1a,color:#fff
```

---

## 🔄 Message Flow Diagram

### Complete Message Lifecycle

```mermaid
sequenceDiagram
    participant M as Mobile Dev
    participant H as Coord Hub
    participant W as File Watcher
    participant N as Notifier
    participant B as Backend Dev

    Note over M: 1. Need backend API
    M->>H: Create TASK_REQUEST message
    Note over M: Copy template, edit, save to inbox/

    H->>W: File created event
    Note over W: Detects new file<br/>within 1 second

    W->>W: Parse YAML frontmatter
    Note over W: Extract priority,<br/>recipient, type

    W->>N: Route notification
    Note over N: Check recipient:<br/>"backend"

    N->>B: Desktop notification
    Note over B: 🔔 HIGH priority<br/>Task Request from Mobile

    B->>H: Read message
    Note over B: Opens file from inbox/

    B->>H: Create acknowledgment
    Note over B: Copy status-update template

    H->>W: Acknowledgment detected
    W->>N: Notify mobile team
    N->>M: Acknowledgment received

    Note over B: 2. Implement API
    B->>B: Work on implementation

    B->>H: Daily status updates
    loop Every 1-2 days
        B->>H: STATUS_UPDATE message
        H->>W: Route to mobile
        W->>M: Progress notification
    end

    Note over B: 3. Complete & test
    B->>H: INTEGRATION_READY message
    H->>W: High priority routing
    W->>M: API ready notification

    M->>M: Integration testing
    M->>H: Completion confirmation

    H->>H: Move to archive/
    Note over H: Auto-archive after<br/>30 days
```

---

## 📊 Hub Directory Structure

### Detailed Folder Organization

```mermaid
graph LR
    ROOT[cross-project-coordination/]

    ROOT --> INBOX[📬 inbox/]
    ROOT --> ACTIVE[🔄 active/]
    ROOT --> STATUS[📊 status/]
    ROOT --> ACTION[🎯 action-items/]
    ROOT --> TEMPLATES[📝 templates/]
    ROOT --> KB[📚 knowledge-base/]
    ROOT --> METRICS[📈 metrics/]
    ROOT --> ARCHIVE[🗄️ archive/]
    ROOT --> CONFIG[🔧 .coordination/]

    INBOX --> I1[mobile-to-backend/]
    INBOX --> I2[backend-to-mobile/]
    INBOX --> I3[urgent/]

    ACTIVE --> A1[threads/]
    ACTIVE --> A2[tasks/in-progress/]
    ACTIVE --> A3[tasks/blocked/]
    ACTIVE --> A4[decisions/pending/]

    STATUS --> S1[daily/]
    STATUS --> S2[mobile-status.md]
    STATUS --> S3[backend-status.md]

    ACTION --> AC1[mobile/]
    ACTION --> AC2[backend/]
    ACTION --> AC3[shared/]

    TEMPLATES --> T1[task-request.md]
    TEMPLATES --> T2[status-update.md]
    TEMPLATES --> T3[schema-change.md]

    KB --> K1[api-contracts/]
    KB --> K2[type-definitions/]
    KB --> K3[architecture-decisions/]

    ARCHIVE --> AR1[2025/01/]
    ARCHIVE --> AR2[2025/02/]

    CONFIG --> C1[config.yaml]
    CONFIG --> C2[hooks/]
    CONFIG --> C3[logs/]

    style ROOT fill:#4a90e2,stroke:#2e5c8a,color:#fff
    style INBOX fill:#f5a623,stroke:#c47f1a,color:#fff
    style ACTIVE fill:#50c878,stroke:#2d7a4d,color:#fff
    style URGENT fill:#e74c3c,stroke:#a93226,color:#fff
```

---

## ⚡ Priority Escalation Flow

### How Messages Escalate Based on Priority

```mermaid
stateDiagram-v2
    [*] --> Created: Message Created

    Created --> CheckPriority: File Watcher Detects

    CheckPriority --> Urgent: Priority = URGENT
    CheckPriority --> High: Priority = HIGH
    CheckPriority --> Normal: Priority = NORMAL
    CheckPriority --> Low: Priority = LOW

    Urgent --> UrgentNotify: Immediate<br/>Desktop Alert + Sound
    UrgentNotify --> ActiveMove: Auto-move to active/
    ActiveMove --> EscalateUrgent: Start 1h timer

    High --> HighNotify: Desktop Alert
    HighNotify --> InboxStay: Keep in inbox/
    InboxStay --> EscalateHigh: Start 12h timer

    Normal --> NormalNotify: Desktop Notification
    NormalNotify --> InboxStayNormal: Keep in inbox/
    InboxStayNormal --> EscalateNormal: Start 48h timer

    Low --> LowLog: Log Only
    LowLog --> InboxStayLow: Keep in inbox/
    InboxStayLow --> EscalateLow: Start 1w timer

    EscalateUrgent --> CheckAck1: Timer expires?
    EscalateHigh --> CheckAck2: Timer expires?
    EscalateNormal --> CheckAck3: Timer expires?
    EscalateLow --> CheckAck4: Timer expires?

    CheckAck1 --> Acknowledged: Response received
    CheckAck2 --> Acknowledged: Response received
    CheckAck3 --> Acknowledged: Response received
    CheckAck4 --> Acknowledged: Response received

    CheckAck1 --> EscalateUp: No response
    CheckAck2 --> EscalateUp: No response
    CheckAck3 --> EscalateUp: No response
    CheckAck4 --> EscalateUp: No response

    EscalateUp --> NotifyAll: Escalate to ALL teams
    NotifyAll --> CheckAck1

    Acknowledged --> InProgress: Work started
    InProgress --> Completed: Work finished
    Completed --> Archive: Move to archive/
    Archive --> [*]

    InProgress --> Blocked: Dependency issue
    Blocked --> InProgress: Blocker resolved
```

---

## 🔐 Type Synchronization Flow

### Backend Schema → Mobile Types

```mermaid
sequenceDiagram
    participant BD as Backend Dev
    participant BG as Backend Git
    participant SB as Supabase Local
    participant HUB as Coord Hub
    participant MD as Mobile Dev
    participant MG as Mobile Git

    Note over BD: 1. Create migration
    BD->>BG: git add migration.sql

    BD->>BG: git commit
    Note over BG: Pre-commit hook runs

    BG->>SB: npm run db:types:update
    SB-->>BG: database.types.ts generated

    BG->>BG: Check if types changed
    alt Types changed
        BG->>HUB: Create SCHEMA_CHANGE message
        Note over HUB: Auto-generated from<br/>template
        BG->>BG: Stage database.types.ts
        BG->>BG: Commit proceeds
    end

    BG->>BG: Push to GitHub

    Note over HUB: File watcher detects<br/>SCHEMA_CHANGE
    HUB->>MD: 🔔 HIGH priority notification
    Note over MD: Backend schema changed!

    MD->>MG: git pull backend changes
    Note over MD: 2. Regenerate mobile types

    MD->>SB: npm run types:local
    Note over MD: Connects to same<br/>Supabase instance

    SB-->>MD: src/types/supabase.ts updated

    MD->>MG: git add src/types/supabase.ts

    MD->>MG: git commit
    Note over MG: Pre-commit hook checks<br/>types are current

    MG->>MG: Validation passes
    MG->>MG: Commit proceeds

    MD->>HUB: Send completion confirmation
    HUB->>BD: 🔔 Types synchronized

    Note over BD,MD: ✅ Type sync complete
```

---

## 🎯 Workflow: Schema Change Coordination

### Step-by-Step Backend Schema Change Process

```mermaid
flowchart TD
    START([Backend: Schema Change Needed]) --> CREATE[Create Migration SQL]
    CREATE --> TEST[Test Migration Locally]
    TEST --> GEN[Generate Types]
    GEN --> MSG[Create SCHEMA_CHANGE Message]

    MSG --> SEND{Send to Hub}
    SEND -->|Auto-detected| NOTIFY[Mobile: Receives Notification]

    NOTIFY --> ACK{Mobile Acknowledges?}
    ACK -->|Within 8 hours| REVIEW[Mobile: Review Changes]
    ACK -->|No Response| ESC[Escalate Priority]
    ESC --> NOTIFY

    REVIEW --> CONCERNS{Concerns or Questions?}
    CONCERNS -->|Yes| DISCUSS[Discussion Thread]
    DISCUSS --> RESOLVE{Resolved?}
    RESOLVE -->|No| REVISE[Backend: Revise Migration]
    REVISE --> CREATE
    RESOLVE -->|Yes| PROCEED

    CONCERNS -->|No| PROCEED[Proceed to Staging]

    PROCEED --> DEPLOY_STAGE[Backend: Deploy to Staging]
    DEPLOY_STAGE --> NOTIFY_STAGE[Notify Mobile: Staging Ready]

    NOTIFY_STAGE --> MOBILE_INT[Mobile: Integrate Changes]
    MOBILE_INT --> REGEN[Mobile: Regenerate Types]
    REGEN --> CODE[Mobile: Update Code]
    CODE --> TEST_INT[Mobile: Test Integration]

    TEST_INT --> WORKS{Tests Pass?}
    WORKS -->|No| DEBUG[Debug Issues]
    DEBUG --> BACKEND_FIX{Backend Fix Needed?}
    BACKEND_FIX -->|Yes| REVISE
    BACKEND_FIX -->|No| CODE

    WORKS -->|Yes| CONFIRM[Mobile: Confirm Completion]
    CONFIRM --> DEPLOY_PROD[Backend: Deploy to Production]
    DEPLOY_PROD --> VERIFY[Verify Production]

    VERIFY --> SUCCESS{All Working?}
    SUCCESS -->|Yes| COMPLETE([✅ Complete - Archive])
    SUCCESS -->|No| ROLLBACK[Emergency Rollback]
    ROLLBACK --> INVESTIGATE[Investigate & Fix]
    INVESTIGATE --> DEPLOY_PROD

    style START fill:#4a90e2,color:#fff
    style COMPLETE fill:#50c878,color:#fff
    style ESC fill:#e74c3c,color:#fff
    style ROLLBACK fill:#e74c3c,color:#fff
```

---

## 🚀 Quick Reference: Message Routing

### How the File Watcher Routes Messages

```mermaid
graph TD
    NEW[New Message Created] --> DETECT[File Watcher Detects]

    DETECT --> PARSE[Parse YAML Frontmatter]
    PARSE --> META{Extract Metadata}

    META --> PRIORITY[Priority Level]
    META --> TYPE[Message Type]
    META --> RECIPIENT[Recipient Team]
    META --> THREAD[Thread ID]

    RECIPIENT --> CHECK{Is for my team?}
    CHECK -->|Yes| NOTIFY[Send Notification]
    CHECK -->|No| LOG[Log Only]

    NOTIFY --> PRIO{Check Priority}
    PRIO -->|URGENT| CRITICAL[Critical Alert<br/>Sound + Desktop]
    PRIO -->|HIGH| HIGH_N[Desktop Alert]
    PRIO -->|NORMAL| NORM_N[Desktop Notification]
    PRIO -->|LOW| LOW_N[Log Entry]

    CRITICAL --> MOVE[Auto-move to active/]
    HIGH_N --> STAY[Stay in inbox/]
    NORM_N --> STAY
    LOW_N --> STAY

    MOVE --> TIMER[Start Escalation Timer]
    STAY --> TIMER

    TIMER --> WAIT{Response within SLA?}
    WAIT -->|Yes| ACK[Acknowledged]
    WAIT -->|No| ESCALATE[Escalate Priority]

    ESCALATE --> NOTIFY

    ACK --> WORK[Work Started]
    WORK --> UPDATE[Regular Status Updates]
    UPDATE --> COMPLETE[Work Completed]
    COMPLETE --> ARCHIVE[Move to Archive]

    style NEW fill:#4a90e2,color:#fff
    style CRITICAL fill:#e74c3c,color:#fff
    style ARCHIVE fill:#95a5a6,color:#fff
```

---

## 📱 Platform Support Matrix

### Cross-Platform Compatibility

```mermaid
graph LR
    COORD[Coordination System]

    COORD --> LINUX[Linux/WSL]
    COORD --> MACOS[macOS]
    COORD --> WINDOWS[Windows]

    LINUX --> L1[✅ inotify-tools<br/>Efficient file watching]
    LINUX --> L2[✅ notify-send<br/>Desktop notifications]
    LINUX --> L3[✅ bash scripts<br/>Native support]

    MACOS --> M1[✅ FSEvents<br/>Native file watching]
    MACOS --> M2[✅ osascript<br/>Desktop notifications]
    MACOS --> M3[✅ bash scripts<br/>Native support]

    WINDOWS --> W1[⚠️ Polling mode<br/>No inotify available]
    WINDOWS --> W2[✅ PowerShell<br/>Desktop notifications]
    WINDOWS --> W3[✅ bash/Git Bash<br/>Scripts work]

    style LINUX fill:#50c878,color:#fff
    style MACOS fill:#4a90e2,color:#fff
    style WINDOWS fill:#f5a623,color:#000
```

---

## 🔧 Automation Components

### System Services and Their Interactions

```mermaid
graph TB
    subgraph "Core Services"
        FW[File Watcher<br/>coordination-watch.sh]
        NM[Notification Manager]
        AL[Activity Logger]
        MC[Metrics Collector]
    end

    subgraph "Git Hooks"
        PC[Pre-commit Hook<br/>Type validation]
        PM[Post-merge Hook<br/>Migration detection]
    end

    subgraph "Data Storage"
        LOGS[Activity Logs<br/>activity.jsonl]
        METRICS[Metrics Data<br/>JSON files]
        ARCHIVE[Archive Index<br/>index.json]
    end

    subgraph "External Integrations"
        GHA[GitHub Actions<br/>Type validation]
        SLACK[Slack Webhooks<br/>Optional]
    end

    FW -->|Detects files| NM
    FW -->|Logs events| AL
    AL -->|Writes| LOGS
    AL -->|Updates| MC
    MC -->|Stores| METRICS

    PC -->|Checks types| FW
    PM -->|Notifies migrations| FW

    FW -->|Triggers| GHA
    NM -->|Posts| SLACK

    MC -->|Archives| ARCHIVE

    style FW fill:#4a90e2,color:#fff
    style NM fill:#50c878,color:#fff
    style AL fill:#f5a623,color:#000
```

---

## 📊 Metrics Dashboard (Conceptual)

### Key Performance Indicators

```
┌─────────────────────────────────────────────────────────────┐
│           Coordination Health Dashboard                      │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  Response Times (Last 7 Days)                                │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ URGENT:  ▓▓▓▓▓▓░░░░  1.2h avg (target: < 2h)  ✅  │    │
│  │ HIGH:    ▓▓▓▓▓▓▓░░░  6.8h avg (target: < 8h)  ✅  │    │
│  │ NORMAL:  ▓▓▓▓▓▓▓▓░░  18h avg (target: < 24h)  ✅  │    │
│  │ LOW:     ▓▓▓▓▓▓▓▓▓░  54h avg (target: < 72h)  ✅  │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                               │
│  Message Volume                                              │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ Today:      ████████████████  24 messages           │    │
│  │ This Week:  ████████████████████████████  156       │    │
│  │ This Month: ████████████████████████████████  628   │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                               │
│  Active Items                                                │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ In Progress: 12  │  Blocked: 2  │  Pending: 8      │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                               │
│  Type Synchronization                                        │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ Schema Changes: 8   │  Mobile Syncs: 8   │  ✅ 100% │    │
│  │ Last Sync: 2 hours ago   │  Status: IN SYNC       │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                               │
│  Team Activity (Last 24h)                                    │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ Mobile:  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓░░░░░░  14 messages         │    │
│  │ Backend: ▓▓▓▓▓▓▓▓▓░░░░░░░░░░░  10 messages         │    │
│  │ Web:     ░░░░░░░░░░░░░░░░░░░░   0 messages         │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

---

## 🎯 Decision Tree: When to Use Each Message Type

```mermaid
graph TD
    START{What do you need?} --> Q1{Another team<br/>to build something?}
    Q1 -->|Yes| TASK[Use TASK_REQUEST]
    Q1 -->|No| Q2{Update progress<br/>on existing work?}

    Q2 -->|Yes| STATUS[Use STATUS_UPDATE]
    Q2 -->|No| Q3{Database schema<br/>is changing?}

    Q3 -->|Yes| SCHEMA[Use SCHEMA_CHANGE]
    Q3 -->|No| Q4{Need architectural<br/>decision?}

    Q4 -->|Yes| DECISION[Use DECISION_NEEDED]
    Q4 -->|No| Q5{Production issue<br/>or critical blocker?}

    Q5 -->|Yes| URGENT[Use URGENT]
    Q5 -->|No| Q6{Component ready<br/>for integration?}

    Q6 -->|Yes| READY[Use INTEGRATION_READY]
    Q6 -->|No| Q7{Breaking change<br/>in API?}

    Q7 -->|Yes| BREAKING[Use API_CHANGE<br/>or BREAKING_CHANGE]
    Q7 -->|No| FYI[Use FYI message]

    style TASK fill:#4a90e2,color:#fff
    style STATUS fill:#50c878,color:#fff
    style SCHEMA fill:#f5a623,color:#000
    style URGENT fill:#e74c3c,color:#fff
```

---

## 📋 Team Responsibility Matrix

### Who Does What in the Coordination System

| Activity | Mobile Team | Backend Team | DevOps | All Teams |
|----------|------------|--------------|--------|-----------|
| **Check inbox daily** | ✅ | ✅ | ✅ | ✅ |
| **Respond within SLA** | ✅ | ✅ | ✅ | ✅ |
| **Create task requests** | ✅ | ✅ | ✅ | ✅ |
| **Schema change notifications** | ❌ | ✅ | ❌ | ❌ |
| **Type regeneration** | ✅ | ✅ | ❌ | ❌ |
| **Monitor watcher service** | ❌ | ❌ | ✅ | ❌ |
| **Archive maintenance** | ❌ | ❌ | ✅ | ❌ |
| **Update team status** | ✅ | ✅ | ✅ | ✅ |
| **Integration testing** | ✅ | ✅ | ❌ | ❌ |
| **Deployment coordination** | ✅ | ✅ | ✅ | ❌ |

---

## 🎓 Learning Path

### Recommended Order for Understanding the System

```mermaid
graph LR
    START([New User]) --> README[1. Read README.md<br/>5 minutes]
    README --> QUICK[2. Quick Start Guide<br/>10 minutes]
    QUICK --> SETUP[3. Run Setup Script<br/>5 minutes]
    SETUP --> TEST[4. Test Notifications<br/>2 minutes]
    TEST --> TEMPLATE[5. Explore Templates<br/>10 minutes]
    TEMPLATE --> FIRST[6. Create First Message<br/>5 minutes]

    FIRST --> BRANCH{Your Role?}
    BRANCH -->|Mobile Dev| MOBILE_USE[Daily Mobile Workflow]
    BRANCH -->|Backend Dev| BACKEND_GUIDE[Backend Integration Guide<br/>15 minutes]
    BRANCH -->|DevOps| ADMIN[System Administration]

    MOBILE_USE --> ADVANCED
    BACKEND_GUIDE --> ADVANCED
    ADMIN --> ADVANCED

    ADVANCED[Advanced Topics:<br/>7. Full Design Document<br/>8. Implementation Summary] --> EXPERT([Expert User])

    style START fill:#4a90e2,color:#fff
    style EXPERT fill:#50c878,color:#fff
```

---

**This visual overview provides quick reference diagrams for understanding the cross-repository coordination system. Refer to the detailed documentation for complete information.**