import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { supabase } from '@/services/supabase';

export async function registerForPushNotifications(userId: string) {
  try {
    if (!Device.isDevice) {
      // Push tokens aren't available on simulators/emulators.
      return { token: null, error: null };
    }

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      return { token: null, error: null };
    }

    const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
    if (!projectId) {
      console.warn(
        'registerForPushNotifications: no EAS projectId configured (app.json extra.eas.projectId) — skipping push token registration',
      );
      return { token: null, error: null };
    }

    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });

    const { error } = await supabase.from('profiles').update({ push_token: token }).eq('id', userId);
    if (error) {
      return { token: null, error };
    }

    return { token, error: null };
  } catch (error) {
    // Any failure here (permission denied, unsupported environment, network
    // issue) should never crash the app — push notifications are best-effort.
    console.warn('registerForPushNotifications: failed to register for push notifications', error);
    return { token: null, error: null };
  }
}
