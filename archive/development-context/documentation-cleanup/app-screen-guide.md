# Wildlife Watcher App - Screen Guide

**Version**: 1.0
**Date**: January 17, 2025
**Purpose**: A non-technical guide to the screens and features of the Wildlife Watcher mobile app.

---

## Table of Contents

1.  [Authentication Screens](#1-authentication-screens)
    -   [Login Screen](#login-screen)
    -   [Sign Up Screen](#sign-up-screen)
    -   [Forgot Password Screen](#forgot-password-screen)
2.  [Main Navigation (Bottom Tabs)](#2-main-navigation-bottom-tabs)
    -   [Maps Screen (Home)](#maps-screen-home)
    -   [Projects Screen](#projects-screen)
    -   [Deployments Screen](#deployments-screen)
    -   [Devices Screen](#devices-screen)
3.  [Core Workflows](#3-core-workflows)
    -   [Start Deployment Wizard](#start-deployment-wizard)
    -   [End Deployment Flow](#end-deployment-flow)
    -   [Prepare and Test Nearby Devices](#prepare-and-test-nearby-devices)
4.  [Detail Screens](#4-detail-screens)
    -   [Project Details Screen](#project-details-screen)
    -   [Deployment Details Screen](#deployment-details-screen)
    -   [Device Details Screen](#device-details-screen)
    -   [Notifications Screen](#notifications-screen)
    -   [Feedback Screen](#feedback-screen)
    -   [Profile Screen](#profile-screen)
    -   [Settings Screen](#settings-screen)
5.  [Side Drawer Menu](#5-side-drawer-menu)
6.  [Engineering Tools](#6-engineering-tools)

---

## 1. Authentication Screens

These are the first screens a user sees when they open the app.

### Login Screen

This is the entry point to the app where users securely access their accounts.

*   **What the user sees**:
    *   The Wildlife Watcher logo and title.
    *   An "Email" field.
    *   A "Password" field.
    *   A "Remember me" checkbox.
    *   A "Sign In" button.
    *   Links for "Forgot Password?" and "Sign Up".

*   **What the buttons do**:
    *   **Sign In**: After the user enters their email and password, this button logs the user into the app, taking them to the main **Maps Screen**.
    *   **Remember me**: If the user checks this, the app will remember their login details for next time.
    *   **Forgot Password?**: Takes the user to the **[Forgot Password Screen](#forgot-password-screen)** where they can enter their email to receive a password reset link.
    *   **Sign Up**: Takes the user to the **[Sign Up Screen](#sign-up-screen)** where they can create a new account.

### Sign Up Screen

This screen allows new users to create their own Wildlife Watcher account directly from the app.

*   **What the user sees**:
    *   An "Email" field.
    *   A "Password" field.
    *   A "Confirm Password" field.
    *   A "Sign Up" button.
    *   A link to go "Back to Login".

*   **What the buttons do**:
    *   **Sign Up**: After the user fills in their details, this button creates the user's new account. A confirmation message will appear, informing the user to check their email for a verification link. After the user dismisses this message, the user will be automatically returned to the **[Login Screen](#login-screen)**.
    *   **Back to Login**: Takes the user back to the **[Login Screen](#login-screen)** without creating an account.

### Forgot Password Screen

This screen helps users who have forgotten their password to regain access to their account.

*   **What the user sees**:
    *   An "Email" field for the user to enter their account email.
    *   A "Send Reset Link" button.
    *   A message area to show confirmation or error messages.
    *   A link to go "Back to Login".

*   **What the buttons do**:
    *   **Send Reset Link**: After the user enters the email address associated with the user's account, this button sends an email containing a secure link to reset the user's password. A confirmation message will appear on the screen to let the user know the email has been sent. The app will remain on this screen, allowing the user to use the "Back to Login" link when ready.
    *   **Back to Login**: Takes the user back to the **[Login Screen](#login-screen)**.

---

## 2. Main Navigation (Bottom Tabs)

Once logged in, the user will see the main navigation elements that are always visible.

*   **Bottom Tab Bar**: At the bottom of the screen, there are four main tabs: **Maps**, **Projects**, **Deployments**, and **Devices**. The user can tap these at any time to switch between the major sections of the app.
*   **Header Bar**: At the top of the screen, the user will see the title of the current screen and a menu icon (three horizontal lines, often called a "hamburger" menu) on the left. Tapping this icon opens the **[Side Drawer Menu](#5-side-drawer-menu)**.


### Maps Screen (Home)

This is the user's command center for all field operations. It gives the user a bird's-eye view of the user's deployments.

*   **What the user sees**:
    *   A map that defaults to the user's current location.
    *   Color-coded pins showing the location of all the user's camera deployments.
    *   A floating **blue** button in the bottom-right corner of the map labeled **"Start Deployment"**.
    *   A floating **orange** button in the bottom-right corner of the map labeled **"End Deployment"** (this only appears if the user has active deployments).
    *   A button to re-center the map on the user's current location.
    *   Zoom in/out controls.
    *   A "Layers" icon in the top-right corner of the map.

*   **What the buttons do**:
    *   **Deployment Pins**: Tapping on a pin on the map opens a small pop-up summary of that deployment. This summary shows the **Deployment Name**, **Camera Name**, and **Status** (e.g., Active). It also displays the last known status using icons: a battery icon colored green (healthy), yellow (low), or red (critical), and an SD card icon colored similarly to show how full it is. The pop-up has a "View Details" button that takes the user to the full **[Deployment Details Screen](#deployment-details-screen)**.
    *   **Start Deployment**: This is the main action button. Tapping it begins the **[Start Deployment Wizard](#start-deployment-wizard)** to set up a new camera in the field.
    *   **End Deployment**: Tapping this begins the **[End Deployment Flow](#end-deployment-flow)** for retrieving a camera.
    *   **Layers Icon**: Tapping this icon opens a menu that lets the user control what is displayed on the map. The user can filter deployments by status ("Active", "Ended"), by project, and distance from the user's current location.

### Projects Screen

This screen is like a digital filing cabinet for all the user's research projects.

*   **What the user sees**:
    *   A list of "cards," where each card represents one of the user's research projects.
    *   Each card shows the project's name, description, and how many team members and deployments it has.
    *   A search bar at the top to quickly find a specific project.
    *   A floating green "+" button at the bottom.

*   **What the buttons do**:
    *   **Project Card**: Tapping on a project card takes the user to the **[Project Details Screen](#project-details-screen)** for that specific project.
    *   **"+" (Add Project) Button**: Tapping this takes the user to the **[Project Details Screen](#project-details-screen)** in a "create" mode, where the user can fill in the details for a new project.

### Deployments Screen

This screen provides a detailed list of every camera deployment the user has access to, across all the user's projects.

*   **What the user sees**:
    *   A set of filter buttons at the top labeled **"All"**, **"Active"**, and **"Ended"**. The selected filter is highlighted, with "All" being the default.
    *   A list of deployment "cards," each showing key information like the project name, camera name, battery level, key operational statistics (like image count), and when data was last received.
    *   The cards are color-coded to show their status (e.g., green for healthy, red for ended).
    *   A floating blue "+" button at the bottom.

*   **What the buttons do**:
    *   **Filter Buttons**: Tapping "All", "Active", or "Ended" will filter the list to show only those deployments.
    *   **Deployment Card**: Tapping on a card will take the user to the **[Deployment Details Screen](#deployment-details-screen)**.
    *   **"+" (Start Deployment) Button**: Tapping this is a shortcut that begins the **[Start Deployment Wizard](#start-deployment-wizard)** to set up a new camera in the field.

### Devices Screen

This is the user's hardware management center, where the user can see the status of the user's cameras and prepare them for the field.

*   **What the user sees**:
    *   A list of all cameras associated with the projects the user is a member of. Each camera is shown as a "card" with its name and status ("Deployed", "Prepared on {completed_at}", or "Needs Preparation").
    *   For deployed cameras, the card also shows the project it's in and its last known battery level and key operational statistics.
    *   A prominent button labeled **"Prepare and Test Nearby Devices"**.
    *   A smaller, secondary button labeled **"Engineer Nearby Devices"**.

*   **What the buttons do**:
    *   **Device Card**: Tapping on any camera card in the list takes the user to the **[Device Details Screen](#device-details-screen)** for that specific camera.
    *   **Prepare and Test Nearby Devices**: Tapping this button will make the app scan for any Wildlife Watcher cameras nearby that are *not* currently deployed. Selecting one takes the user to the **[Prepare and Test Nearby Devices](#prepare-and-test-camera-workbench)** screen.
    *   **Engineer Nearby Devices**: This button opens the **[Engineer Console](#engineer-console)**, a tool for developers to directly interact with the camera hardware.

---

## 3. Core Workflows

These are the multi-step processes for the most common tasks.

### Start Deployment Wizard

This multi-step wizard guides the user through setting up a new camera in the field. It's designed to reduce the number of clicks in the field while making sure users don't miss any critical information. The number of steps (either 4 or 5) depends on whether the camera is set up for remote updates.

*   **Step 1: Device Selection**
    *   **What the user sees**: This step takes over the full screen, so the main bottom tabs are temporarily hidden. At the top of the screen, a progress bar clearly indicates the user is on **"Step 1"**. The screen has the "Select a Device" title and shows a list of available Wildlife Watcher cameras that the app detects nearby via Bluetooth. For each camera in the list, the user will see:
        *   The camera's name (e.g., "WW-Camera-101").
        *   A signal strength icon (like Wi-Fi bars) showing how strong the connection is.
    *   If no devices are found, a message "No devices found" is displayed, along with a link labelled **"I can't find my device"**.
    *   **What the buttons do**:
        *   **Camera in the list**: Tapping on a camera from the list shows a loading indicator while the app attempts to connect. If the connection fails, an error message with a "Retry" button will appear. If device is associated with a project the user isn't member of the app does not connect to the device and displays a message: "To use this device with its current project, ask the Project Admin to add you as a member.". If successful, the app checks the camera's status. If the device has not been prepared, the user will be redirected to the **[Prepare and Test (Prepare and Test Nearby Devices)](#prepare-and-test-camera-workbench)** flow first. After the user finishes preparing the device, the user will be returned to the wizard to continue the deployment. If the device is ready and registered for LoRaWAN, the user will proceed to **Step 2: Connectivity Setup**. If the device is ready but *not* registered for LoRaWAN, the user will skip Step 2 and go directly to **Step 3: Camera View & Adjustment**.
        *   **Refresh/Scan Again**: A button that lets the user re-scan for nearby cameras if the user doesn't see the one the user is looking for.
        *   **Cancel**: This button lets the user exit the wizard and go back to the screen the user came from (usually the Maps screen).
        *   **I can't find my device**: Tapping this link shows a pop-up or a message with instructions: "To make your camera discoverable, press the button on the Wildlife Watcher until the blue Bluetooth icon lights up."
    * **Note Device Association**: The deployment automatically links to the most recent completed device_preparation record for the selected device. This creates the association: deployment → device_preparation → device → project.
*   **Step 2: Connectivity Setup**
    *   **What the user sees**: This step is only shown if the camera's LoRaWAN has been preregistered. The progress bar shows the user is on **"Step 2 of 5"**. The name of the associated project (selected in the camera workbench) is displayed at the top of the screen. The screen has a visual indicator (like signal bars) showing the current signal strength and the lorawan network name.
    *   **What the buttons do**:
        *   **Test Signal**: Tapping this button makes the camera send a test signal. The signal strength indicator will update, helping the user find the best physical spot for the camera to ensure it can send updates.
        *   **Back**: Takes the user back to Step 1: Device Selection.
        *   **Next**: Takes the user to Step 3: Camera View & Adjustment.
*   **Step 3: Camera View & Adjustment**
    *   **What the user sees**: The progress bar shows the user's current step (either **"Step 2 of 4"** or **"Step 3 of 5"**). If the camera has not been pre-registered to use LoRaWAN, the name of the associated project is displayed at the top of the screen along with a message reminding the user that remote updates will not be available. Below that, the screen displays a large image. The first time a user sees this screen there is no photo displayed. 
    *   **What the buttons do**:
        *   **Take Test Photo**: Tapping this button commands the camera to take a new picture, which then appears on the screen. This allows the user to physically adjust the camera's position and take new photos until the user is happy with the framing and field of view. Test photos are stored in a dedicated "test" folder on the SD card to distinguish them from deployment data.
        *   **Back**: Takes the user to the previous step.
        *   **Next**: Once the user is satisfied with the camera's view, this button takes the user to Step 4: Location.
*   **Step 4: Location**
    *   **What the user sees**: The progress bar shows the user's current step. The screen contains an interactive map centered on the user's current location. The Latitude and Longitude fields are automatically pre-filled with the user's phone's current GPS coordinates. If GPS is unavailable, these fields will be empty, and a message will prompt the user to set the location manually. Below the map, there is a section to add photos of the camera's hiding spot, which will show thumbnails of any photos the user has taken.
    *   **What the buttons do**:
        *   **Use My Current Location**: Tapping this button re-acquires the user's phone's current GPS coordinates and updates the Latitude and Longitude fields. The user can also drag the pin on the map to set the location manually.
        *   **Add Photo of Deployed Camera**: This button opens the user's *phone's* camera, allowing the user to take pictures of the camera in its final, hidden position from different angles. These photos are saved with the deployment record to make the camera easier to find when the user returns to retrieve it. The user can take multiple photos.
        *   **Photo Thumbnails**: Tapping on a photo thumbnail will open it in a full-screen view. In this view, the user can choose to delete the photo, which will trigger a confirmation pop-up ("Are you sure you want to delete this photo?") to prevent accidental deletion.
        *   **Deployment Notes**: An optional free-text area for notes (e.g., "Under a big tree close to the radio tower," "10 meters north of the stream crossing").
        *   **Back**: Takes the user to the previous step.
        *   **Next**: Takes the user to Step 5: Deployment Details.
*   **Step 5: Deployment Details**
    *   **What the user sees**: The progress bar shows the user is on the final step. This screen is a form where the user enters the final details for the deployment. The user will see fields for:
        *   **Deployment Name**: A text field, pre-filled with a suggestion like "Deployment #123".
        *   **AI Model**: A read-only field displaying the project's default AI model. This cannot be changed during deployment - only Project Admins can modify the AI model in the Project Details screen.
    *   **What the buttons do**:
        *   **Back**: Allows the user to go back and make changes to any of the previous steps.
        *   **Arm & Submit Deployment**: This is the final button. Tapping it sends the final configuration settings to the camera, the camera confirms it will start recording, the app saves the deployment record in the database and then shows a "Deployment Successful" message before taking the user to the **Deployment Details Screen**.
    *   **Notes**:
        *   **Project specific details**: Capture method, sampling design, bait use, and AI model selection are all configured at the project level by Project Admins - they cannot be changed during deployment.
        *   **ML model**: The Wildlife Watcher will run the AI model assigned to the project by the Project Admin. This model is loaded onto the camera during the Prepare and Test workflow. If the animal identification model is present but LoRaWAN is disabled, the classifications will be stored locally on the camera and no remote alerts will be sent.

### End Deployment Flow

This 2-step wizard guides the user through retrieving a camera from the field and formally ending its monitoring session.

*   **Step 1: Device Selection**
    *   **What the user sees**: This screen is identical to the first step of the **Start Deployment Wizard**. It takes over the full screen and shows a list of nearby Wildlife Watcher cameras that the app detects via Bluetooth.
    *   **What the buttons do**:
        *   **Camera in the list**: Tapping on a camera from the list selects it and attempts to connect. The app then verifies that this camera is part of an active deployment that the user is a member of. If not, the app does not connect to the device and displays a message: "To use this device with its current project, ask the Project Admin to add you as a member.". 
        *   **Refresh/Scan Again**: A button that lets the user re-scan for nearby cameras.
        *   **Cancel**: This button lets the user exit the wizard and go back to the screen the user came from.
        *   **I can't find my device**: Tapping this link shows a pop-up with instructions on how to make the camera discoverable.
*   **Step 2: Confirmation & Finalization**
    *   **What the user sees**: The progress bar shows the user is on the final step, **"Step 2 of 2"**. The screen displays key details of the active deployment for confirmation (including the **Deployment Name**, **Project Name**, and **Start Date**). It also has a field an optional text box to add **Retrieval Notes** (e.g., "SD card was full," "Device damaged by animal").
    *   **What the buttons do**:
        *   **Back**: Takes the user back to the Device Selection screen.
        *   **End Deployment**: This is the final button. Tapping it marks the deployment as "Ended", stops the camera from recording new images, makes the camera available for a new deployment, and takes the user to the **Deployment Details Screen** to see the final summary.

### Prepare and Test Nearby Devices

This is a 2-step process for checking and configuring a camera *before* the user takes it out for deployment. **All activities are recorded in the database for audit and troubleshooting purposes.**

The user can start this flow from the **Devices Screen** or be redirected here from the **Start Deployment Wizard** if the user selects an unprepared camera.


*   **Step 1: Device Selection**
    *   **What the user sees**: This screen is identical to the first step of the **Start Deployment Wizard**. It takes over the full screen and shows a list of nearby Wildlife Watcher cameras that the app detects via Bluetooth.
    *   **What the buttons do**:
        *   **Camera in the list**: Tapping on a camera from the list selects it and attempts to connect. The app then verifies that this camera is not part of an active deployment and connects to it. If not, the app does not connect to the device and displays a message: "To prepare and test this device stop the active deployment this camera is associated with.". Upon successful connection, the user is taken to the **Step 2: Prepare and Test Nearby Devices**.
        *   **Refresh/Scan Again**: A button that lets the user re-scan for nearby cameras.
        *   **Cancel**: This button lets the user exit the flow and go back to the screen the user came from.
        *   **I can't find my device**: Tapping this link shows a pop-up with instructions on how to make the camera discoverable.

*   **Step 2: Prepare and Test Nearby Devices**
    *   **What the user sees**: This is a single, detailed screen where the user can manage all aspects of the camera. It shows:
        *   A view-only field for the **Device Name** (e.g., "WILD-Q7ZE").
        *   A view-only field for the camera's unique **Device ID**.
        *   The currently associated **Project**. Tapping this allows the user to assign the camera to a project.
        *   The camera's **Battery Level** and **SD Card Status** (e.g., "Ready", "No Card").
        *   The installed **BLE Firmware Version**, **Himax Firmware Version**, and **Config Version**. If an update is available for any component, a notification will appear.
        *   The **AI Model** currently on the device (read-only). The app checks if this matches the project's default model. If they don't match, a notification appears. Only Project Admins can change which AI model is used - this is set at the project level.
        *   The **LoRaWAN Status** (e.g., "Not Provisioned" or "Provisioned & Verified").
        *   If provisioned, the Device EUI (from devices.device_eui) and the name of the **LoRaWAN Network** it is registered to (from device_preparation.lorawan_network).
    *   **What the buttons do**:
        *   **Project Association**: Tapping the "Project" field opens a list of the user's projects, allowing the user to assign the camera to one. A camera must be associated with a project before it can be deployed.
        *   **Check Camera View**: Tapping this takes a test photo and displays it, so the user can confirm the lens is clear and the camera is working correctly. Test photos are stored in a dedicated "test" folder on the SD card.
        *   **Update Firmware**: This button appears if a newer version is available for ANY firmware component (BLE, Himax, or Config). When tapped, the app checks which components need updating and processes them sequentially. It performs safety checks (battery > 30%, not actively deployed). If checks pass, a confirmation dialog appears explaining the process will take 2-3 minutes. Tapping "Start Update" begins the process.
        *   **Update AI Model**: This button appears if the device's model doesn't match the project's required model. **For Beta:** Tapping it displays instructions: "To update the AI model: 1) Download the required Manifest.zip from [link], 2) Copy it to the SD card's root directory, 3) Re-insert the SD card into the camera." After the user completes this, they can tap "Verify Model" to confirm the correct version is present.
        *   **Verify Remote Updates**: If the LoRaWAN status is "Provisioned," this button will be visible. Tapping it, sends `ping\n` command, displays RSSI/SNR.
        *   **Finish Preparation**: This button saves any changes the user has made (like the project association), disconnects from the camera, and takes the user back to the screen the user came from. If the user came from the Start Deployment Wizard, the user will be returned to the wizard to continue the deployment.

---

## 4. Detail Screens

### Project Details Screen

This screen is a multi-purpose hub for viewing, creating, and editing a research project. The user gets here by tapping on a project card from the **Projects Screen** (to view an existing project) or by tapping the "+" button (to create a new one).

*   **What the user sees**:
    *   A title like "Project Details" (when viewing) or "New Project" (when creating).
    *   Fields for "Project Name" and "Project Description". These are editable when creating or editing, and view-only otherwise.
    *   A toggle switch for **"Is Baited?"** to indicate if bait is used in the project.
    *   A section for **"Sampling Design"** where the user must select at least one method from a list of choices (e.g., simpleRandom, systematicRandom, clusteredRandom, experimental, targeted, opportunistic). 
    *   When creating or editing, the user will also see settings for the project's default **Capture Method**:
        *   A choice between "Motion Detection" and "Time-lapse".
        *   If "Motion Detection" is selected, a slider for **Motion Sensitivity** (Low, Medium, High) appears.
        *   If "Time-lapse" is selected, a field for **Time-lapse Interval** (e.g., 30s, 1min, 5min) appears.
    *   When creating or editing (Project Admin only), the user will also see:
        *   **Default AI Model**: A dropdown to select which AI model all deployments in this project will use. This appears only for users with Project Admin role.
    *   When viewing an existing project, the user will also see:
        *   A list of all deployments associated with this project.
        *   A list of all team members working on this project.
*   **User Roles**:
    *   **Project Admin**: Has full control over the project. They can edit the project's details, add or remove team members, and change member roles. They can also do everything a Project Member can.
    *   **Project Member**: Can view project details and deployments. Their primary role is to contribute to the project by starting and ending camera deployments in the field.

*   **What the buttons do**:
    *   **Save Project**: When creating or editing a project, this button saves the user's changes. If the user is creating a new project, they automatically become its Project Admin, and the screen transitions to the standard "view" mode for their new project.
    *   **Edit Project**: If the user is a Project Admin viewing an existing project, this button will appear. Tapping it makes the "Project Name" and "Project Description" fields editable and replaces the "Edit" button with a "Save Project" button.
    *   **sampling design**: An information icon can be selected next to the sampling design to display the definitions of each option based on Wearn & Glover-Kapfer (2017) and used in camtrapdp, which is available at https://camtrap-dp.tdwg.org/metadata/#project.samplingDesign.
    *   **Default AI Model Selector**: (Project Admin only) Opens a list of available AI models for the organization. The selected model will be used by all cameras deployed in this project. Project Members cannot change this setting.
    *   **Manage Members**: When viewing a project as a Project Admin, this button takes the user to a separate screen where they can add or remove team members and change their roles. The Admin can search for and add any **existing user** from within their organization. New users cannot be invited via email.
    *   **Cancel/Back**: A back arrow in the header lets the user return to the **Projects Screen** without saving changes.

### Deployment Details Screen

This screen provides a complete, read-only summary of a single deployment. The user can get here by tapping on a deployment from the **Deployments Screen**, the **Device Details Screen** or from the "View Details" button on a map pin pop-up.

*   **What the user sees**:
    *   A header showing the deployment's name and its current status (e.g., "Active", "Ended").
    *   A "Deployment Info" section with details like the Project Name, Start Date, End Date (if applicable), Capture Method (Motion or Time-lapse), and Motion Sensitivity level or timelapse interval (if applicable).
    *   A "Device" section that acts as a clickable card, showing the Camera Name, its last known Battery Level, key operational statistics, and Firmware Version.
    *   A collapsible "Location" section with a map showing the exact GPS coordinates of the camera and the option to display the photos the user took *with the user's phone* of the camera's hiding spot, to help the user find it again.

*   **What the buttons do**:
    *   **Device Card**: Tapping anywhere on the "Device" section will take the user to the **[Device Details Screen](#device-details-screen)** for that specific camera.
    *   **End Deployment**: If the deployment is currently "Active", an "End Deployment" option will be available in the screen's menu (e.g., in the top-right corner). Tapping it will start the **[End Deployment Flow](#end-deployment-flow)**.

### Device Details Screen

This screen provides a complete overview of a specific camera's hardware information and its history. The user can get here by tapping on the device card from a **Deployment Details Screen**.

*   **What the user sees**:
    *   The device's name (e.g., "WILD-Q7ZE").
    *   The device's unique hardware ID (read-only).
    *   The currently installed Firmware Version and AI Model.
    *   The device's current status. If it is deployed, this will be a clickable link like "Deployed in 'Lion Study'".
    *   **Device Status Definition**: The device status is a calculated field with three possible states:
        *   **Deployed**: The camera is currently part of an active deployment in the field.
        *   **Prepared**: The camera is not deployed and has successfully passed the "Prepare and Test" workflow. The UI will show something like `Prepared on July 4th, 2025 at 14:21`.
        *   **Needs Preparation**: The camera is not deployed and has not yet been through the "Prepare and Test" workflow, or the last preparation was cancelled.
    *   A history section listing all past deployments this camera has been used for.

*   **What the buttons do**:
    *   **Deployment Status Link**: If the device is currently deployed, tapping on its status will take the user to the **[Deployment Details Screen](#deployment-details-screen)** for that specific deployment.
    *   **Prepare and Test**: If the device is not deployed (status is "Prepared" or "Needs Preparation"), a button will be visible to take the user to the **Prepare and Test Nearby Devices** screen for this device.


### Notifications Screen

This screen acts as a notification center where users can view and respond to pending invitations to join projects.

*   **What the user sees**:
    *   A title like "Project Invitations".
    *   A list of invitation "cards". If there are no pending invitations, a message like "You have no pending invitations" is displayed.
    *   Each card shows:
        *   The **Project Name** the user has been invited to.
        *   The name of the **Project Admin** who sent the invitation.
        *   The **Role** the user will have in the project (e.g., "Project Member").
    *   Two buttons on each card: "Accept" and "Decline".

*   **What the buttons do**:
    *   **Accept**: Tapping this button adds the user to the project with the specified role. The invitation is removed from the list, and the user is taken to the **Project Details Screen** for their new project.
    *   **Decline**: Tapping this button brings up a confirmation pop-up ("Are you sure you want to decline this invitation?"). If confirmed, the invitation is permanently removed from the list.
    *   **Cancel/Back**: A back arrow in the header lets the user return to the previous screen without taking any action.

---

### Feedback Screen

This screen provides a simple way for users to send feedback, bug reports, or suggestions directly to the Wildlife Watcher support team.

*   **What the user sees**:
    *   A title like "Send Feedback".
    *   A large, multi-line text box for the user to type their message.
    *   A "Send" button.

*   **What the buttons do**:
    *   **Send**: Tapping this button shows a loading indicator while it sends the feedback message to a nominated support email address. Once sent, it displays a "Thank you for your feedback!" confirmation message and automatically returns the user to the screen they were on before opening the side menu. If sending fails (e.g., no internet), it shows an error message and allows the user to retry.
    *   **Cancel/Back**: A back arrow in the header lets the user return to the previous screen without sending feedback.

### Profile Screen

This screen displays the user's personal account information. The user gets here by tapping "Profile" from the **[Side Drawer Menu](#5-side-drawer-menu)**.

*   **What the user sees**:
    *   Editable fields for "First Name" and "Last Name".
    *   A read-only field for the user's "Email Address". 
    *   The organization(s) the user belongs to.
    *   A "Reset Password" button.

*   **What the buttons do**:
    *   This screen is for viewing information only. To change the user's details, the user would need to contact a system administrator.
    *   **Reset Password**: Tapping this button will initiate the same password reset flow as the "Forgot Password?" link on the login screen, sending a secure reset link to the user's email.

### Settings Screen

This screen allows the user to customize how the app behaves, particularly regarding data usage and synchronization. The user gets here by tapping "Settings" from the **[Side Drawer Menu](#5-side-drawer-menu)**.

*   **What the user sees**:
    *   A "Data Synchronization" section with several options.

*   **What the buttons do**:
    *   **Sync on Wi-Fi only**: A switch that, when turned on, prevents the app from using the user's mobile data to upload information. It will wait until the user is connected to Wi-Fi.
    *   **Ask before syncing**: A switch that, when turned on, will make the app show the user a confirmation pop-up before it starts a large data upload.
    *   **Automatic sync**: This is the default setting. The app will automatically sync the user's data in the background whenever it has an internet connection.

---

## 5. Side Drawer Menu

This menu slides out from the left side of the screen when the user taps the "hamburger" menu icon (three horizontal lines) in the top-left corner. It gives the user access to the user's profile, app-wide settings, and other useful information.

*   **What the user sees**:
    *   The user's user profile name and a sync status indicator. This icon shows if the user's data is fully synced (green check), currently syncing (spinning arrows), pending upload (gray clock), or has encountered an error (red exclamation).
    *   A "Profile" link.
    *   A "Settings" link.
    *   An "Invitations" link, with a badge showing the number of pending invitations.
    *   A "Feedback to the WW team" link.
    *   A "Sign Out" button.
    *   The app's version number at the bottom (e.g., "v1.0.0").

*   **What the buttons do**:
    *   **Profile**: Takes the user to the **[Profile Screen](#profile-screen)** to view the user's user information.
    *   **Settings**: Takes the user to the **[Settings Screen](#settings-screen)** where the user can control app preferences, like how and when it syncs data.
    *   **Invitations**: Takes the user to the **[Invitations Screen](#invitations-screen)** to manage pending project invitations.
    *   **Feedback to the WW team**: Tapping this link opens the **[Feedback Screen](#feedback-screen)**.
    *   **Sign Out**: Securely logs the user out of the app and returns the user to the **Login Screen**.

---

## 6. Engineering Tools

This section describes tools intended for developers and hardware engineers for debugging and advanced interaction with the camera hardware. For MVP2 these features are still visible for all users.

### Engineer Console

The Engineer Console provides a direct, low-level command line interface to a connected camera, allowing engineers to send any text-based command and see the raw response from the device. This is essential for testing new firmware features, diagnosing hardware issues, and performing advanced configurations not exposed in the standard user interface.

*   **How to access**: From the **[Devices Screen](#devices-screen)**, a small button labeled **"Engineer Nearby Devices"** is available. Tapping this initiates the connection flow.

*   **Step 1: Device Selection**
    *   **What the user sees**: This screen is identical to the first step of the **Start Deployment Wizard**. It takes over the full screen and shows a list of nearby Wildlife Watcher cameras that the app detects via Bluetooth.
    *   **What the buttons do**:
        *   **Camera in the list**: Tapping on a camera from the list selects it and attempts to connect. Upon successful connection, the user is taken to the **Step 2: Console Interface**.
        *   **Refresh/Scan Again**: A button that lets the user re-scan for nearby cameras.
        *   **Cancel**: This button lets the user exit the flow and go back to the **Devices Screen**.

*   **Step 2: Console Interface**
    *   **What the user sees**:
        *   A large output area that displays all messages and responses received from the connected camera.
        *   A text input field at the bottom of the screen where the user can type commands.
        *   A "Send" button next to the input field.
    *   **What the buttons do**:
        *   **Send**: After typing a command into the input field (e.g., `battery`), tapping "Send" transmits the command to the camera. The camera's response (e.g., `Battery = 5482mV 73%`) will then appear in the output area above.

---