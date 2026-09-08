import { useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/providers/auth-provider';
import { signOut } from '@/services/auth';
import { getCurrentMode, updateCurrentMode, type UserMode } from '@/services/profile';

const MODE_OPTIONS: { label: string; value: UserMode }[] = [
  { label: 'Buy', value: 'buy' },
  { label: 'Rent', value: 'rent' },
  { label: 'Sell', value: 'sell' },
];

export default function ProfileScreen() {
  const router = useRouter();
  const theme = useTheme();
  const { session } = useAuth();
  const userId = session?.user.id;

  const [mode, setMode] = useState<UserMode>('buy');
  const [isLoadingMode, setIsLoadingMode] = useState(true);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadMode = useCallback(async () => {
    if (!userId) return;
    const { data } = await getCurrentMode(userId);
    setMode(data);
  }, [userId]);

  useEffect(() => {
    setIsLoadingMode(true);
    loadMode().finally(() => setIsLoadingMode(false));
  }, [loadMode]);

  const handleSelectMode = async (nextMode: UserMode) => {
    if (!userId || nextMode === mode) return;
    const previousMode = mode;
    setMode(nextMode);

    const { error } = await updateCurrentMode(userId, nextMode);
    if (error) {
      console.error('handleSelectMode: failed to update current_mode', error);
      setMode(previousMode);
    }
  };

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
                  onPress={() => handleSelectMode(option.value)}
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

        {mode === 'sell' ? (
          <Pressable
            onPress={() => router.push('/my-listings')}
            style={({ pressed }) => [
              styles.myListingsRow,
              { backgroundColor: theme.backgroundElement },
              pressed && styles.pressed,
            ]}>
            <View style={styles.myListingsLeft}>
              <SymbolView
                name={{ ios: 'list.bullet', android: 'list', web: 'list' }}
                tintColor={theme.text}
                size={20}
              />
              <ThemedText type="smallBold">My Listings</ThemedText>
            </View>
            <SymbolView
              name={{ ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' }}
              tintColor={theme.textSecondary}
              size={18}
            />
          </Pressable>
        ) : null}

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
  myListingsRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: Spacing.three,
    padding: Spacing.three,
  },
  myListingsLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
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
