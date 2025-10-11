import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import type { Database } from '../types/supabase';

// Get Supabase configuration
const supabaseUrl = Constants.expoConfig?.extra?.supabaseUrl;
const supabaseAnonKey = Constants.expoConfig?.extra?.supabaseAnonKey;

// Debug logging
console.log('🔧 Supabase Configuration:');
console.log('  URL:', supabaseUrl);
console.log('  Has Anon Key:', !!supabaseAnonKey);

// Create client factory function that defers validation
const createSupabaseClient = () => {
  // DEFER validation until actual client creation
  if (!supabaseUrl || !supabaseAnonKey) {
    // In test/dev environment, return null
    if (process.env.NODE_ENV === 'test' || process.env.JEST_WORKER_ID) {
      console.warn('⚠️  Supabase client unavailable in test environment');
      return null as any;  // Tests should mock this
    }

    // In production, throw clear error
    throw new Error(
      'Missing Supabase configuration. Please check your environment variables:\n' +
      '- EXPO_PUBLIC_SUPABASE_URL\n' +
      '- EXPO_PUBLIC_SUPABASE_ANON_KEY\n' +
      'These should be set in .env.local and exposed through app.config.js'
    );
  }

  return createClient<Database>(supabaseUrl, supabaseAnonKey, {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  });
};

// Create singleton instance
export const supabase = createSupabaseClient();

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