import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useMode } from '@/providers/mode-provider';
import { signOut } from '@/services/auth';
import type { UserMode } from '@/services/profile';

const MODE_OPTIONS: { label: string; value: UserMode }[] = [
  { label: 'Buy', value: 'buy' },
  { label: 'Rent', value: 'rent' },
  { label: 'Sell', value: 'sell' },
];

export default function ProfileScreen() {
  const theme = useTheme();
  const { mode, isLoadingMode, setMode } = useMode();

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

        <ThemedView style={styles.section}>
          <ThemedText type="smallBold">Mode</ThemedText>
          <View style={styles.pillRow}>
            {MODE_OPTIONS.map((option) => {
              const selected = mode === option.value;
              return (
                <Pressable
                  key={option.value}
                  onPress={() => setMode(option.value)}
                  disabled={isLoadingMode}
                  style={[styles.pill, { backgroundColor: selected ? theme.text : theme.backgroundElement }]}>
                  <ThemedText type="small" style={{ color: selected ? theme.background : theme.text }}>
                    {option.label}
                  </ThemedText>
                </Pressable>
              );
            })}
          </View>
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
  section: {
    width: '100%',
    gap: Spacing.two,
  },
  pillRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  pill: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: Spacing.two,
    borderRadius: Spacing.five,
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
