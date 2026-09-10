import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useColorScheme } from 'react-native';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { AuthProvider, useAuth } from '@/providers/auth-provider';
import { ModeProvider } from '@/providers/mode-provider';
import { ToastProvider } from '@/providers/toast-provider';

SplashScreen.preventAutoHideAsync();

function RootNavigator() {
  const { session, isLoading } = useAuth();

  if (isLoading) return null;

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={!session}>
        <Stack.Screen name="(auth)" />
      </Stack.Protected>
      <Stack.Protected guard={!!session}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="listing/[id]" options={{ presentation: 'card' }} />
        <Stack.Screen name="listing-form" options={{ presentation: 'modal' }} />
      </Stack.Protected>
      {/*
        Ungated and declared LAST: completing a password recovery link
        establishes a real Supabase session, which would otherwise flip
        `session` truthy and instantly bounce this screen over to the (tabs)
        guard above before the user can actually set a new password — so this
        screen must stay reachable regardless of session state.

        It must come AFTER the two guarded groups above, not before: when a
        guard flips (e.g. right after signup/login), the previously-active
        group's entire history is invalidated, and React Navigation falls back
        to a fresh initial state using the FIRST screen in the surviving
        config. A deep link to this screen still resolves correctly no matter
        where it's declared (that's a named-route match, not array-order
        dependent) — only the "no specific route, guess a default" fallback
        cares about position, so keeping this last ensures that fallback lands
        on (auth) or (tabs) as before, not here.
      */}
      <Stack.Screen name="reset-password" />
    </Stack>
  );
}

export default function RootLayout() {
  const colorScheme = useColorScheme();
  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <AuthProvider>
        <AnimatedSplashOverlay />
        <ModeProvider>
          <ToastProvider>
            <RootNavigator />
          </ToastProvider>
        </ModeProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
