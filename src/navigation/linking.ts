import { LinkingOptions } from '@react-navigation/native';
import * as Linking from 'expo-linking';
import { getStateFromPath } from '@react-navigation/native';

const prefix = Linking.createURL('/');

console.log('Linking prefix:', prefix);

export const linking: LinkingOptions<any> = {
  prefixes: [
    prefix,
    'wildlifewatcher://',
    'com.wildlife.wildlifewatcher://',
    'exp://localhost:8081/',
    'exp://192.168.1.8:8081/', // Your local IP
  ],
  config: {
    screens: {
      Login: 'auth/callback',
      ForgotPassword: 'auth/reset-password',
      Register: 'auth/confirm',
      Home: '',
      // Add other screens as needed
    },
  },
  // Handle the auth tokens from deep links - DISABLED to avoid conflict with useDeepLinking hook
  getStateFromPath: (path, config) => {
    console.log('Deep link received:', path);
    console.log('Full URL being processed:', path);
    
    // Let useDeepLinking hook handle auth routes to avoid conflicts
    if (path && (path.includes('auth/reset-password') || 
        path.includes('auth/callback') || 
        path.includes('auth/confirm'))) {
      
      // Extract token from URL parameters for logging
      const params = new URLSearchParams(path.split('?')[1] || '');
      const tokenHash = params.get('token_hash');
      const type = params.get('type');
      
      console.log('Parsed params:', { tokenHash, type });
      console.log('Deferring to useDeepLinking hook for navigation');
      
      // Return null to let useDeepLinking hook handle the navigation
      return null;
    }
    
    // Default path handling for non-auth routes
    return getStateFromPath(path, config);
  },
  // Subscribe to incoming links
  subscribe: (listener) => {
    console.log('Setting up deep link listener...');
    const linkingSubscription = Linking.addEventListener('url', ({ url }) => {
      console.log('Link received via event:', url);
      console.log('Calling listener with URL:', url);
      listener(url);
    });

    return () => {
      console.log('Removing deep link listener');
      linkingSubscription.remove();
    };
  },
  getInitialURL: async () => {
    const url = await Linking.getInitialURL();
    console.log('Initial URL:', url);
    return url;
  },
};