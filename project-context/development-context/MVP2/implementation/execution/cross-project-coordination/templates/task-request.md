---
message_id: "MSG-YYYY-MM-DD-NNN"
thread_id: "THR-{TOPIC}-NNN"
sender:
  team: "{your-team}"
  agent: "{agent-name-or-developer}"
  repository: "{your-repo}"
recipient:
  team: "{target-team}"  # mobile | backend | web | all
  agent: "{specific-agent}"  # optional
priority: "HIGH"  # URGENT | HIGH | NORMAL | LOW
type: "TASK_REQUEST"
status: "SENT"
created: "{ISO-8601-timestamp}"
due_date: "{ISO-8601-timestamp}"  # when you need this completed
requires_response: true
response_deadline: "{ISO-8601-timestamp}"  # when you need acknowledgment
dependencies:
  - "{related-message-id}"
  - "{related-task-id}"
tags:
  - "{relevant}"
  - "{tags}"
---

# Task Request: {Clear, Descriptive Title}

## Executive Summary
{2-3 sentences describing what needs to be done and why it's important}

## Context
{Background information explaining why this coordination is needed and how it fits into the larger picture}

## Requirements

### Functional Requirements
- [ ] {Specific requirement 1 with clear acceptance criteria}
- [ ] {Specific requirement 2 with clear acceptance criteria}
- [ ] {Specific requirement 3 with clear acceptance criteria}

### Technical Specifications
```typescript
// Include relevant type definitions, API specifications, or schema changes
interface RequestedAPI {
  endpoint: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  authentication: 'jwt' | 'api-key' | 'service-role';
  request?: {
    // Request body schema
  };
  response: {
    // Response schema
  };
}
```

### Database Requirements
- **New Tables**: {list any new tables needed}
- **Schema Changes**: {list modifications to existing tables}
- **RLS Policies**: {security requirements and row-level security needs}
- **Functions/Triggers**: {any database functions or triggers required}
- **Migrations**: {migration strategy and rollback plan}

### Storage Requirements
- **Buckets Needed**: {list storage buckets and their purposes}
- **File Types**: {supported file types and size limits}
- **Access Policies**: {who can read/write}
- **CDN Configuration**: {if edge caching is needed}

## Success Criteria
- [ ] All functional requirements implemented and tested
- [ ] API endpoints return correct data with < 200ms response time
- [ ] Database migrations apply cleanly and are reversible
- [ ] Integration tests pass with > 90% coverage
- [ ] TypeScript types generated and shared
- [ ] Documentation complete and reviewed
- [ ] No breaking changes to existing functionality

## Impact Analysis
- **Mobile App Impact**: {how this affects mobile development}
- **Backend Impact**: {backend changes required}
- **User Impact**: {end-user experience changes}
- **Performance Impact**: {expected performance implications}
- **Security Impact**: {security considerations}

## Timeline
- **Start Date**: {when work can begin}
- **Implementation Estimate**: {hours/days for implementation}
- **Testing Estimate**: {hours/days for testing}
- **Integration Estimate**: {hours/days for integration}
- **Total Estimate**: {total time needed}
- **Required By**: {hard deadline if any}

## Dependencies
### Upstream Dependencies (This depends on)
- {List what must be completed before this work can start}
- {Include links to related tasks or messages}

### Downstream Dependencies (This blocks)
- {List what work is blocked until this is complete}
- {Include specific task IDs or features}

## Risk Assessment
- **Technical Risks**: {potential technical challenges}
- **Timeline Risks**: {what could delay completion}
- **Mitigation Strategy**: {how to handle risks}

## Questions & Clarifications Needed
1. {Specific question that needs answering before work can begin}
2. {Any ambiguities that need resolution}
3. {Optional: preferences or alternatives to consider}

## Proposed Solution (Optional)
{If you have a recommended approach, outline it here}

## Testing Strategy
- **Unit Tests**: {what unit tests are needed}
- **Integration Tests**: {integration test scenarios}
- **End-to-End Tests**: {user journey tests}
- **Performance Tests**: {load/stress testing needs}

## Documentation Requirements
- [ ] API documentation with examples
- [ ] Database schema documentation
- [ ] Integration guide for consuming team
- [ ] Troubleshooting guide
- [ ] Update relevant README files

## Attachments
- [{filename}](attachments/{filename}) - {description of attached file}
- [{specification.md}](attachments/{specification.md}) - {detailed specification document}

## Response Instructions
When responding to this request, please include:
1. **Acknowledgment**: Confirm receipt and understanding
2. **Feasibility**: Can this be done as specified?
3. **Timeline**: Your estimated completion date
4. **Blockers**: Any issues preventing immediate start
5. **Questions**: Any clarifications needed
6. **Alternatives**: If you see a better approach

---

## Tracking Information
*This section is auto-updated by the coordination system*
- **Acknowledged**: {timestamp and by whom}
- **Started**: {timestamp}
- **Updates**: {links to status updates}
- **Completed**: {timestamp and validation results}
- **Escalations**: {any escalation events}

---
*This message will escalate to URGENT if not acknowledged within {response_deadline}*
*For questions about this request, create a response in the same thread*