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
      
      // Handle auth routes
      console.log('Checking if path includes auth routes:', path);
      
      if (path?.includes('reset-password')) {
        console.log('Found reset-password in path');
        const token = queryParams?.token_hash as string;
        const type = queryParams?.type as string;
        
        console.log('Token and type from queryParams:', { token, type });
        
        if (token && type === 'recovery') {
          console.log('Navigating to ForgotPassword with token');
          navigation.navigate('ForgotPassword', { 
            token, 
            mode: 'reset' 
          });
        } else {
          console.log('Token or type missing/invalid');
        }
      } else if (path?.includes('auth/callback') || path?.includes('callback')) {
        const token = queryParams?.token_hash as string;
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