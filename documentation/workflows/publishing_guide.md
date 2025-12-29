
# Google Play Store Publishing Guide

This guide outlines the process for publishing the **Wildlife Watcher** app to the Google Play Store using Expo EAS (Exchange Client).

## Prerequisites

Before your first submission, ensure you have the following:

1.  **Google Play Developer Account**: You must have a paid developer account ($25 one-time fee).
2.  **Google Cloud Project**: You need a Google Cloud Project to manage the Android Management API.
3.  **Service Account Key (JSON)**: Required for EAS to upload builds automatically.

### 1. Setting up Google Service Account

To use `eas submit`, you need a Google Service Account Key.

1.  Open the [Google Cloud Console](https://console.cloud.google.com/).
2.  Create a new project (e.g., "Wildlife Watcher Play Store").
3.  Enable the **Google Play Android Developer API**.
4.  Navigate to **IAM & Admin** > **Service Accounts**.
5.  Click **Create Service Account**:
    *   **Name**: `eas-submit`
    *   **Role**: Service Account User (or owner if unsure)
6.  Click on the created Service Account > **Keys** > **Add Key** > **Create new key** > **JSON**.
7.  Save this file securely as `google-play-service-account.json` (Do NOT commit this to Git).
8.  Go to the [Google Play Console](https://play.google.com/console/).
9.  Navigate to **Users and identifiers** > **Service accounts**.
10. Click **Invite new user** and enter the email address of the service account you just created.
11. Grant the service account **Admin** permissions (or at least "Release apps to testing tracks" and "Manage app releases").

### 2. Configure EAS

Ensure your `eas.json` has a production submission profile.

```json
{
  "submit": {
    "production": {
      "android": {
        "serviceAccountKeyPath": "./google-play-service-account.json",
        "track": "internal"
      }
    }
  }
}
```

> **Note**: The `serviceAccountKeyPath` is relative to where you run the command. Alternatively, verify if the key is already uploaded to Expo using `eas secret:list`.

## Build and Submit Workflow

### Step 1: Versioning

The app version is automatically read from `package.json`.
Before building, bump the version:

```bash
npm version patch # or minor/major
```

This updates `package.json` and `app.config.ts` (via import) will reflect it.
Git commit this change.

### Step 2: Build the Production Bundle

Run the following command to build the Android App Bundle (.aab):

```bash
eas build --platform android --profile production
```

*   **Credentials**: If this is your first build, EAS will ask to generate a new Keystore. Select **Yes** and let EAS manage it.
*   **Wait**: The build happens on Expo's servers.

### Step 3: Submit to Google Play

Once the build is complete, you can submit it directly:

```bash
eas submit --platform android --profile production
```

If you just finished a build, it will ask if you want to submit the latest build. Select **Yes**.

### alternative: Build and Submit in One Command

```bash
eas build --platform android --profile production --auto-submit
```

## First Time Submission (Manual)

**Crucial**: Use `eas submit` for the *second* release onwards.
For the **very first release**, Google often requires you to upload the `.aab` manually via the dashboard to accept agreements and set up the store listing.

1.  Download the `.aab` from the Expo build page.
2.  Go to **Google Play Console** > **Create App**.
3.  Set up the **Store Listing** (Title, Description, Screenshots).
4.  Go to **Testing** > **Internal testing** (or Closed/Production).
5.  **Create new release**.
6.  Upload the `.aab`.
7.  Review and Rollout.

Once the first manual release exists, `eas submit` works for updates.

## Troubleshooting

### "Google Play API not enabled"
Ensure you enabled "Google Play Android Developer API" in the Google Cloud project linked to your Service Account.

### "Forbidden / Permission Denied"
Ensure the Service Account email is added to **Users and identifiers** in the Google Play Console and has "Admin" or "Release Manager" permissions.

### Keystore Issues
If you have an existing keystore (e.g. from an old non-EAS build), you must upload it to EAS:
`eas credentials` -> Android -> Keystore -> Upload existing.
Otherwise, let EAS generate a new one.
