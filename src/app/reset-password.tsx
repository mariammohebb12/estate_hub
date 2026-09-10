import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { completePasswordRecovery, updatePassword } from '@/services/auth';
import { getFriendlyErrorMessage } from '@/utils/error-message';

type RecoveryStatus = 'pending' | 'ready' | 'invalid';

function extractRecoveryTokens(url: string) {
  const hashIndex = url.indexOf('#');
  const fragment = hashIndex !== -1 ? url.slice(hashIndex + 1) : '';
  const fragmentParams = new URLSearchParams(fragment);

  const queryIndex = url.indexOf('?');
  const query = queryIndex !== -1 ? url.slice(queryIndex + 1, hashIndex !== -1 ? hashIndex : undefined) : '';
  const queryParams = new URLSearchParams(query);

  return {
    accessToken: fragmentParams.get('access_token') ?? undefined,
    refreshToken: fragmentParams.get('refresh_token') ?? undefined,
    code: queryParams.get('code') ?? fragmentParams.get('code') ?? undefined,
  };
}

export default function ResetPasswordScreen() {
  const theme = useTheme();
  const router = useRouter();

  const [recoveryStatus, setRecoveryStatus] = useState<RecoveryStatus>('pending');
  const [recoveryError, setRecoveryError] = useState<string | null>(null);

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isSaved, setIsSaved] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const consumeUrl = async (url: string | null) => {
      if (!url || cancelled) return;
      const tokens = extractRecoveryTokens(url);
      if (!tokens.accessToken && !tokens.refreshToken && !tokens.code) return;

      const { error } = await completePasswordRecovery(tokens);
      if (cancelled) return;

      if (error) {
        console.error('reset-password: failed to complete password recovery', error);
        setRecoveryStatus('invalid');
        setRecoveryError(getFriendlyErrorMessage(error));
      } else {
        setRecoveryStatus('ready');
      }
    };

    Linking.getInitialURL().then(consumeUrl);
    const subscription = Linking.addEventListener('url', ({ url }) => consumeUrl(url));

    // Nothing arrived within a short window (e.g. the screen was opened
    // directly, not via a tapped recovery link) — treat it as invalid rather
    // than spinning forever.
    const timeout = setTimeout(() => {
      if (!cancelled) {
        setRecoveryStatus((current) => (current === 'pending' ? 'invalid' : current));
      }
    }, 4000);

    return () => {
      cancelled = true;
      subscription.remove();
      clearTimeout(timeout);
    };
  }, []);

  const handleSave = async () => {
    setSaveError(null);

    if (!newPassword || !confirmPassword) {
      setSaveError('Fill in both password fields.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setSaveError('Passwords do not match.');
      return;
    }
    if (newPassword.length < 6) {
      setSaveError('Password must be at least 6 characters.');
      return;
    }

    setIsSaving(true);
    const { error } = await updatePassword(newPassword);
    setIsSaving(false);

    if (error) {
      console.error('handleSave: failed to update password', error);
      setSaveError(getFriendlyErrorMessage(error));
    } else {
      setIsSaved(true);
    }
  };

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        {recoveryStatus === 'pending' ? (
          <ThemedView style={styles.centered}>
            <ActivityIndicator />
            <ThemedText themeColor="textSecondary" style={styles.centeredText}>
              Confirming your reset link…
            </ThemedText>
          </ThemedView>
        ) : recoveryStatus === 'invalid' ? (
          <ThemedView style={styles.centered}>
            <ThemedText type="title" style={styles.title}>
              Link invalid or expired
            </ThemedText>
            <ThemedText themeColor="textSecondary" style={styles.centeredText}>
              {recoveryError ?? 'This reset link is invalid or has expired. Request a new one from the login screen.'}
            </ThemedText>
            <Pressable
              onPress={() => router.replace('/login')}
              hitSlop={8}
              style={({ pressed }) => [styles.backToLoginLink, pressed && styles.pressed]}>
              <ThemedText type="linkPrimary">Back to log in</ThemedText>
            </Pressable>
          </ThemedView>
        ) : isSaved ? (
          <ThemedView style={styles.centered}>
            <ThemedText type="title" style={styles.title}>
              Password updated
            </ThemedText>
            <ThemedText themeColor="textSecondary" style={styles.centeredText}>
              Your password has been changed. You&apos;re now signed in.
            </ThemedText>
            <Pressable
              onPress={() => router.replace('/')}
              style={({ pressed }) => [styles.primaryButton, styles.continueButton, pressed && styles.pressed]}>
              <ThemedText style={styles.primaryButtonText}>Continue</ThemedText>
            </Pressable>
          </ThemedView>
        ) : (
          <>
            <ThemedView style={styles.header}>
              <ThemedText type="title" style={styles.title}>
                Set new password
              </ThemedText>
              <ThemedText themeColor="textSecondary">Choose a new password for your account.</ThemedText>
            </ThemedView>

            <ThemedView style={styles.form}>
              <TextInput
                placeholder="New password"
                placeholderTextColor={theme.textSecondary}
                secureTextEntry
                value={newPassword}
                onChangeText={setNewPassword}
                editable={!isSaving}
                style={[styles.input, { backgroundColor: theme.backgroundElement, color: theme.text }]}
              />
              <TextInput
                placeholder="Confirm new password"
                placeholderTextColor={theme.textSecondary}
                secureTextEntry
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                editable={!isSaving}
                style={[styles.input, { backgroundColor: theme.backgroundElement, color: theme.text }]}
              />

              {saveError ? <ThemedText style={styles.errorText}>{saveError}</ThemedText> : null}

              <Pressable
                onPress={handleSave}
                disabled={isSaving}
                style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed, isSaving && styles.disabled]}>
                {isSaving ? (
                  <ActivityIndicator color="#ffffff" />
                ) : (
                  <ThemedText style={styles.primaryButtonText}>Save Password</ThemedText>
                )}
              </Pressable>
            </ThemedView>
          </>
        )}
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: Spacing.four,
    gap: Spacing.five,
  },
  centered: {
    alignItems: 'center',
    gap: Spacing.two,
  },
  centeredText: {
    textAlign: 'center',
  },
  backToLoginLink: {
    marginTop: Spacing.two,
  },
  header: {
    gap: Spacing.two,
  },
  title: {
    fontSize: 32,
    lineHeight: 38,
    textAlign: 'center',
  },
  form: {
    gap: Spacing.three,
  },
  input: {
    height: 52,
    borderRadius: Spacing.three,
    paddingHorizontal: Spacing.three,
    fontSize: 16,
  },
  errorText: {
    color: '#D92D20',
  },
  primaryButton: {
    height: 52,
    borderRadius: Spacing.three,
    backgroundColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.one,
  },
  continueButton: {
    alignSelf: 'stretch',
    marginTop: Spacing.three,
  },
  primaryButtonText: {
    color: '#ffffff',
    fontWeight: '600',
  },
  pressed: {
    opacity: 0.85,
  },
  disabled: {
    opacity: 0.7,
  },
});
