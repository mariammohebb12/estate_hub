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

export async function uploadAvatar(userId: string, localUri: string) {
  const extMatch = /\.([a-zA-Z0-9]+)$/.exec(localUri.split('?')[0]);
  const ext = extMatch?.[1]?.toLowerCase() ?? 'jpg';
  const path = `${userId}/avatar-${Date.now()}.${ext}`;

  const response = await fetch(localUri);
  const arrayBuffer = await response.arrayBuffer();

  const { error: uploadError } = await supabase.storage
    .from('avatars')
    .upload(path, arrayBuffer, { contentType: `image/${ext === 'jpg' ? 'jpeg' : ext}`, upsert: true });

  if (uploadError) {
    return { data: null, error: uploadError };
  }

  const { data } = supabase.storage.from('avatars').getPublicUrl(path);
  const { error: updateError } = await supabase
    .from('profiles')
    .update({ avatar_url: data.publicUrl })
    .eq('id', userId);

  if (updateError) {
    return { data: null, error: updateError };
  }

  return { data: data.publicUrl, error: null };
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
