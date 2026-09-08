import { Tabs } from 'expo-router';
import { SymbolView, type AndroidSymbol } from 'expo-symbols';
import type { SFSymbol } from 'sf-symbols-typescript';

import { useTheme } from '@/hooks/use-theme';
import { useMode } from '@/providers/mode-provider';

const TAB_ICONS: Record<string, { ios: SFSymbol; android: AndroidSymbol }> = {
  index: { ios: 'house', android: 'home' },
  favorites: { ios: 'heart', android: 'favorite' },
  bookings: { ios: 'calendar', android: 'calendar_month' },
  search: { ios: 'magnifyingglass', android: 'search' },
  profile: { ios: 'person.crop.circle', android: 'person' },
};

const SELL_MODE_INDEX_ICON: { ios: SFSymbol; android: AndroidSymbol } = { ios: 'list.bullet', android: 'list' };

export default function TabsLayout() {
  const theme = useTheme();
  const { mode } = useMode();

  return (
    <Tabs
      screenOptions={({ route }) => {
        const icon = route.name === 'index' && mode === 'sell' ? SELL_MODE_INDEX_ICON : TAB_ICONS[route.name];
        return {
          headerShown: false,
          tabBarActiveTintColor: theme.text,
          tabBarInactiveTintColor: theme.textSecondary,
          tabBarStyle: {
            backgroundColor: theme.background,
            borderTopWidth: 0,
          },
          tabBarIcon: ({ color, size }) => (
            <SymbolView
              name={{ ios: icon.ios, android: icon.android, web: icon.android }}
              tintColor={color}
              size={size}
            />
          ),
        };
      }}>
      <Tabs.Screen name="index" options={{ title: mode === 'sell' ? 'My Listings' : 'Home' }} />
      <Tabs.Screen name="favorites" options={{ title: 'Favorites' }} />
      <Tabs.Screen name="bookings" options={{ title: 'Bookings' }} />
      <Tabs.Screen name="search" options={{ title: 'Search' }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile' }} />
    </Tabs>
  );
}
