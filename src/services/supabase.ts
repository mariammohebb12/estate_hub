import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';

const supabaseUrl = 'https://fkqnlikynpntuzuarxnk.supabase.co';
const supabaseAnonKey = 'sb_publishable_F2IQq9EhJ43tOYmmQsDs8w_PhVy04t7';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    // AsyncStorage's web implementation touches `window` eagerly, which breaks
    // Expo Router's server-side static export. On web, let supabase-js fall
    // back to its own browser-safe storage detection (localStorage).
    storage: Platform.OS === 'web' ? undefined : AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});