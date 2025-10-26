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
    -   [Prepare and Test (Camera Workbench)](#prepare-and-test-camera-workbench)
4.  [Detail Screens](#4-detail-screens)
    -   [Project Details Screen](#project-details-screen)
    -   [Deployment Details Screen](#deployment-details-screen)
    -   [Device Details Screen](#device-details-screen)
    -   [LoRaWAN Registration Screen](#lorawan-registration-screen)
    -   [Profile Screen](#profile-screen)
    -   [Settings Screen](#settings-screen)
5.  [Side Drawer Menu](#5-side-drawer-menu)

---

## 1. Authentication Screens

These are the first screens a user sees when they open the app.

### Login Screen

This is the entry point to the app where users securely access their accounts.

*   **What you see**:
    *   The Wildlife Watcher logo and title.
    *   An "Email" field.
    *   A "Password" field.
    *   A "Remember me" checkbox.
    *   A "Sign In" button.
    *   Links for "Forgot Password?" and "Sign Up".

*   **What the buttons do**:
    *   **Sign In**: After you enter your email and password, this button logs you into the app, taking you to the main **Maps Screen**.
    *   **Remember me**: If you check this, the app will remember your login details for next time.
    *   **Forgot Password?**: Takes you to the **[Forgot Password Screen](#forgot-password-screen)** where you can enter your email to receive a password reset link.
    *   **Sign Up**: Takes you to the **[Sign Up Screen](#sign-up-screen)** where you can create a new account.

### Sign Up Screen

This screen allows new users to create their own Wildlife Watcher account directly from the app.

*   **What you see**:
    *   An "Email" field.
    *   A "Password" field.
    *   A "Confirm Password" field.
    *   A "Sign Up" button.
    *   A link to go "Back to Login".

*   **What the buttons do**:
    *   **Sign Up**: After you fill in your details, this button creates your new account. The app will then require you to verify your email address before you can log in.
    *   **Sign Up**: After you fill in your details, this button creates your new account. A confirmation message will appear, informing you to check your email for a verification link. After you dismiss this message, you will be automatically returned to the **[Login Screen](#login-screen)**.
    *   **Back to Login**: Takes you back to the **[Login Screen](#login-screen)** without creating an account.

### Forgot Password Screen

This screen helps users who have forgotten their password to regain access to their account.

*   **What you see**:
    *   An "Email" field.
    *   A "Send Reset Link" button.
    *   A message area to show confirmation or error messages.
    *   A link to go "Back to Login".

*   **What the buttons do**:
    *   **Send Reset Link**: After you enter the email address associated with your account, this button sends an email containing a secure link to reset your password. A confirmation message will appear on the screen to let you know the email has been sent. The app will automatically return you to the **[Login Screen](#login-screen)**.
    *   **Back to Login**: Takes you back to the **[Login Screen](#login-screen)**.

---

## 2. Main Navigation (Bottom Tabs)

Once logged in, you will see the main navigation elements that are always visible.

*   **Bottom Tab Bar**: At the bottom of the screen, there are four main tabs: **Maps**, **Projects**, **Deployments**, and **Devices**. You can tap these at any time to switch between the major sections of the app.
*   **Header Bar**: At the top-left of the screen, you'll see the a menu icon (three horizontal lines, often called a "hamburger" menu). Tapping this icon opens the **[Side Drawer Menu](#5-side-drawer-menu)**.


### Maps Screen (Home)

This is your command center for all field operations. It gives you a bird's-eye view of your deployments.

*   **What you see**:
    *   A map that defaults to your current location.
    *   Color-coded pins showing the location of all your camera deployments.
    *   A floating **blue** button in the bottom-right corner of the map labeled **"Start Deployment"**.
    *   A floating **orange** button in the bottom-right corner of the map labeled **"End Deployment"** (this only appears if you have active deployments).
    *   A button to re-center the map on your current location.
    *   A "Layers" icon in the top-right corner of the map.

*   **What the buttons do**:
    *   **Deployment Pins**: Tapping on a pin on the map opens a small pop-up summary of that deployment. This summary shows the **Deployment Name**, **Camera Name**, and **Status** (e.g., Active). It also displays the last known status using icons: a battery icon colored green (healthy), yellow (low), or red (critical), and an SD card icon colored similarly to show how full it is. The pop-up has a "View Details" button that takes you to the full **[Deployment Details Screen](#deployment-details-screen)**.
    *   **Start Deployment**: This is the main action button. Tapping it begins the 6-step **[Start Deployment Wizard](#start-deployment-wizard)** to set up a new camera in the field.
    *   **End Deployment**: Tapping this begins the **[End Deployment Flow](#end-deployment-flow)** for retrieving a camera.
    *   **Layers Icon**: Tapping this icon opens a menu that lets you control what is displayed on the map. You can filter deployments by status ("Active", "Ended"), by project, and distance from your current location.

### Projects Screen

This screen is like a digital filing cabinet for all your research projects.

*   **What you see**:
    *   A list of "cards," where each card represents one of your research projects.
    *   Each card shows the project's name, description, and how many team members and deployments it has.
    *   A search bar at the top to quickly find a specific project.
    *   A floating green "+" button at the bottom.

*   **What the buttons do**:
    *   **Project Card**: Tapping on a project card takes you to the **[Project Details Screen](#project-details-screen)** for that specific project.
    *   **"+" (Add Project) Button**: Tapping this takes you to the **[Project Details Screen](#project-details-screen)** in a "create" mode, where you can fill in the details for a new project.

### Deployments Screen

This screen provides a detailed list of every camera deployment you have access to, across all your projects.

*   **What you see**:
    *   A set of filter buttons at the top labeled **"Active"**, and **"Ended"**. The default setup is to have both active and ended selected.
    *   A list of deployment "cards," each showing key information like the project name, camera name, battery level, SD card space, and when data was last received.
    *   The cards are color-coded to show their status (e.g., green for healthy, red for ended).
    *   A floating blue "+" button at the bottom.

*   **What the buttons do**:
    *   **Filter Buttons**: Tapping "Active", or "Ended" will filter the list to show only those deployments.
    *   **Deployment Card**: Tapping on a card will take you to the **[Deployment Details Screen](#deployment-details-screen)**.
    *   **"+" (Start Deployment) Button**: Tapping this is a shortcut that begins the **[Start Deployment Wizard](#start-deployment-wizard)** to set up a new camera in the field.

### Devices Screen

This is your hardware management center, where you can see the status of your cameras and prepare them for the field.

*   **What you see**:
    *   A list of all cameras that are currently deployed.
    *   For each deployed camera, you can see its name, the project it's in, and its last known battery/SD card status.
    *   A prominent button labeled **"Prepare and Test Nearby Devices"**.

*   **What the buttons do**:
    *   **Prepare and Test Nearby Devices**: Tapping this button will make the app scan for any Wildlife Watcher cameras nearby that are *not* currently deployed. Selecting one takes you to the **[Camera Workbench](#prepare-and-test-camera-workbench)** screen.

---

## 3. Core Workflows

These are the multi-step processes for the most common tasks.

### Start Deployment Wizard

This multi-step wizard guides you through setting up a new camera in the field. It's designed to reduce the number of clicks in the field while maki sure users don't miss any critical information. The number of steps (either 4 or 5) depends on whether the camera is set up for remote updates.

*   **Step 1: Device Selection**
    *   **What you see**: This step takes over the full screen, so the main bottom tabs are temporarily hidden. At the top of the screen, a progress bar clearly indicates you are on **"Step 1"**. The screen has the "Select a Device" title and shows a list of available Wildlife Watcher cameras that the app detects nearby via Bluetooth. For each camera in the list, you'll see:
        *   The camera's name (e.g., "WW-Camera-101").
        *   A signal strength icon (like Wi-Fi bars) showing how strong the connection is.
    *   If no devices are found, a message "No devices found" is displayed, along with a link labelled **"I can't find my device"**.
    *   **What the buttons do**:
        *   **Camera in the list**: Tapping on a camera from the list selects it. The app then checks the camera's status. If the device has not been prepared or is not associated with a project, you will be redirected to the **[Prepare and Test (Camera Workbench)](#prepare-and-test-camera-workbench)** flow first. After you finish preparing the device, you will be returned to the wizard to continue the deployment. If the device is ready and registered for LoRaWAN, you will proceed to **Step 2: Connectivity Setup**. If the device is ready but *not* registered for LoRaWAN, you will skip Step 2 and go directly to **Step 3: Camera View & Adjustment**.
        *   **Refresh/Scan Again**: A button that lets you re-scan for nearby cameras if you don't see the one you are looking for.
        *   **Cancel**: This button lets you exit the wizard and go back to the screen you came from (usually the Maps screen).
        *   **I can't find my device**: Tapping this link shows a pop-up or a message with instructions: "To make your camera discoverable, press the button on the Wildlife Watcher until the blue Bluetooth icon lights up."
*   **Step 2: Connectivity Setup**
    *   **What you see**: This step is only shown if your camera is set up for LoRaWAN remote updates. The progress bar shows you are on **"Step 2 of 6"**. The name of the associated project is displayed at the top of the screen.The screen has a visual indicator (like signal bars) showing the current signal strength and the lorawan network name.
    *   **What the buttons do**:
        *   **Test Signal**: Tapping this button makes the camera send a test signal. The signal strength indicator will update, helping you find the best physical spot for the camera to ensure it can send updates.
        *   **Back**: Takes you back to Step 1: Device Selection.
        *   **Next**: Takes you to Step 3: Camera View & Adjustment.
*   **Step 3: Camera View & Adjustment**
    *   **What you see**: The progress bar shows your current step (either **"Step 2 of 4"** or **"Step 3 of 5"**). If your camera is not set up for LoRaWAN remote updates, the name of the associated project is displayed at the top of the screen. Below that, the screen displays a large image, which is the last test photo taken by the camera. The first time a user sees this screen there is no photo displayed. If you skipped the Connectivity step, a small message appears here reminding you that remote updates will not be available.
    *   **What the buttons do**:
        *   **Take Test Photo**: Tapping this button commands the camera to take a new picture, which then appears on the screen. This allows you to physically adjust the camera's position and take new photos until you are happy with the framing and field of view.
        *   **Back**: Takes you to Step 2: Connectivity Setup.
        *   **Next**: Once you are satisfied with the camera's view, this button takes you to Step 4: Location.
*   **Step 4: Location**
    *   **What you see**: The progress bar shows your current step. The screen contains an interactive map centered on your current location. The Latitude and Longitude fields are automatically pre-filled with your phone's current GPS coordinates. Below the map, there is a section to add photos of the camera's hiding spot, which will show thumbnails of any photos you've taken.
    *   **What the buttons do**:
        *   **Use My Current Location**: Tapping this button updates the Latitude and Longitude fields with your phone's current GPS coordinates. You can also drag the pin on the map to set the location manually.
        *   **Add Photo of Deployed Camera**: This button opens your *phone's* camera, allowing you to take pictures of the camera in its final, hidden position from different angles. These photos are saved with the deployment record to make the camera easier to find when you return to retrieve it. You can take multiple photos.
        *   **Photo Thumbnails**: Tapping on a photo thumbnail will open it in a full-screen view, where you can also choose to delete it.
        *   **Back**: Takes you to Step 3: Camera View & Adjustment.
        *   **Next**: Takes you to Step 5: Deployment Details.
*   **Step 5: Deployment Details**
    *   **What you see**: The progress bar shows you are on the final step. This screen is a form where you enter the final details for the deployment. You will see fields for:
        *   **Deployment Name**: A text field, pre-filled with a suggestion like "Deployment #123".
        *   **Capture Method**: A choice between "Motion Detection" and "Time-lapse".
        *   **Motion Sensitivity** or **Time-lapse Interval**: Depending on your choice above, you will see either a slider to set sensitivity (Low, Medium, High) or a field to set the time between photos (30s, 1min, 5min).
    *   **What the buttons do**:
        *   **Back**: Allows you to go back and make changes to any of the previous steps.
        *   **Submit Deployment**: This is the final button. Tapping it saves the deployment record to your app, sends the final configuration settings to the camera, and then shows a "Deployment Successful" message before taking you to the **Deployment Details Screen**.

### End Deployment Flow

This 2-step wizard guides you through retrieving a camera from the field and formally ending its monitoring session.

*   **Step 1: Device Selection**
    *   **What you see**: This screen is identical to the first step of the **Start Deployment Wizard**. It takes over the full screen and shows a list of nearby Wildlife Watcher cameras that the app detects via Bluetooth.
    *   **What the buttons do**:
        *   **Camera in the list**: Tapping on a camera from the list selects it and attempts to connect. The app then verifies that this camera is part of an active deployment.
        *   **Refresh/Scan Again**: A button that lets you re-scan for nearby cameras.
        *   **Cancel**: This button lets you exit the wizard and go back to the screen you came from.
        *   **I can't find my device**: Tapping this link shows a pop-up with instructions on how to make the camera discoverable.
*   **Step 2: Confirmation & Finalization**
    *   **What you see**: The progress bar shows you are on the final step, **"Step 2 of 2"**. The screen displays key details of the active deployment for confirmation (including the **Deployment Name**, **Project Name**, and **Start Date**). It also has a field an optional text box to add **Retrieval Notes** (e.g., "SD card was full," "Device damaged by animal").
    *   **What the buttons do**:
        *   **Back**: Takes you back to the Device Selection screen.
        *   **End Deployment**: This is the final button. Tapping it marks the deployment as "Ended," makes the camera available for a new deployment, and takes you to the **Deployment Details Screen** to see the final summary.

### Prepare and Test (Camera Workbench)

This is a 2-step process for checking and configuring a camera *before* you take it out for deployment. You can start this flow from the **Devices Screen** or be redirected here from the **Start Deployment Wizard** if you select an unprepared camera.

*   **Step 1: Device Selection**
    *   **What you see**: This screen is identical to the first step of the **Start Deployment Wizard**. It takes over the full screen and shows a list of nearby Wildlife Watcher cameras that the app detects via Bluetooth.
    *   **What the buttons do**:
        *   **Camera in the list**: Tapping on a camera from the list selects it and attempts to connect. Upon successful connection, you are taken to the **Step 2: Camera Workbench**.
        *   **Refresh/Scan Again**: A button that lets you re-scan for nearby cameras.
        *   **Cancel**: This button lets you exit the flow and go back to the screen you came from.
        *   **I can't find my device**: Tapping this link shows a pop-up with instructions on how to make the camera discoverable.

*   **Step 2: Camera Workbench**
    *   **What you see**: This is a single, detailed screen where you can manage all aspects of the camera. It shows:
        *   An editable field for the **Device Name**.
        *   A view-only field for the camera's unique **Device ID**.
        *   The currently associated **Project**. Tapping this allows you to assign the camera to a project.
        *   The camera's **Battery Level** and **SD Card Space**.
        *   The installed **Firmware Version**. If an update is available, a notification will appear.
        *   The installed **AI Model**. The app checks if this is the latest model available for the project. If an update is available, a notification will appear.
        *   The **LoRaWAN Status** (e.g., "Not Registered" or "Registered").
        *   If registered, the name of the **LoRaWAN Network** it is registered to.
    *   **What the buttons do**:
        *   **Project Association**: Tapping the "Project" field opens a list of your projects, allowing you to assign the camera to one. A camera must be associated with a project before it can be deployed.
        *   **Check Camera View**: Tapping this takes a test photo and displays it, so you can confirm the lens is clear and the camera is working correctly.
        *   **Update Firmware**: This button appears if a newer firmware version is available. Tapping it starts the update process.
        *   **Update AI Model**: This button appears if a newer AI model is available for the project. Tapping it starts the process of sending the new model file to the camera.
        *   **Register for Remote Updates**: If the LoRaWAN status is "Not Registered," this button will be visible. Tapping it takes you to the **[LoRaWAN Registration Screen](#lorawan-registration-screen)** to begin the one-time setup for the project's network.
        *   **Deregister Device**: If the LoRaWAN status is "Registered," this button will be visible instead. Tapping it will show a confirmation pop-up. Confirming will remove the device from its current LoRaWAN network, allowing it to be registered to a new one. This is useful when moving a camera between projects that use different networks.
        *   **Finish Preparation**: This button saves any changes you've made (like the device name or project association), disconnects from the camera, and takes you back to the screen you came from. If you came from the Start Deployment Wizard, you will be returned to the wizard to continue the deployment.

---

## 4. Detail Screens

### Project Details Screen

This screen is a multi-purpose hub for viewing, creating, and editing a research project. You get here by tapping on a project card from the **Projects Screen** (to view an existing project) or by tapping the "+" button (to create a new one).

*   **What you see**:
    *   A title like "Project Details" (when viewing) or "New Project" (when creating).
    *   Fields for "Project Name" and "Project Description". These are editable when creating or editing, and view-only otherwise.
    *   When viewing an existing project, you will also see:
        *   A list of all deployments associated with this project.
        *   A list of all team members working on this project.

*   **What the buttons do**:
    *   **Save Project**: When creating or editing a project, this button saves your changes. If you are creating a new project, you automatically become its Project Admin, and the screen transitions to the standard "view" mode for your new project.
    *   **Edit Project**: If you are a Project Admin viewing an existing project, this button will appear. Tapping it makes the "Project Name" and "Project Description" fields editable and replaces the "Edit" button with a "Save Project" button.
    *   **Manage Members**: When viewing a project as a Project Admin, this button takes you to a separate screen where you can add or remove team members and change their roles.
    *   **Start New Deployment**: A shortcut to start a new deployment that is automatically assigned to this project.
    *   **Cancel/Back**: A back arrow in the header lets you return to the **Projects Screen** without saving changes.

### Deployment Details Screen

This screen provides a complete, read-only summary of a single deployment. You can get here by tapping on a deployment from the **Deployments Screen**, the **Device Details Screen** or from the "View Details" button on a map pin pop-up.

*   **What you see**:
    *   A header showing the deployment's name and its current status (e.g., "Active", "Ended").
    *   A "Deployment Info" section with details like the Project Name, Start Date, End Date (if applicable), Capture Method (Motion or Time-lapse), and Motion Sensitivity level or timelapse interval (if applicable).
    *   A "Device" section that acts as a clickable card, showing the Camera Name, its last known Battery Level, SD Card space, and Firmware Version.
    *   A collapsible "Location" section with a map showing the exact GPS coordinates of the camera and the option to display the photos you took *with your phone* of the camera's hiding spot, to help you find it again.
    

*   **What the buttons do**:
    *   **Device Card**: Tapping anywhere on the "Device" section will take you to the **[Device Details Screen](#device-details-screen)** for that specific camera.
    *   **End Deployment**: If the deployment is currently "Active", an "End Deployment" option will be available in the screen's menu (e.g., in the top-right corner). Tapping it will start the **[End Deployment Flow](#end-deployment-flow)**.

### Device Details Screen

This screen provides a complete overview of a specific camera's hardware information and its history. You can get here by tapping on the device card from a **Deployment Details Screen**.

*   **What you see**:
    *   The device's custom name (e.g., "Camera-101-SiteA").
    *   The device's unique hardware ID (read-only).
    *   The currently installed Firmware Version and AI Model.
    *   The device's current status. If it is deployed, this will be a clickable link like "Deployed in 'Lion Study'".
    *   A history section listing all past deployments this camera has been used for.

*   **What the buttons do**:
    *   **Deployment Status Link**: If the device is currently deployed, tapping on its status will take you to the **[Deployment Details Screen](#deployment-details-screen)** for that specific deployment.
    *   **Prepare and Test**: If the device is "Available" (not deployed), a button will be visible to take you to the **[Prepare and Test (Camera Workbench)](#prepare-and-test-camera-workbench)** screen for this device.

### LoRaWAN Registration Screen (TBC with CP)

This screen guides you through the one-time process of registering your camera to send remote health updates. You get here by tapping "Register for Remote Updates" from the **[Camera Workbench](#prepare-and-test-camera-workbench)**.

*   **What you see**:
    *   A title like "Register for Remote Updates".
    *   A brief explanation of what LoRaWAN is and why registration is needed (e.g., "This process will securely register your camera with the network so it can send battery and SD card status from the field.").
    *   A "Start Registration" button.
    *   Once started, you'll see a progress indicator showing the current step, such as "Contacting server...", "Sending security keys to camera...", and finally "Registration Complete!".

*   **What the buttons do**:
    *   **Start Registration**: Tapping this button begins the automated registration process. The app communicates with the backend server, which in turn registers the device with the LoRaWAN network and gets the necessary security keys. The app then sends these keys to the camera.
    *   **Cancel/Back**: A back arrow in the header lets you return to the **Camera Workbench** without registering the device.

### Profile Screen

This screen displays your personal account information. You get here by tapping "Profile" from the **[Side Drawer Menu](#5-side-drawer-menu)**.

*   **What you see**:
    *   Your full name.
    *   Your email address.
    *   The organization(s) you belong to.
    *   Your role(s) within the app (e.g., Project Admin, Project Member).

*   **What the buttons do**:
    *   This screen is for viewing information only. To change your details, you would need to contact a system administrator.

### Settings Screen

This screen allows you to customize how the app behaves, particularly regarding data usage and synchronization. You get here by tapping "Settings" from the **[Side Drawer Menu](#5-side-drawer-menu)**.

*   **What you see**:
    *   A "Data Synchronization" section with several options.

*   **What the buttons do**:
    *   **Sync on Wi-Fi only**: A switch that, when turned on, prevents the app from using your mobile data to upload information. It will wait until you are connected to Wi-Fi.
    *   **Ask before syncing**: A switch that, when turned on, will make the app show you a confirmation pop-up before it starts a large data upload.
    *   **Automatic sync**: This is the default setting. The app will automatically sync your data in the background whenever it has an internet connection.

---

## 5. Side Drawer Menu

This menu slides out from the left side of the screen when you tap the "hamburger" menu icon (three horizontal lines) in the top-left corner. It gives you access to your profile, app-wide settings, and other useful information.

*   **What you see**:
    *   Your user profile name and a sync status indicator (showing if your data is saved to the cloud).
    *   A "Profile" link.
    *   A "Settings" link.
    *   A "Sign Out" button.
    *   The app's version number at the bottom (e.g., "v1.0.0").

*   **What the buttons do**:
    *   **Profile**: Takes you to the **[Profile Screen](#profile-screen)** to view your user information.
    *   **Settings**: Takes you to the **[Settings Screen](#settings-screen)** where you can control app preferences, like how and when it syncs data.
    *   **Sign Out**: Securely logs you out of the app and returns you to the **Login Screen**.

---
