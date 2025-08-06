# Wildlife Watcher Mobile App

Welcome to the development repository of the Wildlife Watcher mobile app. This document provides instructions for setting up and running the project on your local machine.

The Wildlife Watcher mobile app allows users to communicate with Wildlife Watcher cameras that record animals and use AI to identify them. Built with **Expo SDK 51** and **React Native 0.74.6** with **Supabase** backend integration.

**Project Overview**: [Watch on YouTube](https://www.youtube.com/watch?v=Ima3n2EYfeE)

## Tech Stack

- **Framework**: Expo SDK 51 with React Native 0.74.6
- **Backend**: Supabase (PostgreSQL, Auth, Storage, Edge Functions)
- **State Management**: Redux Toolkit with Supabase integration
- **UI Library**: React Native Paper with Material Design
- **BLE Communication**: react-native-ble-manager for device connectivity
- **Maps**: react-native-maps for location features
- **Development**: TypeScript with strict typing

## Prerequisites

This app now uses Expo SDK 51 with a managed workflow. Make sure you have the following prerequisites installed on your machine:

- **Node.js**: Version 18 or higher
- **Expo CLI**: For development and builds
- **EAS CLI**: For cloud builds and deployments
- **Android Studio**: For Android development and device connections (if developing for Android)
- **Xcode**: For iOS development (macOS only, if developing for iOS)

## Getting Started

1. Clone this repository to your local machine:

    ```bash
    git clone https://github.com/your-username/your-project.git
    cd your-project
    ```

2. Install project dependencies:

    ```bash
    npm install
    ```

3. Start the Expo development server:

    ```bash
    npm start
    # or
    npx expo start
    ```

## iOS Setup

For iOS development:

1. Ensure you have Xcode installed (macOS only)

2. Run the project in development mode:

    ```bash
    npm run ios
    # or
    npx expo run:ios
    ```

## Android Setup

For Android development:

1. Ensure you have Android Studio installed for device/emulator support

2. Run the project in development mode:

```bash
npm run android
# or
npx expo run:android
```

## Building and Releasing

The app uses EAS Build for cloud builds:

### Development Builds
```bash
eas build --profile development
```

### Production Builds
```bash
eas build --profile production
```

### Local Development
For local development, use the Expo development server:
```bash
npm start
```

Building and releasing is managed through EAS Build service. See the app configuration in `app.config.js` for build settings.

### Additional Commands

- `npm test` - Run Jest tests
- `npm run lint` - Run ESLint
- `npm run validate:deps` - Validate dependency compatibility
- `npm run deps` - Interactive dependency management CLI

## Contributing

If you wish to contribute to this project, submit a [pull request](https://github.com/wildlifeai/wildlife-watcher-mobile-app/pulls).

## Created & Maintained By

- [Miha Drofenik](https://github.com/Burzo)
- [Victor Anton](https://github.com/victor-wildlife)

If you find this project helpful, consider [donating to Wildlife.ai](https://givealittle.co.nz/donate/org/wildlifeai)
