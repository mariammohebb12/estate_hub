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
  // The profiles row is created by the `on_auth_user_created` DB trigger (see
  // schema.sql), which runs inside Supabase Auth's own transaction — before
  // any session is handed back here. Creating it client-side used to race the
  // app's session-based navigation (AuthProvider routes into the tabs the
  // moment a session exists, which can happen before/independently of an
  // awaited client-side insert), silently leaving accounts without a profile.
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: name } },
  });

  return { error };
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

export async function requestPasswordReset(email: string, redirectTo: string) {
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
  return { error };
}

type RecoveryTokens = { accessToken?: string; refreshToken?: string; code?: string };

// A tapped recovery-email link lands here carrying either an implicit-flow
// access/refresh token pair (in the URL fragment) or a PKCE `code` (as a query
// param), depending on the project's Supabase Auth settings. Either one is
// exchanged for a real session so updatePassword() can then call
// supabase.auth.updateUser() as an authenticated recovery user.
export async function completePasswordRecovery({ accessToken, refreshToken, code }: RecoveryTokens) {
  if (accessToken && refreshToken) {
    const { error } = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
    return { error };
  }
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    return { error };
  }
  return { error: { message: 'This reset link is invalid or has expired.' } };
}
