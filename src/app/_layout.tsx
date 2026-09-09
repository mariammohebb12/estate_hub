import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useColorScheme } from 'react-native';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { AuthProvider, useAuth } from '@/providers/auth-provider';
import { ModeProvider } from '@/providers/mode-provider';

SplashScreen.preventAutoHideAsync();

function RootNavigator() {
  const { session, isLoading } = useAuth();

  if (isLoading) return null;

  return (
    <Stack screenOptions={{ headerShown: false }}>
      {/*
        Ungated: completing a password recovery link establishes a real
        Supabase session, which would otherwise flip `session` truthy and
        instantly bounce this screen over to the (tabs) guard below before the
        user can actually set a new password.
      */}
      <Stack.Screen name="reset-password" />
      <Stack.Protected guard={!session}>
        <Stack.Screen name="(auth)" />
      </Stack.Protected>
      <Stack.Protected guard={!!session}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="listing/[id]" options={{ presentation: 'card' }} />
        <Stack.Screen name="listing-form" options={{ presentation: 'modal' }} />
      </Stack.Protected>
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
          <RootNavigator />
        </ModeProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
