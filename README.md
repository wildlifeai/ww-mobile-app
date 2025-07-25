# Wildlife Watcher mobile app

Welcome to the development repository of the Wildlife Watcher mobile app. This document provides instructions for setting up and running the project on your local machine.

The Wildlife Watcher mobile app allows users to communicate with Wildlife Watcher cameras that record animals and use AI to identify them.

**Project Overview**: [Watch on YouTube](https://www.youtube.com/watch?v=Ima3n2EYfeE)

## Prerequisites

Make sure you have the following prerequisites installed on your machine:

- **Node.js**: Version 18 or higher
- **EAS CLI**: `npm install -g eas-cli`
- **Android Device/Emulator** for testing on Windows/Linux.
- **Xcode** (for macOS developers wanting to run iOS simulators).

## Getting Started

1. Clone this repository to your local machine:

    ```bash
    git clone https://github.com/wildlifeai/wildlife-watcher-mobile-app.git
    cd wildlife-watcher-mobile-app
    ```

2. Install project dependencies:

    ```bash
    npm install
    ```
3. Login to your Expo account:
    ```bash
    eas login
    ```

## Development Workflow

This project uses a **Custom Development Client** built with EAS. This allows for a fast, iterative workflow similar to the Expo Go app, but with full support for native modules.

1. **Get the Development Client:**
   - Ask a team member for the latest development build, or build it yourself:
     ```bash
     # For Android
     eas build --profile development --platform android
     
     # For iOS (macOS only)
     eas build --profile development --platform ios
     ```
   - Install the generated `.apk` or `.app` file on your device/simulator.

2. **Start the Development Server:**
   ```bash
   npx expo start --dev-client
   ```

3. **Connect the App:**
   - **Android:** Open the app on your device. It should automatically connect to the server. If using WSL, you may need to run `adb reverse tcp:8081 tcp:8081` from your Windows terminal.
   - **iOS (macOS only):** Press `i` in the terminal where `expo start` is running to launch the app in your simulator.

## Releasing

Building and submitting the app is fully automated via the GitHub Actions workflow defined in `.github/workflows/build.yml`.

To create a new release, simply push a new version tag to the repository:
```bash
git tag v1.2.3
git push origin v1.2.3
```
This will trigger EAS to build for both iOS and Android and submit the builds to TestFlight and Firebase App Distribution.

## Contributing

If you wish to contribute to this project, submit a [pull request](https://github.com/wildlifeai/wildlife-watcher-mobile-app/pulls).

## Created & Maintained By

- [Miha Drofenik](https://github.com/Burzo)
- [Victor Anton](https://github.com/victor-wildlife)

If you find this project helpful, consider [donating to Wildlife.ai](https://givealittle.co.nz/donate/org/wildlifeai)
