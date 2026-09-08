import { useEffect, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/providers/auth-provider';
import { useMode } from '@/providers/mode-provider';
import { signOut, updatePassword, verifyPassword } from '@/services/auth';
import { getProfile, updateProfile } from '@/services/profile';
import type { UserMode } from '@/services/profile';

function getInitials(name: string | null, email: string | null) {
  const source = name?.trim() || email?.trim() || '';
  if (!source) return '?';
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return source.slice(0, 2).toUpperCase();
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  const theme = useTheme();
  return (
    <View style={styles.section}>
      <ThemedText type="smallBold" themeColor="textSecondary" style={styles.sectionTitle}>
        {title}
      </ThemedText>
      <View style={[styles.sectionCard, { backgroundColor: theme.backgroundElement }]}>{children}</View>
    </View>
  );
}

function FieldLabel({ children }: { children: ReactNode }) {
  return (
    <ThemedText type="small" themeColor="textSecondary">
      {children}
    </ThemedText>
  );
}

export default function ProfileScreen() {
  const theme = useTheme();
  const { session } = useAuth();
  const { mode, isLoadingMode, setMode } = useMode();
  const userId = session?.user.id;
  const email = session?.user.email ?? null;

  const [isLoadingProfile, setIsLoadingProfile] = useState(true);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [profileFeedback, setProfileFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(
    null,
  );

  const [buyRentChoice, setBuyRentChoice] = useState<'buy' | 'rent'>('buy');

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordFeedback, setPasswordFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(
    null,
  );

  const [isSigningOut, setIsSigningOut] = useState(false);
  const [logoutError, setLogoutError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) {
      setIsLoadingProfile(false);
      return;
    }

    let cancelled = false;
    setIsLoadingProfile(true);
    getProfile(userId).then(({ data }) => {
      if (cancelled) return;
      setFullName(data?.full_name ?? '');
      setPhone(data?.phone ?? '');
      setAvatarUrl(data?.avatar_url ?? null);
      setIsLoadingProfile(false);
    });

    return () => {
      cancelled = true;
    };
  }, [userId]);

  useEffect(() => {
    if (mode === 'buy' || mode === 'rent') {
      setBuyRentChoice(mode);
    }
  }, [mode]);

  const handleSaveProfile = async () => {
    if (!userId) return;
    setProfileFeedback(null);
    setIsSavingProfile(true);
    const { error } = await updateProfile(userId, { full_name: fullName.trim(), phone: phone.trim() });
    setIsSavingProfile(false);

    if (error) {
      setProfileFeedback({ type: 'error', message: 'Failed to save changes.' });
    } else {
      setProfileFeedback({ type: 'success', message: 'Saved.' });
    }
  };

  const handleSelectBuyRent = async (value: 'buy' | 'rent') => {
    setBuyRentChoice(value);
    if (mode !== 'sell') {
      await setMode(value);
    }
  };

  const handleToggleSell = async (isSellOn: boolean) => {
    const nextMode: UserMode = isSellOn ? 'sell' : buyRentChoice;
    await setMode(nextMode);
  };

  const handleChangePassword = async () => {
    setPasswordFeedback(null);

    if (!currentPassword || !newPassword || !confirmPassword) {
      setPasswordFeedback({ type: 'error', message: 'Fill in all password fields.' });
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordFeedback({ type: 'error', message: 'New passwords do not match.' });
      return;
    }
    if (newPassword.length < 6) {
      setPasswordFeedback({ type: 'error', message: 'New password must be at least 6 characters.' });
      return;
    }
    if (!email) {
      setPasswordFeedback({ type: 'error', message: 'Could not verify your account email.' });
      return;
    }

    setIsChangingPassword(true);

    const { error: verifyError } = await verifyPassword(email, currentPassword);
    if (verifyError) {
      setIsChangingPassword(false);
      setPasswordFeedback({ type: 'error', message: 'Current password is incorrect.' });
      return;
    }

    const { error: updateError } = await updatePassword(newPassword);
    setIsChangingPassword(false);

    if (updateError) {
      setPasswordFeedback({ type: 'error', message: updateError.message });
    } else {
      setPasswordFeedback({ type: 'success', message: 'Password updated.' });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    }
  };

  const handleLogout = async () => {
    setLogoutError(null);
    setIsSigningOut(true);
    const { error } = await signOut();
    setIsSigningOut(false);

    if (error) {
      setLogoutError(error.message);
    }
    // On success, AuthProvider picks up the cleared session and routes back to the auth stack.
  };

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            {avatarUrl ? (
              <Image source={{ uri: avatarUrl }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, styles.avatarPlaceholder, { backgroundColor: theme.backgroundElement }]}>
                <ThemedText type="subtitle">{getInitials(fullName, email)}</ThemedText>
              </View>
            )}
            <ThemedText type="title" style={styles.name}>
              {isLoadingProfile ? ' ' : fullName || 'Your name'}
            </ThemedText>
            <ThemedText themeColor="textSecondary">{email}</ThemedText>
          </View>

          <Section title="ACCOUNT">
            <View style={styles.field}>
              <FieldLabel>Full name</FieldLabel>
              <TextInput
                value={fullName}
                onChangeText={setFullName}
                placeholder="Your name"
                placeholderTextColor={theme.textSecondary}
                style={[styles.input, { color: theme.text, borderColor: theme.backgroundSelected }]}
              />
            </View>
            <View style={styles.field}>
              <FieldLabel>Phone</FieldLabel>
              <TextInput
                value={phone}
                onChangeText={setPhone}
                placeholder="Phone number"
                placeholderTextColor={theme.textSecondary}
                keyboardType="phone-pad"
                style={[styles.input, { color: theme.text, borderColor: theme.backgroundSelected }]}
              />
            </View>

            {profileFeedback ? (
              <ThemedText
                type="small"
                style={profileFeedback.type === 'error' ? styles.errorText : styles.successText}>
                {profileFeedback.message}
              </ThemedText>
            ) : null}

            <Pressable
              onPress={handleSaveProfile}
              disabled={isSavingProfile}
              style={({ pressed }) => [
                styles.primaryButton,
                pressed && styles.pressed,
                isSavingProfile && styles.disabled,
              ]}>
              {isSavingProfile ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <ThemedText style={styles.primaryButtonText}>Save</ThemedText>
              )}
            </Pressable>
          </Section>

          <Section title="PREFERENCES">
            <View style={styles.field}>
              <FieldLabel>Browsing mode</FieldLabel>
              <View style={styles.segmentedRow}>
                {(['buy', 'rent'] as const).map((value) => {
                  const selected = buyRentChoice === value && mode !== 'sell';
                  return (
                    <Pressable
                      key={value}
                      onPress={() => handleSelectBuyRent(value)}
                      disabled={isLoadingMode}
                      style={[
                        styles.segment,
                        { backgroundColor: selected ? theme.text : theme.background },
                      ]}>
                      <ThemedText type="small" style={{ color: selected ? theme.background : theme.text }}>
                        {value === 'buy' ? 'Buy' : 'Rent'}
                      </ThemedText>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <View style={[styles.field, styles.switchRow]}>
              <View style={styles.switchLabelGroup}>
                <ThemedText>Sell mode</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  Show your listings instead of the buyer feed
                </ThemedText>
              </View>
              <Switch
                value={mode === 'sell'}
                onValueChange={handleToggleSell}
                disabled={isLoadingMode}
                trackColor={{ false: theme.backgroundSelected, true: theme.text }}
                thumbColor="#ffffff"
              />
            </View>
          </Section>

          <Section title="SECURITY">
            <ThemedText type="smallBold" style={styles.subsectionTitle}>
              Change password
            </ThemedText>
            <View style={styles.field}>
              <FieldLabel>Current password</FieldLabel>
              <TextInput
                value={currentPassword}
                onChangeText={setCurrentPassword}
                placeholder="••••••••"
                placeholderTextColor={theme.textSecondary}
                secureTextEntry
                style={[styles.input, { color: theme.text, borderColor: theme.backgroundSelected }]}
              />
            </View>
            <View style={styles.field}>
              <FieldLabel>New password</FieldLabel>
              <TextInput
                value={newPassword}
                onChangeText={setNewPassword}
                placeholder="••••••••"
                placeholderTextColor={theme.textSecondary}
                secureTextEntry
                style={[styles.input, { color: theme.text, borderColor: theme.backgroundSelected }]}
              />
            </View>
            <View style={styles.field}>
              <FieldLabel>Confirm new password</FieldLabel>
              <TextInput
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                placeholder="••••••••"
                placeholderTextColor={theme.textSecondary}
                secureTextEntry
                style={[styles.input, { color: theme.text, borderColor: theme.backgroundSelected }]}
              />
            </View>

            {passwordFeedback ? (
              <ThemedText
                type="small"
                style={passwordFeedback.type === 'error' ? styles.errorText : styles.successText}>
                {passwordFeedback.message}
              </ThemedText>
            ) : null}

            <Pressable
              onPress={handleChangePassword}
              disabled={isChangingPassword}
              style={({ pressed }) => [
                styles.primaryButton,
                pressed && styles.pressed,
                isChangingPassword && styles.disabled,
              ]}>
              {isChangingPassword ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <ThemedText style={styles.primaryButtonText}>Update password</ThemedText>
              )}
            </Pressable>
          </Section>

          {logoutError ? <ThemedText style={styles.errorText}>{logoutError}</ThemedText> : null}

          <Pressable
            onPress={handleLogout}
            disabled={isSigningOut}
            style={({ pressed }) => [
              styles.logoutButton,
              { borderColor: theme.backgroundSelected },
              pressed && styles.pressed,
              isSigningOut && styles.disabled,
            ]}>
            {isSigningOut ? (
              <ActivityIndicator color={theme.text} />
            ) : (
              <ThemedText style={styles.logoutButtonText}>Log Out</ThemedText>
            )}
          </Pressable>
        </ScrollView>
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
  },
  scrollContent: {
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.six,
    gap: Spacing.five,
  },
  header: {
    alignItems: 'center',
    gap: Spacing.one,
    paddingTop: Spacing.three,
  },
  avatar: {
    width: 84,
    height: 84,
    borderRadius: 42,
    marginBottom: Spacing.two,
  },
  avatarPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: {
    fontSize: 24,
    lineHeight: 28,
  },
  section: {
    gap: Spacing.two,
  },
  sectionTitle: {
    letterSpacing: 0.5,
    paddingLeft: Spacing.one,
  },
  sectionCard: {
    borderRadius: Spacing.four,
    padding: Spacing.four,
    gap: Spacing.three,
  },
  subsectionTitle: {
    marginBottom: -Spacing.one,
  },
  field: {
    gap: Spacing.one,
  },
  input: {
    height: 46,
    borderRadius: Spacing.three,
    borderWidth: 1,
    paddingHorizontal: Spacing.three,
    fontSize: 15,
  },
  segmentedRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  segment: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: Spacing.two,
    borderRadius: Spacing.five,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.three,
  },
  switchLabelGroup: {
    flex: 1,
    gap: 2,
  },
  primaryButton: {
    height: 48,
    borderRadius: Spacing.three,
    backgroundColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    color: '#ffffff',
    fontWeight: '600',
  },
  logoutButton: {
    height: 52,
    borderRadius: Spacing.three,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoutButtonText: {
    fontWeight: '600',
  },
  errorText: {
    color: '#D92D20',
  },
  successText: {
    color: '#15803D',
  },
  pressed: {
    opacity: 0.85,
  },
  disabled: {
    opacity: 0.7,
  },
});
