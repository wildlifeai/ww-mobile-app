# Documentation Cleanup: Stakeholder Overview Evolution & Workflow Specification

**Date**: October 18, 2025
**Purpose**: To summarize the consolidation of stakeholder-facing documentation and the creation of detailed technical workflow specifications.

---

## 1. Overview

This document outlines two major documentation improvements:

1.  **Consolidation of Stakeholder Overviews**: The content from `WILDLIFE-WATCHER-APP-STAKEHOLDER-OVERVIEW.md` has been significantly updated, expanded, and refined into a new, authoritative document: `WILDLIFE-WATCHER-APP-STAKEHOLDER-OVERVIEW-GOAL.md`.
2.  **Creation of Detailed Workflow Specifications**: Five new, detailed technical specification documents have been created to provide in-depth implementation guidance for core device interaction workflows.

The result is a clearer, more accurate, and better-structured documentation set. The `GOAL` document serves as the high-level "source of truth" for stakeholders, while the new workflow files provide the necessary technical depth for developers.

---

## 2. Stakeholder Overview Document Comparison

The `WILDLIFE-WATCHER-APP-STAKEHOLDER-OVERVIEW-GOAL.md` is now the primary reference document. It supersedes the previous version by incorporating a more mature understanding of the project's architecture, user roles, and feature set.

Key differences are summarized below:

| Feature Area | `WILDLIFE-WATCHER-APP-STAKEHOLDER-OVERVIEW.md` (Previous Version) | `WILDLIFE-WATCHER-APP-STAKEHOLDER-OVERVIEW-GOAL.md` (New Authoritative Version) |
| :--- | :--- | :--- |
| **User Roles** | Had four roles, including a separate `Model Manager`. User onboarding was via an invitation system. | **Expanded to five roles**, including `Organisation Member` and `Organisation Administrator`. Clarifies the separation of mobile vs. web portal capabilities. Introduces a self-signup flow. |
| **Data & Security** | Provided a good high-level overview of the security system. | **Massively expanded**. Includes detailed explanations of multi-tenancy, Row Level Security (RLS), PostGIS, the 4-tier security model, and a full breakdown of the database schema and sync architecture. |
| **Device Preparation** | Described "Register New Camera" and "Test Camera Connection" as separate, simple features. | **Introduces the "Camera Workbench" concept**. A unified screen for pre-deployment checks, firmware updates, project association, and testing. Much more detailed and user-centric. |
| **Start Deployment** | Outlined a 6-step wizard with a metadata-first approach. | **Refines the 6-step wizard with a "reality-first" philosophy**: prioritizes physical camera setup (pairing, connectivity, camera view) before metadata entry. Adds crucial details like deleting temporary test photos. |
| **End Deployment** | Described a basic flow to end a deployment. | **Adds more detail and context**, including initiation points (Map or List), a confirmation step to prevent errors, and a final summary screen for the user. |
| **Firmware Updates** | Mentioned DFU as part of device management. | **References a dedicated, detailed workflow document** (`device-firmware-update-workflow.md`) for the complete end-to-end process. |
| **Overall Structure** | A solid but less detailed overview. | **More comprehensive and polished**. Includes "Why This Matters" sections, clearer real-world examples, and acts as a central hub linking to the new, detailed technical specifications. |

---

## 3. Creation of New Technical Workflow Specifications

To support the refined `GOAL` overview, five new, highly-detailed markdown files have been created. These documents provide the specific, step-by-step technical and user-flow logic required for implementation, allowing the main stakeholder document to remain at a higher level.

These new files are now the primary technical reference for their respective features.

### New Specification Files:

#### 1. `device-preparation-workflow.md`
*   **Purpose**: Details the entire "Prepare and Test Nearby Devices" flow, centered around the **Camera Workbench** screen. It covers connecting to a device and all the checks and configurations a user can perform before a field deployment (e.g., checking battery, SD card, associating a project, etc.).
*   **Status**: For Implementation.

#### 2. `device-firmware-update-workflow.md`
*   **Purpose**: Provides an end-to-end specification for the Device Firmware Update (DFU) process over BLE. It covers pre-update checks (battery level, deployment status), the DFU process itself, and post-update verification.
*   **Status**: For Implementation.

#### 3. `start-deployment-workflow.md`
*   **Purpose**: Specifies the 6-step wizard for starting a new camera deployment. It codifies the "reality-first" approach, detailing each step from device selection and connectivity testing to location capture and final configuration.
*   **Status**: For Implementation.

#### 4. `end-deployment-workflow.md`
*   **Purpose**: Defines the user flow for formally ending a deployment. It includes the initiation, confirmation, and finalization steps, ensuring data integrity and proper device status updates.
*   **Status**: For Implementation.

#### 5. `ble-lorawan-communication-spec.md`
*   **Purpose**: A crucial technical guide for developers. It explains the entire communication architecture, including:
    *   The two primary BLE services (**WWUS** for normal operations and **DFU** for updates).
    *   The command structure for interacting with the camera.
    *   How the mobile app interacts with LoRaWAN data (via the backend, not directly).
    *   The LoRaWAN device registration/provisioning process.
*   **Status**: For Implementation.

---

## 4. Conclusion

This documentation cleanup effort has resulted in a more robust and maintainable set of project specifications.

- **Clarity for Stakeholders**: The `WILDLIFE-WATCHER-APP-STAKEHOLDER-OVERVIEW-GOAL.md` document provides a single, clear, and comprehensive overview of the project's features, goals, and architecture.
- **Depth for Developers**: The new, dedicated workflow and communication-spec files provide the unambiguous technical detail required for implementation, reducing ambiguity and improving development efficiency.

This new structure ensures that information is both accessible to its target audience and detailed enough for its purpose.
