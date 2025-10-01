Copy of Slack message - Review points for kk-review-points-of-implemenration-spec-v1.3.md document
Date 28 Aug 2025
-----------------------------------------------------------------------------------------------------------

Karolina Kisiel (Project Manager / Analyst / Design Coordinator)  11:18 AM
Hey Adarsh, I'm just reading through the document - it's amazing! thanks for putting it together :slightly_smiling_face: so clear and detailed.
I have a few questions or clarifications (sorry) - some are things that we will not need for the initial  release so I wonder if we should call them out somehow (or move them to Phase 2 section):
- Section 2 - the auth part, where you talk about password reset: 'However, the password reset flow currently opens the app and needs modification to support web-based reset for users accessing the link from other devices - this is critical for teams where password reset emails might be accessed on different devices than the phone with the app.' - I just want to understand if we need a web based reset? and why? what would be the scenario where they have to reset their password but don't have access to the app? Also, I think initially we might be able to get away with just having the Forget Password flow? Unless this is easy to implement!
    - it's also mentioned in the Dev Environment status section: ':large_yellow_circle: Password reset needs web form implementation (critical for MVP)'
    - and 13.2 - 'Password Reset Web Form'
- Section 2 - This section is repeated, can i delete one of them?: 'The navigation structure is in place with bottom tabs and drawer menu configured. The Maps screen exists but needs the floating action buttons for deployment workflows. Basic Redux store configuration is complete, ready for feature-specific slices to be added as development progresses.'
- Section 2 - We might want to remove the last part, following our chat on Thursday: 'The start and end deployment flows exist partially but need completion, particularly the project selection improvements (card-based UI instead of dropdown)'
- Section 2 - And just checking that this is just that admin panel where admins (us) can add or edit users? As we won't let users themselves change any of the user details initially: 'User profile management needs to be added, initially as optional fields with indicators showing when profiles are incomplete.'
- Section 3 - For this section maybe it would be good to give a specific example? (e.g. what happens when there are different locations specified for the same device deployment, I don't think it matters initially how this is handled but it's just good to know how it works :slightly_smiling_face:: 'The sync system uses intelligent conflict resolution - for instance, if two team members edit the same project offline, member lists are merged (union of both)'
- Section 4.1, is this document looking towards the future? because initially we will only allow WW admins to add user accounts, so only: 'Path 3: WW Admin Provisioning - System administrators can directly create user accounts through the admin portal, useful for pre-configuring accounts for field teams or workshop participants.'
- Section 4.1 - and as part of the Mandatory Profile Information (registration):  do we need to specify the email address and role is also collected?
- Section 4.2 - as for the roles, I assume that the Field Support Admin role is the project admin and project member?
- Section 4.2 - And also there will be a role of Model manager, who will be uploading models for their organisation, is this covered by the System Oversight Admin role (because Model manager will have to sit on the organisational level, so cross-project) or more WW Admin role (although this role will initially only be available to us)? We also might need to cater for users having multiple roles - maybe we can dd it to this section: 4.2.2 Field Operations Reality - i.e. model manager and field support admin
- Section 4.3 - as mentioned somewhere above we will not have a full profile management section for the user to see initially. This section might need more consideration for the future. But we will have an admin panel for WW Admins to add and edit users info but only the basic stuff: name, email, org, role (not profile pic)
- Section 5.1.1 - it would be great to understand what is the minimum that the WW admin user (us) needs to do for the initial release so we can provide some designs. Would it be just the user management component? (we can discuss). And the rest we can fit into the roadmap somehow.
- Section 5.2 - in terms of the offline maps, there is an option to pre-download in Settings, but do we need it, and do we need the 'Settings' section in the app? what other elements would user need to set or edit? Would it be the timezone and notifications, etc? can we just pre-set or hard-code those values for the initial release, since all customers will be in NZ?
- Section 5.3 Step 1- we probably don't need to do any of these apart from the sync status for the project info and FAB for new projects
    - Card-based UI replacing dropdown for better mobile UX
    - Search bar for filtering projects (essential for users with many projects)
    - **Each project card shows sync status, member count, deployment statistics**
    - **FAB for creating new project**
    - Auto-generated deployment name with user customization
- Section 5.3 Step 2 - the same with adding members to projects, we don't need to add members from this flow, if they don't exist, they don't appear, so we don't need this initially: 'If not: Queue invitation email for when online'
- Section 5.3 Step 4 - I'm not sure what this would entail but probably don't need for initial release: 'Smart defaults based on project type'
- Section 5.3 Step 5 - I might need some guidance as to what some of these points mean in terms of the UX, any changes to the interface? :smile:
- Section 5.5 - we probably don't need the search and filter capabilities initially
- Section 5.5 - And after successful deployment we show a confirmation message with a button to go back to the main page (not deployments)
- Section 5.6 - not sure if we want to add 'Select organisation' here? because when we are adding users we will need to specify that info too. We will not have an account set up flow as such (it will only be the password set up). So this info can be collected when adding a member if possible. Also, do we need a flow of actually creating organisations? I assume that will be in the same admin panel?
- Section 5.7 - initially we don't need tabs and we will only have two statuses (but in the future it would be good to look at something like what you proposed):
    - Green - for active deployment
    - Red - for ended
- Section 5.8 - We also would like to display the link to 'Check camera view' but only for the deployed devices really (i guess it doesn't matter if they're deployed or not but it's more important for active deployments) AND we would also like to display what model the device has loaded, but only on deployed devices (otherwise there is no model uploaded onto a device, this happens at start deployment)
- Section 5.8 - We should also display battery life and SD card storage space in this section
- Section 10.1 - thanks, that prompts us to write privacy policy and ToS
- Section 15.1
    - User profile screen layout - we probably don't need it yet.
    - Do we need this developer menu? Are there clear requirements on what this is supposed to be included and look like? who will be making those decisions?
    - Confirm LoRaWAN message format from hardware team - would that be confirming what the user message will look like or payload?
    - Validate offline conflict resolution rules - do you have recommendations of what this could look like? :slightly_smiling_face:
- Section 15.5 - we might need to move some of the features proposed in the document to Phase 2