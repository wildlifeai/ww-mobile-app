// Import URL polyfill for React Native (required for Supabase)
import 'react-native-url-polyfill/auto';

import { AppRegistry } from 'react-native';
import { name as appName } from './app.json';

console.log("Loading main Wildlife Watcher app...");
console.log("App name from app.json:", appName);

try {
  const { App } = require('./src/App');
  console.log("App component loaded successfully:", !!App);
  
  // Register with both "main" (for dev client) and the app name (for standalone)
  AppRegistry.registerComponent('main', () => App);
  AppRegistry.registerComponent(appName, () => App);
  
  console.log("App registered successfully with names: main and", appName);
} catch (error) {
  console.error("Error loading App component:", error);
  // Fallback to a simple component
  const React = require('react');
  const { Text, View } = require('react-native');
  const FallbackApp = () => React.createElement(View, { style: { flex: 1, justifyContent: 'center', alignItems: 'center' } }, React.createElement(Text, null, 'Error loading app: ' + (error?.message || error?.toString() || 'Unknown error')));
  AppRegistry.registerComponent('main', () => FallbackApp);
  AppRegistry.registerComponent(appName, () => FallbackApp);
}