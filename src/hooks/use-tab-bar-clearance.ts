import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { TabBarBottomGap, TabBarHeight } from '@/constants/theme';

/** Space content must reserve at the bottom of a tab screen so the floating tab bar never covers it. */
export function useTabBarClearance() {
  const insets = useSafeAreaInsets();
  return TabBarHeight + TabBarBottomGap + insets.bottom;
}
