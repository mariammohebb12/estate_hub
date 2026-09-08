import { SymbolView } from 'expo-symbols';
import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { PROPERTY_TYPES, type ListingFilters, type PropertyType } from '@/services/listings';

const BEDROOM_OPTIONS = [1, 2, 3, 4];

type FilterModalProps = {
  visible: boolean;
  filters: ListingFilters;
  onApply: (filters: ListingFilters) => void;
  onClose: () => void;
};

export function FilterModal({ visible, filters, onApply, onClose }: FilterModalProps) {
  const theme = useTheme();

  const [minBedrooms, setMinBedrooms] = useState<number | undefined>(filters.minBedrooms);
  const [minPrice, setMinPrice] = useState(filters.minPrice != null ? String(filters.minPrice) : '');
  const [maxPrice, setMaxPrice] = useState(filters.maxPrice != null ? String(filters.maxPrice) : '');
  const [propertyType, setPropertyType] = useState<PropertyType | undefined>(filters.propertyType);

  useEffect(() => {
    if (visible) {
      setMinBedrooms(filters.minBedrooms);
      setMinPrice(filters.minPrice != null ? String(filters.minPrice) : '');
      setMaxPrice(filters.maxPrice != null ? String(filters.maxPrice) : '');
      setPropertyType(filters.propertyType);
    }
  }, [visible, filters]);

  const handleApply = () => {
    onApply({
      minBedrooms,
      minPrice: minPrice ? Number(minPrice) : undefined,
      maxPrice: maxPrice ? Number(maxPrice) : undefined,
      propertyType,
    });
  };

  const handleClear = () => {
    setMinBedrooms(undefined);
    setMinPrice('');
    setMaxPrice('');
    setPropertyType(undefined);
    onApply({});
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.sheetContainer}
        pointerEvents="box-none">
        <ThemedView style={[styles.sheet, { backgroundColor: theme.background }]}>
          <View style={styles.header}>
            <ThemedText type="subtitle">Filters</ThemedText>
            <Pressable onPress={onClose} hitSlop={8}>
              <View style={[styles.closeButton, { backgroundColor: theme.backgroundElement }]}>
                <SymbolView
                  name={{ ios: 'xmark', android: 'close', web: 'close' }}
                  tintColor={theme.text}
                  size={16}
                />
              </View>
            </Pressable>
          </View>

          <ThemedView style={styles.section}>
            <ThemedText type="smallBold">Bedrooms (min)</ThemedText>
            <View style={styles.pillRow}>
              {BEDROOM_OPTIONS.map((option) => {
                const selected = minBedrooms === option;
                return (
                  <Pressable
                    key={option}
                    onPress={() => setMinBedrooms(selected ? undefined : option)}
                    style={[
                      styles.pill,
                      { backgroundColor: selected ? theme.text : theme.backgroundElement },
                    ]}>
                    <ThemedText
                      type="small"
                      style={{ color: selected ? theme.background : theme.text }}>
                      {option}+
                    </ThemedText>
                  </Pressable>
                );
              })}
            </View>
          </ThemedView>

          <ThemedView style={styles.section}>
            <ThemedText type="smallBold">Price range</ThemedText>
            <View style={styles.priceRow}>
              <TextInput
                value={minPrice}
                onChangeText={setMinPrice}
                placeholder="Min"
                placeholderTextColor={theme.textSecondary}
                keyboardType="number-pad"
                style={[styles.priceInput, { backgroundColor: theme.backgroundElement, color: theme.text }]}
              />
              <ThemedText themeColor="textSecondary">to</ThemedText>
              <TextInput
                value={maxPrice}
                onChangeText={setMaxPrice}
                placeholder="Max"
                placeholderTextColor={theme.textSecondary}
                keyboardType="number-pad"
                style={[styles.priceInput, { backgroundColor: theme.backgroundElement, color: theme.text }]}
              />
            </View>
          </ThemedView>

          <ThemedView style={styles.section}>
            <ThemedText type="smallBold">Property type</ThemedText>
            <View style={styles.pillRow}>
              {PROPERTY_TYPES.map((option) => {
                const selected = propertyType === option;
                return (
                  <Pressable
                    key={option}
                    onPress={() => setPropertyType(selected ? undefined : option)}
                    style={[
                      styles.pill,
                      { backgroundColor: selected ? theme.text : theme.backgroundElement },
                    ]}>
                    <ThemedText
                      type="small"
                      style={{ color: selected ? theme.background : theme.text, textTransform: 'capitalize' }}>
                      {option}
                    </ThemedText>
                  </Pressable>
                );
              })}
            </View>
          </ThemedView>

          <View style={styles.footer}>
            <Pressable onPress={handleClear} style={styles.clearButton} hitSlop={8}>
              <ThemedText type="smallBold">Clear filters</ThemedText>
            </Pressable>
            <Pressable
              onPress={handleApply}
              style={({ pressed }) => [styles.applyButton, pressed && styles.pressed]}>
              <ThemedText style={styles.applyButtonText}>Apply</ThemedText>
            </Pressable>
          </View>
        </ThemedView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheetContainer: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  sheet: {
    borderTopLeftRadius: Spacing.five,
    borderTopRightRadius: Spacing.five,
    padding: Spacing.four,
    gap: Spacing.four,
  },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  closeButton: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  section: { gap: Spacing.two },
  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  pill: { paddingHorizontal: Spacing.three, paddingVertical: Spacing.two, borderRadius: Spacing.five },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  priceInput: {
    flex: 1,
    height: 44,
    borderRadius: Spacing.three,
    paddingHorizontal: Spacing.three,
    fontSize: 16,
  },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: Spacing.two },
  clearButton: { paddingVertical: Spacing.two },
  applyButton: {
    flex: 1,
    marginLeft: Spacing.four,
    height: 52,
    borderRadius: Spacing.three,
    backgroundColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  applyButtonText: { color: '#ffffff', fontWeight: '600' },
  pressed: { opacity: 0.85 },
});
