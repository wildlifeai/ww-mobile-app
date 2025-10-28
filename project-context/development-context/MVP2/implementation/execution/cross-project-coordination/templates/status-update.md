---
message_id: "MSG-YYYY-MM-DD-NNN"
thread_id: "{original-thread-id}"  # Links to the original task request
sender:
  team: "{your-team}"
  agent: "{agent-name-or-developer}"
recipient:
  team: "{requesting-team}"  # or "all" for broadcast updates
priority: "NORMAL"  # Usually NORMAL unless urgent update needed
type: "STATUS_UPDATE"
status: "SENT"
created: "{ISO-8601-timestamp}"
original_request: "{MSG-ID-of-original-task}"
tags:
  - "status-update"
  - "{project-specific-tags}"
---

# Status Update: {Task/Feature Name}

## Progress Summary
**Overall Status**: {X}% Complete
**Health**: 🟢 On Track | 🟡 At Risk | 🔴 Blocked | ✅ Completed

**Since Last Update**: {time period since last update}
**Update Frequency**: {daily | every 2 days | weekly}

## Completed Work
✅ {Completed item 1 with brief description}
✅ {Completed item 2 with brief description}
✅ {Completed item 3 with brief description}

### Deliverables Ready
- **API Endpoint**: `{endpoint-path}` - {status and documentation link}
- **TypeScript Types**: Available at `{path-to-types}` - {version/commit hash}
- **Database Migration**: `{migration-name}` - {applied to which environments}
- **Test Coverage**: {percentage}% - {link to test results}

## Currently In Progress
🔄 **{Work item 1}**
   - **Status**: {percentage}% complete
   - **ETA**: {expected completion date/time}
   - **Assignee**: {who is working on it}
   - **Blockers**: {none | description of issues}

🔄 **{Work item 2}**
   - **Status**: {percentage}% complete
   - **ETA**: {expected completion date/time}
   - **Assignee**: {who is working on it}
   - **Blockers**: {none | description of issues}

## Upcoming Work (Next 2-3 Days)
📋 {Next item 1} - {priority level}
📋 {Next item 2} - {priority level}
📋 {Next item 3} - {priority level}

## Blockers & Issues

### Active Blockers
{If none, state "No active blockers" - otherwise list each blocker}

🚫 **Blocker 1**: {Description}
   - **Impact**: {how this affects timeline/scope}
   - **Dependency**: {what needs to happen to unblock}
   - **Owner**: {who is responsible for resolving}
   - **Expected Resolution**: {when this should be resolved}

### Resolved Blockers (Since Last Update)
✅ {Previously blocked item} - {how it was resolved}

### Known Issues
⚠️ **Issue 1**: {Description}
   - **Severity**: {Critical | High | Medium | Low}
   - **Workaround**: {temporary solution if available}
   - **Resolution Plan**: {how this will be addressed}

## Timeline Update
- **Original Estimate**: {original time estimate}
- **Current Estimate**: {updated estimate}
- **Variance**: {+/- hours/days with explanation if significant}
- **Expected Completion**: {updated completion date}
- **Confidence Level**: {High | Medium | Low}

### Timeline Changes Explanation
{If timeline has changed, provide detailed explanation of:}
- What caused the change
- What steps are being taken to mitigate
- Impact on downstream dependencies

## Quality Metrics
- **Test Coverage**: {current}% (target: {target}%)
- **Code Review Status**: {X of Y PRs reviewed}
- **Documentation**: {percentage}% complete
- **Performance Benchmarks**: {meeting targets? | needs optimization}
- **Security Review**: {not started | in progress | completed}

## Integration Readiness

### Ready for Integration
- [x] **{Component/Feature 1}**
  - API: `{endpoint}` - {link to docs}
  - Types: `{path}` - {commit hash}
  - Tests: {link to test results}
  - Examples: {link to integration examples}

- [ ] **{Component/Feature 2}** - {ETA for readiness}

### Integration Requirements for Consuming Team
1. **Prerequisites**: {what needs to be in place}
2. **Configuration**: {any environment variables or settings}
3. **Migration Steps**: {if database changes are involved}
4. **Testing Checklist**: {what to test after integration}

## Risks & Concerns
{If none, state "No new risks identified" - otherwise list each risk}

⚠️ **Risk 1**: {Description}
   - **Probability**: {High | Medium | Low}
   - **Impact**: {High | Medium | Low}
   - **Mitigation**: {what's being done to address}

## Action Items for Other Teams

### For {Team Name}
- [ ] **{Action Item 1}**
  - **Required By**: {date/time}
  - **Owner**: {specific person if known}
  - **Details**: {what needs to be done}

- [ ] **{Action Item 2}**
  - **Required By**: {date/time}
  - **Owner**: {specific person if known}
  - **Details**: {what needs to be done}

### For {Another Team}
- [ ] {Action items for this team}

## Questions for Stakeholders
1. **{Question 1}**: {detailed question requiring decision or clarification}
   - **Context**: {why this question matters}
   - **Options**: {possible answers if applicable}
   - **Impact of Decision**: {how the answer affects work}

2. **{Question 2}**: {next question}

## Resources & Links
- **Code Repository**: {link to branch/PR}
- **Documentation**: {link to updated docs}
- **Test Results**: {link to CI/CD results}
- **API Playground**: {link if available}
- **Design Documents**: {link to relevant specs}

## Next Update Schedule
- **Next Update**: {date/time of next status update}
- **Communication Channel**: {where updates will be posted}
- **Contact for Questions**: {who to reach out to}

---

## Change Log (Auto-Updated by System)
*Tracks significant changes to this thread*
- {timestamp}: Work started
- {timestamp}: First milestone completed
- {timestamp}: Blocker encountered
- {timestamp}: Blocker resolved

---

## Response Instructions
If you have questions or concerns about this update:
1. Reply in this same thread (THR-{thread-id})
2. Tag your message with priority level
3. Reference specific items from this update
4. Provide context for your question

---
*Next automatic status update: {scheduled-date-time}*
*For urgent issues, create a new URGENT message*