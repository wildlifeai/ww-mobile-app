# Documentation Cleanup: Stakeholder Overview Evolution & Workflow Specification

**Date**: October 18, 2025
**Purpose**: To summarize the consolidation of stakeholder-facing documentation and the creation of detailed technical workflow specifications.

---

## 1. Overview

This document outlines two major documentation improvements:

1.  **Consolidation of Stakeholder Overviews**: The content from `WILDLIFE-WATCHER-APP-STAKEHOLDER-OVERVIEW.md` has been updated, expanded, and refined into a new, authoritative document: `WILDLIFE-WATCHER-APP-STAKEHOLDER-OVERVIEW-GOAL.md`.
2.  **Creation of Communications Workflow Specifications**: Two detailed technical specification documents have been created to provide in-depth implementation guidance for communication interaction workflows.
3.  **Creation of App Screen Guide**: A non-technical guide to every screen and user workflow in the app.

The result is a clearer, more accurate, and better-structured documentation set. The `GOAL` document serves as the high-level "source of truth" for stakeholders, while the new workflow files provide the necessary technical depth for developers.

---

## 2. Stakeholder Overview Document Comparison

The `WILDLIFE-WATCHER-APP-STAKEHOLDER-OVERVIEW-GOAL.md` is now the primary reference document. It supersedes the previous version by incorporating a more mature understanding of the project's architecture, user roles, and feature set.

Key differences are summarized below:

| Feature Area | `WILDLIFE-WATCHER-APP-STAKEHOLDER-OVERVIEW.md` (Previous Version) | `WILDLIFE-WATCHER-APP-STAKEHOLDER-OVERVIEW-GOAL.md` (New Authoritative Version) |
| :--- | :--- | :--- |
| **Scope & Org Structure** | Implied a full multi-tenant structure with a 4-tier role system from the start. | **Simplifies scope for MVP2**. Establishes a single "General" organization for all users, deferring multi-organization features to a "Future Enhancements" section. This clarifies the MVP2 focus. |
| **User Roles** | Described a 4-tier role system (`WW Admin`, `Model Manager`, `Project Admin`, `Project Member`) as immediately applicable. | **Refines roles for MVP2 and beyond**. Simplifies to 3 core roles for the mobile app (`Project Admin`, `Project Member`, `Organisation Member`). The `Model Manager` and full `WW Admin` capabilities are moved to future web portal enhancements. |
| **Feature Structure** | Organized features functionally (e.g., Project Management, Team Management). | **Restructures around user experience**. Adds a detailed `Main Navigation` section, a `Device Status Lifecycle`, and explicit `Data Management Policies`. Introduces a user self-registration flow. |
| **Workflow Philosophy** | Described workflows procedurally. | **Adds explicit "Workflow Philosophy" sections**. Explains the *why* behind the design, such as the "reality-first" approach for deployments and the pre-deployment readiness goal for the Camera Workbench. |
| **Start Deployment** | Outlined a 6-step wizard. | **Refines to a 4-5 step "reality-first" wizard**. Prioritizes physical setup (pairing, connectivity, camera view) before metadata entry. Links to a dedicated technical spec. |
| **Photo Management** | Handled photos as a general part of deployment. | **Provides explicit clarity on photo types**. Defines distinct policies for `Test Photos` (temporary), `Deployment Setup Photos` (persistent), and `Detection Event Photos` (future). |
| **Data & Security** | Described a full multi-tenant system with multiple organizations. | **Updates the architecture for MVP2's scope**. Clarifies that all users and projects will belong to a single "General" organization, simplifying the security model while retaining the underlying multi-tenant-ready architecture for the future. |
| **Project Settings** | Basic project settings. | **Expands project-level configuration**. Adds new settings like `Is Baited?`, `Monitoring marked individuals`, `Capture Method` (Motion vs. Time-lapse), and `Default AI Model` selection. |
| **Team Management** | Mentioned an invitation system. | **Redesigns the invitation system**. Specifies a hybrid model with email invites for new users and an in-app `Notifications Screen` for existing users to accept/decline project invitations. |
| **Navigation & UI** | Lacked a dedicated navigation overview. | **Adds a comprehensive "Navigation Structure" section**. Details the Bottom Tab Bar, Side Drawer Menu, and screen transitions. Includes descriptions for new screens like Profile, Settings, and Feedback. |
| **Overall Structure** | A detailed document that absorbed some updates but was internally inconsistent. | **More comprehensive, consistent, and forward-looking**. Clearly separates MVP2 features from "Future Enhancements," includes "Why This Matters" sections for context, and acts as a hub linking to new, detailed technical workflow documents. |

---

## 3. Creation of New Specifications

To support the refined `GOAL` overview, three new, highly-detailed markdown files have been created. These documents provide the specific, step-by-step technical and user-flow logic required for implementation, allowing the main stakeholder document to remain at a higher level.

These new files are now the primary technical reference for the communications and front end aspects of the mobile app.

### New Files:

#### 1. `device-firmware-update-workflow.md`
*   **Purpose**: Provides an end-to-end specification for the Device Firmware Update (DFU) process over BLE. It covers pre-update checks (battery level, deployment status), the DFU process itself, and post-update verification.
*   **Status**: For Implementation.

#### 2. `ble-lorawan-communication-spec.md`
*   **Purpose**: A crucial technical guide for developers. It explains the entire communication architecture, including:
    *   The two primary BLE services (**WWUS** for normal operations and **DFU** for updates).
    *   The command structure for interacting with the camera.
    *   How the mobile app interacts with LoRaWAN data (via the backend, not directly).
    *   The LoRaWAN device registration/provisioning process.
*   **Status**: For Implementation.

#### 3. `app-screen-guide.md`
*   **Purpose**: A non-technical guide to every screen and user workflow in the app. It details the UI components, user actions, and navigation flows for authentication, main navigation (maps, projects, etc.), and core workflows like starting a deployment and preparing a camera.
*   **Status**: For Implementation.
---

## 4. Conclusion

This documentation cleanup effort has resulted in a more robust and maintainable set of project specifications.

- **Clarity for Stakeholders**: The `WILDLIFE-WATCHER-APP-STAKEHOLDER-OVERVIEW-GOAL.md` document provides a single, clear, and comprehensive overview of the project's features, goals, and architecture.
- **Depth for Developers**: The new, dedicated app screen guide and communication-spec files provide the unambiguous technical detail required for implementation, reducing ambiguity and improving development efficiency.

This new structure ensures that information is both accessible to its target audience and detailed enough for its purpose.
