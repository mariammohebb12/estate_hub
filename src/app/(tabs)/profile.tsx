import Constants from 'expo-constants';
import * as ImagePicker from 'expo-image-picker';
import * as Notifications from 'expo-notifications';
import { SymbolView } from 'expo-symbols';
import { useEffect, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  AppState,
  Image,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTabBarClearance } from '@/hooks/use-tab-bar-clearance';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/providers/auth-provider';
import { useMode } from '@/providers/mode-provider';
import { signOut, updatePassword, verifyPassword } from '@/services/auth';
import { getProfile, updateProfile, uploadAvatar } from '@/services/profile';
import type { UserMode } from '@/services/profile';
import { getFriendlyErrorMessage } from '@/utils/error-message';

function getInitials(name: string | null, email: string | null) {
  const source = name?.trim() || email?.trim() || '';
  if (!source) return '?';
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return source.slice(0, 2).toUpperCase();
}

function FieldLabel({ children }: { children: string }) {
  return (
    <ThemedText type="small" themeColor="textSecondary">
      {children}
    </ThemedText>
  );
}

type SettingsRowProps = {
  icon: { ios: string; android: string };
  label: string;
  onPress: () => void;
};

function SettingsRow({ icon, label, onPress }: SettingsRowProps) {
  const theme = useTheme();
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
      <View style={[styles.rowIconWrap, { backgroundColor: theme.backgroundElement }]}>
        <SymbolView
          name={{ ios: icon.ios as never, android: icon.android as never, web: icon.android as never }}
          tintColor={theme.text}
          size={16}
        />
      </View>
      <ThemedText style={styles.rowLabel}>{label}</ThemedText>
      <SymbolView
        name={{ ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' }}
        tintColor={theme.textSecondary}
        size={16}
      />
    </Pressable>
  );
}

type SettingsStaticRowProps = {
  icon: { ios: string; android: string };
  label: string;
  value: string;
};

function SettingsStaticRow({ icon, label, value }: SettingsStaticRowProps) {
  const theme = useTheme();
  return (
    <View style={styles.row}>
      <View style={[styles.rowIconWrap, { backgroundColor: theme.backgroundElement }]}>
        <SymbolView
          name={{ ios: icon.ios as never, android: icon.android as never, web: icon.android as never }}
          tintColor={theme.text}
          size={16}
        />
      </View>
      <ThemedText style={styles.rowLabel}>{label}</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        {value}
      </ThemedText>
    </View>
  );
}

type SettingsSwitchRowProps = {
  icon: { ios: string; android: string };
  label: string;
  subtitle?: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
  disabled?: boolean;
};

function SettingsSwitchRow({ icon, label, subtitle, value, onValueChange, disabled }: SettingsSwitchRowProps) {
  const theme = useTheme();
  return (
    <View style={styles.row}>
      <View style={[styles.rowIconWrap, { backgroundColor: theme.backgroundElement }]}>
        <SymbolView
          name={{ ios: icon.ios as never, android: icon.android as never, web: icon.android as never }}
          tintColor={theme.text}
          size={16}
        />
      </View>
      <View style={styles.switchLabelGroup}>
        <ThemedText>{label}</ThemedText>
        {subtitle ? (
          <ThemedText type="small" themeColor="textSecondary">
            {subtitle}
          </ThemedText>
        ) : null}
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        disabled={disabled}
        trackColor={{ false: theme.backgroundSelected, true: theme.text }}
        thumbColor="#ffffff"
      />
    </View>
  );
}

function SettingsGroup({ label, children }: { label?: string; children: ReactNode }) {
  const theme = useTheme();
  return (
    <View style={styles.settingsGroup}>
      {label ? (
        <ThemedText type="smallBold" themeColor="textSecondary" style={styles.groupLabel}>
          {label}
        </ThemedText>
      ) : null}
      <View style={[styles.settingsCard, { backgroundColor: theme.backgroundElement }]}>{children}</View>
    </View>
  );
}

type InfoSheetProps = {
  visible: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
};

function InfoSheet({ visible, title, onClose, children }: InfoSheetProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={styles.sheetContainer} pointerEvents="box-none">
        <ThemedView
          style={[styles.sheet, { backgroundColor: theme.background, paddingBottom: insets.bottom + Spacing.four }]}>
          <View style={styles.sheetHeader}>
            <ThemedText type="smallBold">{title}</ThemedText>
            <Pressable onPress={onClose} hitSlop={8}>
              <View style={[styles.closeButton, { backgroundColor: theme.backgroundElement }]}>
                <SymbolView name={{ ios: 'xmark', android: 'close', web: 'close' }} tintColor={theme.text} size={16} />
              </View>
            </Pressable>
          </View>
          <ScrollView style={styles.infoScroll} showsVerticalScrollIndicator={false}>
            {children}
          </ScrollView>
        </ThemedView>
      </View>
    </Modal>
  );
}

export default function ProfileScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { session } = useAuth();
  const { mode, isLoadingMode, setMode } = useMode();
  const userId = session?.user.id;
  const email = session?.user.email ?? null;
  const tabBarClearance = useTabBarClearance();

  const [isLoadingProfile, setIsLoadingProfile] = useState(true);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [profileFeedback, setProfileFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(
    null,
  );

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordFeedback, setPasswordFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(
    null,
  );

  const [isSigningOut, setIsSigningOut] = useState(false);
  const [logoutError, setLogoutError] = useState<string | null>(null);

  const [isEditSheetVisible, setIsEditSheetVisible] = useState(false);
  const [isPasswordSheetVisible, setIsPasswordSheetVisible] = useState(false);
  const [isModeSheetVisible, setIsModeSheetVisible] = useState(false);
  const [isHelpSheetVisible, setIsHelpSheetVisible] = useState(false);
  const [isContactSheetVisible, setIsContactSheetVisible] = useState(false);
  const [isTermsSheetVisible, setIsTermsSheetVisible] = useState(false);
  const [isPrivacySheetVisible, setIsPrivacySheetVisible] = useState(false);

  const [notificationsGranted, setNotificationsGranted] = useState<boolean | null>(null);

  const memberSinceLabel = session?.user.created_at
    ? new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(new Date(session.user.created_at))
    : null;
  const appVersion = Constants.expoConfig?.version ?? '1.0.0';

  useEffect(() => {
    let cancelled = false;
    const checkNotificationPermission = () => {
      Notifications.getPermissionsAsync().then(({ status }) => {
        if (!cancelled) setNotificationsGranted(status === 'granted');
      });
    };

    checkNotificationPermission();
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') checkNotificationPermission();
    });

    return () => {
      cancelled = true;
      subscription.remove();
    };
  }, []);

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

  const handlePickAvatar = async () => {
    if (!userId) return;
    setAvatarError(null);

    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setAvatarError('Photo library access is required to change your avatar.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });

    if (result.canceled || !result.assets[0]) return;

    setIsUploadingAvatar(true);
    const { data, error } = await uploadAvatar(userId, result.assets[0].uri);
    setIsUploadingAvatar(false);

    if (error) {
      setAvatarError('Failed to upload photo.');
    } else if (data) {
      setAvatarUrl(data);
    }
  };

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

  const handleToggleSell = async (isSellOn: boolean) => {
    const nextMode: UserMode = isSellOn ? 'sell' : 'buy';
    await setMode(nextMode);
  };

  const handleToggleNotifications = async (next: boolean) => {
    if (next) {
      const { status } = await Notifications.requestPermissionsAsync();
      setNotificationsGranted(status === 'granted');
      if (status !== 'granted') {
        // Already denied before — the OS won't re-prompt, so send the user to Settings instead.
        await Linking.openSettings();
      }
    } else {
      // iOS/Android don't let an app revoke its own notification permission —
      // hand off to the system Settings screen where the user can actually turn it off.
      await Linking.openSettings();
    }
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
    if (newPassword.length < 8) {
      setPasswordFeedback({ type: 'error', message: 'Password must be at least 8 characters.' });
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
      console.error('handleChangePassword: failed to update password', updateError);
      setPasswordFeedback({ type: 'error', message: getFriendlyErrorMessage(updateError) });
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
      console.error('handleLogout: failed to sign out', error);
      setLogoutError(getFriendlyErrorMessage(error));
    }
    // On success, AuthProvider picks up the cleared session and routes back to the auth stack.
  };

  const closeEditSheet = () => {
    setIsEditSheetVisible(false);
    setProfileFeedback(null);
  };

  const closePasswordSheet = () => {
    setIsPasswordSheetVisible(false);
    setPasswordFeedback(null);
  };

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <ScrollView
          contentContainerStyle={[styles.scrollContent, { paddingBottom: Spacing.six + tabBarClearance }]}
          keyboardShouldPersistTaps="handled">
          <View style={[styles.headerCard, { backgroundColor: theme.backgroundElement }]}>
            <Pressable onPress={handlePickAvatar} disabled={isUploadingAvatar} style={styles.avatarWrapper}>
              {avatarUrl ? (
                <Image source={{ uri: avatarUrl }} style={styles.avatar} />
              ) : (
                <View style={[styles.avatar, styles.avatarPlaceholder, { backgroundColor: theme.backgroundSelected }]}>
                  <ThemedText type="subtitle">{getInitials(fullName, email)}</ThemedText>
                </View>
              )}
              <View style={[styles.avatarBadge, { backgroundColor: theme.text, borderColor: theme.backgroundElement }]}>
                {isUploadingAvatar ? (
                  <ActivityIndicator size="small" color={theme.background} />
                ) : (
                  <SymbolView
                    name={{ ios: 'camera.fill', android: 'photo_camera', web: 'photo_camera' }}
                    tintColor={theme.background}
                    size={13}
                  />
                )}
              </View>
            </Pressable>
            <ThemedText type="title" style={styles.name}>
              {isLoadingProfile ? ' ' : fullName || 'Your name'}
            </ThemedText>
            <ThemedText themeColor="textSecondary">{email}</ThemedText>
            {memberSinceLabel ? (
              <ThemedText type="small" themeColor="textSecondary">
                Member since {memberSinceLabel}
              </ThemedText>
            ) : null}
            {avatarError ? <ThemedText style={styles.errorText}>{avatarError}</ThemedText> : null}
          </View>

          <View style={[styles.settingsCard, { backgroundColor: theme.backgroundElement }]}>
            <SettingsRow
              icon={{ ios: 'person.fill', android: 'person' }}
              label="Edit Profile"
              onPress={() => setIsEditSheetVisible(true)}
            />
            <View style={[styles.divider, { backgroundColor: theme.backgroundSelected }]} />
            <SettingsRow
              icon={{ ios: 'lock.fill', android: 'lock' }}
              label="Change Password"
              onPress={() => setIsPasswordSheetVisible(true)}
            />
            <View style={[styles.divider, { backgroundColor: theme.backgroundSelected }]} />
            <SettingsRow
              icon={{ ios: 'slider.horizontal.3', android: 'tune' }}
              label="Mode & Preferences"
              onPress={() => setIsModeSheetVisible(true)}
            />
          </View>

          <SettingsGroup label="Notifications">
            <SettingsSwitchRow
              icon={{ ios: 'bell.fill', android: 'notifications' }}
              label="Push Notifications"
              subtitle={
                notificationsGranted == null
                  ? 'Checking permission…'
                  : notificationsGranted
                    ? 'Enabled for this device'
                    : 'Disabled — tap to open Settings'
              }
              value={notificationsGranted ?? false}
              onValueChange={handleToggleNotifications}
              disabled={notificationsGranted == null}
            />
          </SettingsGroup>

          <SettingsGroup label="Support">
            <SettingsRow
              icon={{ ios: 'questionmark.circle.fill', android: 'help' }}
              label="Help & FAQ"
              onPress={() => setIsHelpSheetVisible(true)}
            />
            <View style={[styles.divider, { backgroundColor: theme.backgroundSelected }]} />
            <SettingsRow
              icon={{ ios: 'envelope.fill', android: 'email' }}
              label="Contact Us"
              onPress={() => setIsContactSheetVisible(true)}
            />
          </SettingsGroup>

          <SettingsGroup label="About">
            <SettingsStaticRow
              icon={{ ios: 'info.circle.fill', android: 'info' }}
              label="App Version"
              value={appVersion}
            />
            <View style={[styles.divider, { backgroundColor: theme.backgroundSelected }]} />
            <SettingsRow
              icon={{ ios: 'doc.text.fill', android: 'description' }}
              label="Terms of Service"
              onPress={() => setIsTermsSheetVisible(true)}
            />
            <View style={[styles.divider, { backgroundColor: theme.backgroundSelected }]} />
            <SettingsRow
              icon={{ ios: 'hand.raised.fill', android: 'privacy_tip' }}
              label="Privacy Policy"
              onPress={() => setIsPrivacySheetVisible(true)}
            />
          </SettingsGroup>

          <Pressable
            onPress={handleLogout}
            disabled={isSigningOut}
            style={({ pressed }) => [styles.logoutButton, pressed && styles.pressed, isSigningOut && styles.disabled]}>
            {isSigningOut ? (
              <ActivityIndicator color="#D92D20" />
            ) : (
              <>
                <SymbolView
                  name={{ ios: 'rectangle.portrait.and.arrow.right', android: 'logout', web: 'logout' }}
                  tintColor="#D92D20"
                  size={18}
                />
                <ThemedText style={styles.logoutButtonText}>Log Out</ThemedText>
              </>
            )}
          </Pressable>
          {logoutError ? <ThemedText style={[styles.errorText, styles.logoutError]}>{logoutError}</ThemedText> : null}
        </ScrollView>
      </SafeAreaView>

      <Modal visible={isEditSheetVisible} transparent animationType="slide" onRequestClose={closeEditSheet}>
        <Pressable style={styles.backdrop} onPress={closeEditSheet} />
        <View style={styles.sheetContainer} pointerEvents="box-none">
          <ThemedView
            style={[styles.sheet, { backgroundColor: theme.background, paddingBottom: insets.bottom + Spacing.four }]}>
            <View style={styles.sheetHeader}>
              <ThemedText type="smallBold">Edit Profile</ThemedText>
              <Pressable onPress={closeEditSheet} hitSlop={8}>
                <View style={[styles.closeButton, { backgroundColor: theme.backgroundElement }]}>
                  <SymbolView name={{ ios: 'xmark', android: 'close', web: 'close' }} tintColor={theme.text} size={16} />
                </View>
              </Pressable>
            </View>

            <View style={styles.field}>
              <FieldLabel>Email</FieldLabel>
              <View style={[styles.readOnlyField, { backgroundColor: theme.backgroundElement }]}>
                <ThemedText themeColor="textSecondary" numberOfLines={1} style={styles.readOnlyFieldText}>
                  {email}
                </ThemedText>
                <SymbolView
                  name={{ ios: 'lock.fill', android: 'lock', web: 'lock' }}
                  tintColor={theme.textSecondary}
                  size={13}
                />
              </View>
            </View>
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
              <ThemedText type="small" style={profileFeedback.type === 'error' ? styles.errorText : styles.successText}>
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
          </ThemedView>
        </View>
      </Modal>

      <Modal visible={isPasswordSheetVisible} transparent animationType="slide" onRequestClose={closePasswordSheet}>
        <Pressable style={styles.backdrop} onPress={closePasswordSheet} />
        <View style={styles.sheetContainer} pointerEvents="box-none">
          <ThemedView
            style={[styles.sheet, { backgroundColor: theme.background, paddingBottom: insets.bottom + Spacing.four }]}>
            <View style={styles.sheetHeader}>
              <ThemedText type="smallBold">Change Password</ThemedText>
              <Pressable onPress={closePasswordSheet} hitSlop={8}>
                <View style={[styles.closeButton, { backgroundColor: theme.backgroundElement }]}>
                  <SymbolView name={{ ios: 'xmark', android: 'close', web: 'close' }} tintColor={theme.text} size={16} />
                </View>
              </Pressable>
            </View>

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
              <ThemedText type="small" style={passwordFeedback.type === 'error' ? styles.errorText : styles.successText}>
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
                <ThemedText style={styles.primaryButtonText}>Save</ThemedText>
              )}
            </Pressable>
          </ThemedView>
        </View>
      </Modal>

      <Modal
        visible={isModeSheetVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setIsModeSheetVisible(false)}>
        <Pressable style={styles.backdrop} onPress={() => setIsModeSheetVisible(false)} />
        <View style={styles.sheetContainer} pointerEvents="box-none">
          <ThemedView
            style={[styles.sheet, { backgroundColor: theme.background, paddingBottom: insets.bottom + Spacing.four }]}>
            <View style={styles.sheetHeader}>
              <ThemedText type="smallBold">Mode & Preferences</ThemedText>
              <Pressable onPress={() => setIsModeSheetVisible(false)} hitSlop={8}>
                <View style={[styles.closeButton, { backgroundColor: theme.backgroundElement }]}>
                  <SymbolView name={{ ios: 'xmark', android: 'close', web: 'close' }} tintColor={theme.text} size={16} />
                </View>
              </Pressable>
            </View>

            <ThemedText type="small" themeColor="textSecondary" style={styles.modeIntro}>
              Buy and rent listings now appear together on the Home tab — use the Filters button there to narrow
              down to just For Sale or just For Rent.
            </ThemedText>

            <View style={[styles.modeSection, styles.sellSection, { backgroundColor: theme.backgroundElement }]}>
              <View style={styles.switchRow}>
                <View style={[styles.rowIconWrap, { backgroundColor: theme.backgroundSelected }]}>
                  <SymbolView
                    name={{ ios: 'tag.fill', android: 'sell', web: 'sell' }}
                    tintColor={theme.text}
                    size={16}
                  />
                </View>
                <View style={styles.switchLabelGroup}>
                  <ThemedText>Sell mode</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {mode === 'sell' ? 'On — showing your listings' : 'Off — showing the buyer feed'}
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
              <ThemedText type="small" themeColor="textSecondary" style={styles.modeSectionCaption}>
                Turn on to list and manage your own properties instead of browsing
              </ThemedText>
            </View>
          </ThemedView>
        </View>
      </Modal>

      <InfoSheet visible={isHelpSheetVisible} title="Help & FAQ" onClose={() => setIsHelpSheetVisible(false)}>
        <ThemedText themeColor="textSecondary" style={styles.infoParagraph}>
          Answers to a few common questions about using Estate Hub.
        </ThemedText>
        <View style={styles.faqItem}>
          <ThemedText type="smallBold">How do I switch between buying, renting, and selling?</ThemedText>
          <ThemedText type="small" themeColor="textSecondary" style={styles.infoParagraph}>
            Go to Profile → Mode & Preferences and turn Sell mode on or off. Buy and rent listings appear together
            on the Home tab.
          </ThemedText>
        </View>
        <View style={styles.faqItem}>
          <ThemedText type="smallBold">How do I book a viewing or rental dates?</ThemedText>
          <ThemedText type="small" themeColor="textSecondary" style={styles.infoParagraph}>
            Open a listing, pick an available day on the calendar, then confirm a time slot from the sheet that
            appears.
          </ThemedText>
        </View>
        <View style={styles.faqItem}>
          <ThemedText type="smallBold">How do I list my own property?</ThemedText>
          <ThemedText type="small" themeColor="textSecondary" style={styles.infoParagraph}>
            Turn on Sell mode from Mode & Preferences, then use the Home tab to create and manage your listings.
          </ThemedText>
        </View>
      </InfoSheet>

      <InfoSheet visible={isContactSheetVisible} title="Contact Us" onClose={() => setIsContactSheetVisible(false)}>
        <ThemedText themeColor="textSecondary" style={styles.infoParagraph}>
          Need help with something specific? Reach out and our team will get back to you.
        </ThemedText>
        <View style={[styles.contactRow, { backgroundColor: theme.backgroundElement }]}>
          <SymbolView
            name={{ ios: 'envelope.fill', android: 'email', web: 'email' }}
            tintColor={theme.textSecondary}
            size={16}
          />
          <ThemedText type="small">support@estatehub.app</ThemedText>
        </View>
        <View style={[styles.contactRow, { backgroundColor: theme.backgroundElement }]}>
          <SymbolView
            name={{ ios: 'phone.fill', android: 'call', web: 'call' }}
            tintColor={theme.textSecondary}
            size={16}
          />
          <ThemedText type="small">+1 (555) 010-0100</ThemedText>
        </View>
      </InfoSheet>

      <InfoSheet visible={isTermsSheetVisible} title="Terms of Service" onClose={() => setIsTermsSheetVisible(false)}>
        <ThemedText themeColor="textSecondary" style={styles.infoParagraph}>
          This is placeholder Terms of Service content for development purposes and does not constitute a binding
          legal agreement.
        </ThemedText>
        <ThemedText themeColor="textSecondary" style={styles.infoParagraph}>
          By using Estate Hub, you agree to browse, list, and book properties in good faith. Listings are provided
          by individual sellers, and Estate Hub does not guarantee their accuracy or availability.
        </ThemedText>
        <ThemedText themeColor="textSecondary" style={styles.infoParagraph}>
          A complete Terms of Service will be published here before launch.
        </ThemedText>
      </InfoSheet>

      <InfoSheet visible={isPrivacySheetVisible} title="Privacy Policy" onClose={() => setIsPrivacySheetVisible(false)}>
        <ThemedText themeColor="textSecondary" style={styles.infoParagraph}>
          This is placeholder Privacy Policy content for development purposes.
        </ThemedText>
        <ThemedText themeColor="textSecondary" style={styles.infoParagraph}>
          Estate Hub stores your profile information, listing activity, and booking history to provide the app's
          core features. We do not sell your personal data to third parties.
        </ThemedText>
        <ThemedText themeColor="textSecondary" style={styles.infoParagraph}>
          A complete Privacy Policy will be published here before launch.
        </ThemedText>
      </InfoSheet>
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
    gap: Spacing.three,
  },
  headerCard: {
    alignItems: 'center',
    gap: Spacing.one,
    marginTop: Spacing.two,
    paddingTop: Spacing.five,
    paddingBottom: Spacing.four,
    paddingHorizontal: Spacing.four,
    borderRadius: Spacing.five,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    height: 52,
    borderRadius: Spacing.three,
    borderWidth: 1,
    borderColor: '#D92D20',
  },
  logoutButtonText: {
    color: '#D92D20',
    fontWeight: '600',
  },
  logoutError: {
    textAlign: 'center',
  },
  avatarWrapper: {
    marginBottom: Spacing.two,
  },
  avatar: {
    width: 88,
    height: 88,
    borderRadius: 44,
  },
  avatarPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarBadge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: {
    fontSize: 24,
    lineHeight: 28,
  },
  settingsGroup: {
    gap: Spacing.two,
  },
  groupLabel: {
    letterSpacing: 0.5,
    paddingLeft: Spacing.one,
    textTransform: 'uppercase',
  },
  settingsCard: {
    borderRadius: Spacing.four,
    paddingHorizontal: Spacing.four,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    minHeight: 60,
  },
  rowIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowLabel: {
    flex: 1,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
  },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheetContainer: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  sheet: {
    borderTopLeftRadius: Spacing.five,
    borderTopRightRadius: Spacing.five,
    padding: Spacing.four,
    gap: Spacing.three,
  },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  closeButton: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  infoScroll: {
    maxHeight: 420,
  },
  infoParagraph: {
    lineHeight: 20,
    marginTop: Spacing.one,
  },
  faqItem: {
    gap: 2,
    marginTop: Spacing.three,
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    borderRadius: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    marginTop: Spacing.two,
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
  readOnlyField: {
    height: 46,
    borderRadius: Spacing.three,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.three,
  },
  readOnlyFieldText: {
    flex: 1,
    fontSize: 15,
  },
  modeIntro: {
    lineHeight: 19,
  },
  modeSection: {
    gap: Spacing.two,
    borderRadius: Spacing.three,
    padding: Spacing.three,
  },
  sellSection: {
    paddingVertical: Spacing.four,
  },
  modeSectionCaption: {
    marginTop: -Spacing.one,
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
