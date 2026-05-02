import { registerRootComponent } from 'expo';
import "react-native-url-polyfill/auto"; // Required for Supabase
import { App } from "./src/App";

// Intercept specific benign Supabase auth errors (e.g., stale refresh tokens) 
// to display as warnings rather than throwing full app errors
const originalConsoleError = console.error;
console.error = (...args) => {
  const errorMsg = typeof args[0] === 'string' ? args[0] : (args[0] && args[0].toString ? args[0].toString() : '');
  if (errorMsg.includes('AuthApiError: Invalid Refresh Token: Refresh Token Not Found')) {
    console.warn('⚠️ [Supabase Auth]: Cleared invalid/stale refresh token.');
    return;
  }
  originalConsoleError(...args);
};

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
