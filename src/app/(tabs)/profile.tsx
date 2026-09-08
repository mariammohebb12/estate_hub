import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { signOut } from '@/services/auth';

export default function ProfileScreen() {
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleLogout = async () => {
    setErrorMessage(null);
    setIsSigningOut(true);
    const { error } = await signOut();
    setIsSigningOut(false);

    if (error) {
      setErrorMessage(error.message);
    }
    // On success, AuthProvider picks up the cleared session and routes back to the auth stack.
  };

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ThemedView style={styles.header}>
          <ThemedText type="title" style={styles.title}>
            Profile
          </ThemedText>
          <ThemedText themeColor="textSecondary" style={styles.subtitle}>
            Account info, mode switcher, and notification settings will live here.
          </ThemedText>
        </ThemedView>

        {errorMessage ? <ThemedText style={styles.errorText}>{errorMessage}</ThemedText> : null}

        <Pressable
          onPress={handleLogout}
          disabled={isSigningOut}
          style={({ pressed }) => [
            styles.logoutButton,
            pressed && styles.pressed,
            isSigningOut && styles.disabled,
          ]}>
          {isSigningOut ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <ThemedText style={styles.logoutButtonText}>Log Out</ThemedText>
          )}
        </Pressable>
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
    alignItems: 'center',
    gap: Spacing.four,
    paddingHorizontal: Spacing.four,
  },
  header: {
    gap: Spacing.two,
    alignItems: 'center',
  },
  title: {
    textAlign: 'center',
  },
  subtitle: {
    textAlign: 'center',
  },
  errorText: {
    color: '#D92D20',
    textAlign: 'center',
  },
  logoutButton: {
    height: 52,
    minWidth: 160,
    borderRadius: Spacing.three,
    backgroundColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.four,
  },
  logoutButtonText: {
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
