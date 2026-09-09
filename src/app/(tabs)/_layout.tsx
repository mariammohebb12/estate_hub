import { Tabs, type BottomTabBarProps } from 'expo-router/js-tabs';
import { SymbolView, type AndroidSymbol } from 'expo-symbols';
import type { SFSymbol } from 'sf-symbols-typescript';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Spacing, TabBarBottomGap, TabBarHeight } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useMode } from '@/providers/mode-provider';

const TAB_ICONS: Record<string, { ios: SFSymbol; android: AndroidSymbol }> = {
  index: { ios: 'house', android: 'home' },
  favorites: { ios: 'heart', android: 'favorite' },
  bookings: { ios: 'calendar', android: 'calendar_month' },
  profile: { ios: 'person.crop.circle', android: 'person' },
};

const SELL_MODE_INDEX_ICON: { ios: SFSymbol; android: AndroidSymbol } = { ios: 'list.bullet', android: 'list' };

const ICON_SIZE = 24;
const PILL_SIZE = 44;
const BAR_MARGIN = Spacing.four;

function CustomTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const theme = useTheme();
  const { mode } = useMode();
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.tabBar,
        {
          backgroundColor: theme.background,
          shadowColor: theme.text,
          bottom: insets.bottom + TabBarBottomGap,
        },
      ]}>
      {state.routes.map((route, index) => {
        const icon = route.name === 'index' && mode === 'sell' ? SELL_MODE_INDEX_ICON : TAB_ICONS[route.name];
        if (!icon) return null;

        const focused = index === state.index;
        const { options } = descriptors[route.key];

        const onPress = () => {
          const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
          if (!focused && !event.defaultPrevented) {
            navigation.navigate(route.name);
          }
        };

        return (
          <Pressable
            key={route.key}
            onPress={onPress}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityState={focused ? { selected: true } : {}}
            accessibilityLabel={typeof options.title === 'string' ? options.title : route.name}
            style={styles.tabItem}>
            <View style={[styles.iconWrap, focused && { backgroundColor: theme.text }]}>
              <SymbolView
                name={{ ios: icon.ios, android: icon.android, web: icon.android }}
                tintColor={focused ? theme.background : theme.textSecondary}
                size={ICON_SIZE}
              />
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

export default function TabsLayout() {
  const { mode } = useMode();

  return (
    <Tabs tabBar={(props) => <CustomTabBar {...props} />} screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="index" options={{ title: mode === 'sell' ? 'My Listings' : 'Home' }} />
      <Tabs.Screen name="favorites" options={{ title: 'Favorites' }} />
      <Tabs.Screen name="bookings" options={{ title: 'Bookings' }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile' }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    position: 'absolute',
    left: BAR_MARGIN,
    right: BAR_MARGIN,
    height: TabBarHeight,
    borderRadius: 999,
    flexDirection: 'row',
    elevation: 8,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
  },
  tabItem: {
    flex: 1,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrap: {
    width: PILL_SIZE,
    height: PILL_SIZE,
    borderRadius: PILL_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
