import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { PROPERTY_TYPES, type PropertyType } from '@/services/listings';

type CategoryValue = PropertyType | undefined;

const CATEGORY_ICONS: Record<string, SymbolViewProps['name']> = {
  all: { ios: 'square.grid.2x2.fill', android: 'apps', web: 'apps' },
  villa: { ios: 'house.lodge.fill', android: 'villa', web: 'villa' },
  apartment: { ios: 'building.2.fill', android: 'apartment', web: 'apartment' },
  house: { ios: 'house.fill', android: 'home', web: 'home' },
};

const CATEGORIES: { key: string; value: CategoryValue; label: string }[] = [
  { key: 'all', value: undefined, label: 'All' },
  ...PROPERTY_TYPES.map((type) => ({ key: type, value: type, label: `${type[0].toUpperCase()}${type.slice(1)}s` })),
];

type CategoryTabBarProps = {
  selected: CategoryValue;
  onSelect: (value: CategoryValue) => void;
};

export function CategoryTabBar({ selected, onSelect }: CategoryTabBarProps) {
  const theme = useTheme();

  return (
    <View style={styles.row}>
      {CATEGORIES.map((category) => {
        const isSelected = category.value === selected;
        const color = isSelected ? theme.text : theme.textSecondary;

        return (
          <Pressable key={category.key} onPress={() => onSelect(category.value)} style={styles.tab}>
            <SymbolView name={CATEGORY_ICONS[category.key]} tintColor={color} size={22} />
            <ThemedText type={isSelected ? 'smallBold' : 'small'} style={{ color }}>
              {category.label}
            </ThemedText>
            <View style={[styles.underline, { backgroundColor: isSelected ? theme.text : 'transparent' }]} />
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.four,
  },
  tab: {
    alignItems: 'center',
    gap: Spacing.one,
    paddingBottom: Spacing.two,
  },
  underline: {
    height: 2,
    width: 32,
    borderRadius: 1,
  },
});
