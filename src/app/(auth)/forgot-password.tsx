import * as Linking from 'expo-linking';
import { Link, useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { requestPasswordReset } from '@/services/auth';
import { getFriendlyErrorMessage } from '@/utils/error-message';

export default function ForgotPasswordScreen() {
  const theme = useTheme();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleSubmit = async () => {
    if (!email.trim()) {
      setErrorMessage('Enter your email.');
      return;
    }

    setErrorMessage(null);
    setIsSubmitting(true);
    const { error } = await requestPasswordReset(email.trim(), Linking.createURL('/reset-password'));
    setIsSubmitting(false);

    if (error) {
      console.error('handleSubmit: failed to request password reset', error);
      setErrorMessage(getFriendlyErrorMessage(error));
    } else {
      setIsSubmitted(true);
    }
  };

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <Pressable onPress={() => router.back()} hitSlop={8} style={styles.backButton}>
          <View style={[styles.backButtonCircle, { backgroundColor: theme.backgroundElement }]}>
            <SymbolView
              name={{ ios: 'chevron.left', android: 'chevron_left', web: 'chevron_left' }}
              tintColor={theme.text}
              size={20}
            />
          </View>
        </Pressable>

        {isSubmitted ? (
          <ThemedView style={styles.header}>
            <View style={[styles.successIconWrap, { backgroundColor: theme.backgroundElement }]}>
              <SymbolView
                name={{ ios: 'envelope.badge.fill', android: 'mark_email_read', web: 'mark_email_read' }}
                tintColor={theme.text}
                size={28}
              />
            </View>
            <ThemedText type="title" style={styles.title}>
              Check your email
            </ThemedText>
            <ThemedText themeColor="textSecondary">
              We sent a password reset link to {email.trim()}. Open it on this device to set a new password.
            </ThemedText>
          </ThemedView>
        ) : (
          <>
            <ThemedView style={styles.header}>
              <ThemedText type="title" style={styles.title}>
                Forgot password?
              </ThemedText>
              <ThemedText themeColor="textSecondary">
                Enter the email on your account and we&apos;ll send you a link to reset your password.
              </ThemedText>
            </ThemedView>

            <ThemedView style={styles.form}>
              <TextInput
                placeholder="Email"
                placeholderTextColor={theme.textSecondary}
                autoCapitalize="none"
                keyboardType="email-address"
                value={email}
                onChangeText={setEmail}
                editable={!isSubmitting}
                style={[styles.input, { backgroundColor: theme.backgroundElement, color: theme.text }]}
              />

              {errorMessage ? <ThemedText style={styles.errorText}>{errorMessage}</ThemedText> : null}

              <Pressable
                onPress={handleSubmit}
                disabled={isSubmitting}
                style={({ pressed }) => [
                  styles.primaryButton,
                  pressed && styles.pressed,
                  isSubmitting && styles.disabled,
                ]}>
                {isSubmitting ? (
                  <ActivityIndicator color="#ffffff" />
                ) : (
                  <ThemedText style={styles.primaryButtonText}>Send Reset Link</ThemedText>
                )}
              </Pressable>
            </ThemedView>
          </>
        )}

        <ThemedView style={styles.footer}>
          <ThemedText themeColor="textSecondary">Remembered it? </ThemedText>
          <Link href="/login">
            <ThemedText type="linkPrimary">Log in</ThemedText>
          </Link>
        </ThemedView>
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
  backButton: {
    position: 'absolute',
    top: Spacing.three,
    left: Spacing.three,
  },
  backButtonCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    gap: Spacing.two,
  },
  successIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.one,
  },
  title: {
    fontSize: 32,
    lineHeight: 38,
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
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
});
