import { Link } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { signUpWithEmail } from '@/services/auth';
import { getFriendlyErrorMessage } from '@/utils/error-message';

export default function SignupScreen() {
  const theme = useTheme();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSignup = async () => {
    if (!name || !email || !password) {
      setErrorMessage('Fill in your name, email, and password.');
      return;
    }

    setErrorMessage(null);
    setIsSubmitting(true);
    const { error } = await signUpWithEmail({ name, email, password });
    setIsSubmitting(false);

    if (error) {
      console.error('handleSignup: failed to sign up', error);
      setErrorMessage(getFriendlyErrorMessage(error));
    }
    // On success, AuthProvider picks up the new session and routes into the tabs
    // (unless the project requires email confirmation, in which case there's no
    // session yet and the user stays here until they confirm).
  };

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ThemedView style={styles.header}>
          <ThemedText type="title" style={styles.title}>
            Create your account
          </ThemedText>
          <ThemedText themeColor="textSecondary">
            One account for buying, renting, and selling.
          </ThemedText>
        </ThemedView>

        <ThemedView style={styles.form}>
          <TextInput
            placeholder="Full name"
            placeholderTextColor={theme.textSecondary}
            value={name}
            onChangeText={setName}
            editable={!isSubmitting}
            style={[styles.input, { backgroundColor: theme.backgroundElement, color: theme.text }]}
          />
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
          <TextInput
            placeholder="Password"
            placeholderTextColor={theme.textSecondary}
            secureTextEntry
            value={password}
            onChangeText={setPassword}
            editable={!isSubmitting}
            style={[styles.input, { backgroundColor: theme.backgroundElement, color: theme.text }]}
          />

          {errorMessage ? <ThemedText style={styles.errorText}>{errorMessage}</ThemedText> : null}

          <Pressable
            onPress={handleSignup}
            disabled={isSubmitting}
            style={({ pressed }) => [
              styles.primaryButton,
              pressed && styles.pressed,
              isSubmitting && styles.disabled,
            ]}>
            {isSubmitting ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <ThemedText style={styles.primaryButtonText}>Sign Up</ThemedText>
            )}
          </Pressable>
        </ThemedView>

        <ThemedView style={styles.footer}>
          <ThemedText themeColor="textSecondary">Already have an account? </ThemedText>
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
  header: {
    gap: Spacing.two,
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
