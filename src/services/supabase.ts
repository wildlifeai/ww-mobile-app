import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import type { Database } from '../types/supabase';

// Get Supabase configuration from expo-constants
const supabaseUrl = Constants.expoConfig?.extra?.supabaseUrl;
const supabaseAnonKey = Constants.expoConfig?.extra?.supabaseAnonKey;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase configuration. Please check your environment variables:\n' +
    '- EXPO_PUBLIC_SUPABASE_URL\n' +
    '- EXPO_PUBLIC_SUPABASE_ANON_KEY\n' +
    'These should be set in .env.local and exposed through app.config.js'
  );
}

// Create Supabase client singleton with React Native specific configuration
export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    // Use AsyncStorage for session persistence in React Native
    storage: AsyncStorage,
    // Enable automatic session refresh
    autoRefreshToken: true,
    // Persist session in AsyncStorage
    persistSession: true,
    // Disable URL detection for React Native (not needed)
    detectSessionInUrl: false,
  },
});

// Export configuration for debugging/logging
export const supabaseConfig = {
  url: supabaseUrl,
  // Don't log the anon key for security
  hasAnonKey: !!supabaseAnonKey,
  projectRef: supabaseUrl.split('//')[1]?.split('.')[0],
};

// Helper function to check connection
export const checkSupabaseConnection = async () => {
  try {
    const { data, error } = await supabase.from('users').select('count').limit(1);
    if (error) {
      console.warn('Supabase connection check failed:', error.message);
      return false;
    }
    console.log('✅ Supabase connection successful');
    return true;
  } catch (error) {
    console.error('❌ Supabase connection error:', error);
    return false;
  }
};

export default supabase;