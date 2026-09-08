import { supabase } from '@/services/supabase';

export type UserMode = 'buy' | 'rent' | 'sell';

export type Profile = {
  id: string;
  full_name: string | null;
  phone: string | null;
  avatar_url: string | null;
  current_mode: UserMode;
};

export async function getProfile(userId: string) {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, phone, avatar_url, current_mode')
    .eq('id', userId)
    .maybeSingle();

  return { data: data as Profile | null, error };
}

export async function updateProfile(userId: string, updates: { full_name: string; phone: string }) {
  const { error } = await supabase.from('profiles').update(updates).eq('id', userId);
  return { error };
}

export async function getCurrentMode(userId: string) {
  const { data, error } = await supabase
    .from('profiles')
    .select('current_mode')
    .eq('id', userId)
    .maybeSingle();

  return { data: (data?.current_mode as UserMode | undefined) ?? 'buy', error };
}

export async function updateCurrentMode(userId: string, mode: UserMode) {
  const { error } = await supabase.from('profiles').update({ current_mode: mode }).eq('id', userId);
  return { error };
}
