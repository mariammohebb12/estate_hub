import { Link } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export default function SignupScreen() {
  const theme = useTheme();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

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
            style={[styles.input, { backgroundColor: theme.backgroundElement, color: theme.text }]}
          />
          <TextInput
            placeholder="Email"
            placeholderTextColor={theme.textSecondary}
            autoCapitalize="none"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
            style={[styles.input, { backgroundColor: theme.backgroundElement, color: theme.text }]}
          />
          <TextInput
            placeholder="Password"
            placeholderTextColor={theme.textSecondary}
            secureTextEntry
            value={password}
            onChangeText={setPassword}
            style={[styles.input, { backgroundColor: theme.backgroundElement, color: theme.text }]}
          />

          <Pressable style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}>
            <ThemedText style={styles.primaryButtonText}>Sign Up</ThemedText>
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
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
});
