import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://fkqnlikynpntuzuarxnk.supabase.co';
const supabaseAnonKey = 'sb_publishable_F2IQq9EhJ43tOYmmQsDs8w_PhVy04t7';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);