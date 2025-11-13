# Overview

Notes from document in this folder following comprehensive code review that need to be actioned as at 16 Oct 2025.




## Notes and Action

### Document - @project-context/code-review/20251016/ARCHITECTURE-REVIEW.md

- Actions: State Management

- **Areas for Improvement:**
- ⚠️ Inconsistent architectural patterns (mixed state management approaches) - explain this in detail
- ⚠️ Provider hierarchy complexity could be simplified - explain and recommend how
- ⚠️ Limited dependency injection leading to tight coupling - identify all examples of this and how to refactor
- ⚠️ Some violations of Single Responsibility Principle -  identify all examples of this and how to refactor 
- ⚠️ Documentation gaps in architectural decision records - create a new sunf folder under @documentation/app-technical-guides caled ADR_Docs - create ADR documentation for ADRs existing ans new ones needed.

- Address issue per 1.2 Core Architectural Patterns deficiencys

- Consider Provider Composition pattern to reduce nesting depth and improve testability per s2.1 - also weaknesss identified:
- ⚠️ Provider nesting depth (6 levels) creates complexity
- ⚠️ Some screens have excessive logic (violate SRP)
- ⚠️ Inconsistent component organization (mixed flat/nested)




## Other Actions

- create on-boarding docs (In progress)- prompt create a onboarding guide for a new developer to this application with web experience but no react native, typescript, offline first, api/rtk and associate react tools/libs/concepts
  experience. The document should be easy to understand, be comprehensive in the topics to be covered to enable the reader to be productive with the app quickly. It should teach the
  technology stack, concepts, terms, patterns, architecture to enable the readre to that end. Ensure you review the current state and based you conent on that. Also include the project
  structure (focusing on the application items (files/folders). To help the user understand the app itslef but also the technology and architure, use examples of implementation as part
  of that and wlak them through it for each concept and technology so it effectively does two things - educatethe reader and familiarise them with the app. Include a higlevel overview as
  well as the details sections. Place the documen in the @documentation/ folder under a new subfolder called onboarding-docs. Inclde a READEME.md that describe the folder content. You
  may want to create separate documents that can be navigatedf to from a master document. Please balance being an effective, accessible guide to get the user ramped up quick withthe
  level of information to become effective but not get in the fine-grain details (the reader can further learn that as they work on the app) - balance that. Review the app and it current
  state, identity what to include in the document given the objectives, plan the structure and content, prepare the document. Think Hard.



## Question and things to understand

 - What is 'multi-tenancy support' and how is it implemented in this app?
