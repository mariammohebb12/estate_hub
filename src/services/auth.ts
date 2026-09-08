import { supabase } from '@/services/supabase';

type SignUpParams = {
  name: string;
  email: string;
  password: string;
};

type SignInParams = {
  email: string;
  password: string;
};

export async function signUpWithEmail({ name, email, password }: SignUpParams) {
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) {
    return { error };
  }

  if (data.user) {
    const { error: profileError } = await supabase
      .from('profiles')
      .insert({ id: data.user.id, full_name: name });
    if (profileError) {
      console.error('signUpWithEmail: failed to insert profile row', profileError);
      return { error: profileError };
    }
  }

  return { error: null };
}

export async function signInWithEmail({ email, password }: SignInParams) {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  return { error };
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  return { error };
}

export async function verifyPassword(email: string, password: string) {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  return { error };
}

export async function updatePassword(newPassword: string) {
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  return { error };
}
