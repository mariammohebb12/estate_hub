import { SymbolView } from 'expo-symbols';
import { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { PROPERTY_TYPES, type ListingFilters, type PropertyType } from '@/services/listings';

const BEDROOM_OPTIONS: { label: string; value: number | undefined }[] = [
  { label: 'Any', value: undefined },
  { label: '1+', value: 1 },
  { label: '2+', value: 2 },
  { label: '3+', value: 3 },
  { label: '4+', value: 4 },
];

const PRICE_BRACKETS: { label: string; min: number | undefined; max: number | undefined }[] = [
  { label: 'Any', min: undefined, max: undefined },
  { label: 'Under $100k', min: undefined, max: 100000 },
  { label: '$100k–300k', min: 100000, max: 300000 },
  { label: '$300k–500k', min: 300000, max: 500000 },
  { label: '$500k+', min: 500000, max: undefined },
];

const PROPERTY_TYPE_OPTIONS: { label: string; value: PropertyType | undefined }[] = [
  { label: 'Any', value: undefined },
  ...PROPERTY_TYPES.map((type) => ({ label: type[0].toUpperCase() + type.slice(1), value: type })),
];

const LISTING_TYPE_OPTIONS: { label: string; value: 'buy' | 'rent' | undefined }[] = [
  { label: 'Any', value: undefined },
  { label: 'For Sale', value: 'buy' },
  { label: 'For Rent', value: 'rent' },
];

function findPriceBracketIndex(minPrice?: number, maxPrice?: number) {
  const index = PRICE_BRACKETS.findIndex((bracket) => bracket.min === minPrice && bracket.max === maxPrice);
  return index === -1 ? 0 : index;
}

type FilterModalProps = {
  visible: boolean;
  filters: ListingFilters;
  onApply: (filters: ListingFilters) => void;
  onClose: () => void;
};

export function FilterModal({ visible, filters, onApply, onClose }: FilterModalProps) {
  const theme = useTheme();

  const [minBedrooms, setMinBedrooms] = useState<number | undefined>(filters.minBedrooms);
  const [priceBracketIndex, setPriceBracketIndex] = useState(
    findPriceBracketIndex(filters.minPrice, filters.maxPrice),
  );
  const [propertyType, setPropertyType] = useState<PropertyType | undefined>(filters.propertyType);
  const [listingType, setListingType] = useState<'buy' | 'rent' | undefined>(filters.listingType);

  useEffect(() => {
    if (visible) {
      setMinBedrooms(filters.minBedrooms);
      setPriceBracketIndex(findPriceBracketIndex(filters.minPrice, filters.maxPrice));
      setPropertyType(filters.propertyType);
      setListingType(filters.listingType);
    }
  }, [visible, filters]);

  const handleApply = () => {
    const bracket = PRICE_BRACKETS[priceBracketIndex];
    onApply({
      minBedrooms,
      minPrice: bracket.min,
      maxPrice: bracket.max,
      propertyType,
      listingType,
    });
  };

  const handleClear = () => {
    setMinBedrooms(undefined);
    setPriceBracketIndex(0);
    setPropertyType(undefined);
    setListingType(undefined);
    onApply({});
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={styles.sheetContainer} pointerEvents="box-none">
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
            <ThemedText type="smallBold">Listing type</ThemedText>
            <View style={styles.pillRow}>
              {LISTING_TYPE_OPTIONS.map((option) => {
                const selected = listingType === option.value;
                return (
                  <Pressable
                    key={option.label}
                    onPress={() => setListingType(option.value)}
                    style={[
                      styles.pill,
                      { backgroundColor: selected ? '#000000' : theme.backgroundElement },
                    ]}>
                    <ThemedText type="small" style={{ color: selected ? '#ffffff' : theme.text }}>
                      {option.label}
                    </ThemedText>
                  </Pressable>
                );
              })}
            </View>
          </ThemedView>

          <ThemedView style={styles.section}>
            <ThemedText type="smallBold">Bedrooms</ThemedText>
            <View style={styles.pillRow}>
              {BEDROOM_OPTIONS.map((option) => {
                const selected = minBedrooms === option.value;
                return (
                  <Pressable
                    key={option.label}
                    onPress={() => setMinBedrooms(option.value)}
                    style={[
                      styles.pill,
                      { backgroundColor: selected ? '#000000' : theme.backgroundElement },
                    ]}>
                    <ThemedText type="small" style={{ color: selected ? '#ffffff' : theme.text }}>
                      {option.label}
                    </ThemedText>
                  </Pressable>
                );
              })}
            </View>
          </ThemedView>

          <ThemedView style={styles.section}>
            <ThemedText type="smallBold">Price range</ThemedText>
            <View style={styles.pillRow}>
              {PRICE_BRACKETS.map((bracket, index) => {
                const selected = priceBracketIndex === index;
                return (
                  <Pressable
                    key={bracket.label}
                    onPress={() => setPriceBracketIndex(index)}
                    style={[
                      styles.pill,
                      { backgroundColor: selected ? '#000000' : theme.backgroundElement },
                    ]}>
                    <ThemedText type="small" style={{ color: selected ? '#ffffff' : theme.text }}>
                      {bracket.label}
                    </ThemedText>
                  </Pressable>
                );
              })}
            </View>
          </ThemedView>

          <ThemedView style={styles.section}>
            <ThemedText type="smallBold">Property type</ThemedText>
            <View style={styles.pillRow}>
              {PROPERTY_TYPE_OPTIONS.map((option) => {
                const selected = propertyType === option.value;
                return (
                  <Pressable
                    key={option.label}
                    onPress={() => setPropertyType(option.value)}
                    style={[
                      styles.pill,
                      { backgroundColor: selected ? '#000000' : theme.backgroundElement },
                    ]}>
                    <ThemedText type="small" style={{ color: selected ? '#ffffff' : theme.text }}>
                      {option.label}
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
      </View>
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
  pill: { paddingHorizontal: Spacing.three, paddingVertical: Spacing.two, borderRadius: 999 },
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
