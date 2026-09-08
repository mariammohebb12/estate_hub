import { supabase } from '@/services/supabase';

export type UserMode = 'buy' | 'rent' | 'sell';

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
