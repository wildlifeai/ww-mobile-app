import { useEffect } from 'react';
import * as Linking from 'expo-linking';
import { useNavigation } from '@react-navigation/native';
import { useAppNavigation } from './useAppNavigation';

export const useDeepLinking = () => {
  const navigation = useAppNavigation();

  useEffect(() => {
    console.log('useDeepLinking hook initialized');
    // Handle initial URL if app was opened by link
    const handleInitialURL = async () => {
      const url = await Linking.getInitialURL();
      if (url) {
        console.log('App opened with URL:', url);
        handleDeepLink(url);
      }
    };

    // Handle deep link
    const handleDeepLink = (url: string) => {
      console.log('Processing deep link:', url);

      // Parse the URL
      const { hostname, path, queryParams } = Linking.parse(url);
      console.log('Parsed URL:', { hostname, path, queryParams });

      // Parse fragment parameters (Supabase uses # instead of ?)
      let fragmentParams: Record<string, string> = {};
      if (url.includes('#')) {
        const fragment = url.split('#')[1];
        const pairs = fragment.split('&');
        pairs.forEach(pair => {
          const [key, value] = pair.split('=');
          if (key && value) {
            fragmentParams[key] = decodeURIComponent(value);
          }
        });
        console.log('Parsed fragment params:', fragmentParams);
      }

      // Merge query and fragment params (fragment takes priority)
      const allParams = { ...queryParams, ...fragmentParams };

      // Handle auth routes
      console.log('Checking if path includes auth routes:', path);

      if (path?.includes('reset-password')) {
        console.log('Found reset-password in path');
        // Support multiple token formats
        const token = (allParams.access_token || allParams.token_hash || allParams.token) as string;
        const type = allParams.type as string;
        const refreshToken = allParams.refresh_token as string;

        console.log('Token and type from params:', { token: token?.substring(0, 20) + '...', type, hasRefreshToken: !!refreshToken });

        if (token && type === 'recovery') {
          console.log('Navigating to ForgotPassword with token');
          navigation.navigate('ForgotPassword', {
            token,
            refreshToken,
            mode: 'reset'
          });
        } else {
          console.log('Token or type missing/invalid, params:', allParams);
        }
      } else if (path?.includes('auth/callback') || path?.includes('callback')) {
        // Support both token_hash and token parameters
        const token = (queryParams?.token_hash || queryParams?.token) as string;
        const type = queryParams?.type as string;

        if (token && type === 'signup') {
          console.log('Email confirmed, navigating to Login');
          navigation.navigate('Login', {
            confirmed: true
          });
        }
      }
    };

    // Set up listener for new URLs
    console.log('Setting up deep link listener in useDeepLinking...');
    const subscription = Linking.addEventListener('url', ({ url }) => {
      console.log('New URL received in useDeepLinking:', url);
      handleDeepLink(url);
    });

    // Check for initial URL
    handleInitialURL();

    // Cleanup
    return () => {
      subscription.remove();
    };
  }, [navigation]);
};