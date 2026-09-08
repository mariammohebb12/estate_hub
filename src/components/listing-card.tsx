import { SymbolView } from 'expo-symbols';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { Listing } from '@/services/listings';

const priceFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});

type ListingCardProps = {
  listing: Listing;
  onPress?: () => void;
  isFavorited?: boolean;
  onToggleFavorite?: () => void;
};

export function ListingCard({ listing, onPress, isFavorited, onToggleFavorite }: ListingCardProps) {
  const theme = useTheme();

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
      <View style={[styles.photo, { backgroundColor: theme.backgroundElement }]}>
        <SymbolView
          name={{ ios: 'photo', android: 'photo', web: 'photo' }}
          tintColor={theme.textSecondary}
          size={28}
        />
        <View style={styles.typeBadge}>
          <ThemedText type="small" style={styles.typeBadgeText}>
            {listing.listing_type === 'rent' ? 'For Rent' : 'For Sale'}
          </ThemedText>
        </View>
      </View>

      <ThemedView style={styles.info}>
        <View style={styles.titleRow}>
          <ThemedText type="smallBold" numberOfLines={1} style={styles.titleText}>
            {listing.title}
          </ThemedText>
          <Pressable onPress={onToggleFavorite} hitSlop={8}>
            <SymbolView
              name={
                isFavorited
                  ? { ios: 'heart.fill', android: 'favorite', web: 'favorite' }
                  : { ios: 'heart', android: 'favorite_border', web: 'favorite_border' }
              }
              tintColor={isFavorited ? theme.text : theme.textSecondary}
              size={18}
            />
          </Pressable>
        </View>
        <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
          {listing.location_text}
        </ThemedText>
        <ThemedText type="smallBold">{priceFormatter.format(listing.price)}</ThemedText>
      </ThemedView>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    gap: Spacing.two,
  },
  pressed: {
    opacity: 0.85,
  },
  photo: {
    aspectRatio: 1,
    borderRadius: Spacing.three,
    alignItems: 'center',
    justifyContent: 'center',
  },
  typeBadge: {
    position: 'absolute',
    top: Spacing.two,
    left: Spacing.two,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.half,
    borderRadius: Spacing.five,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  typeBadgeText: {
    color: '#ffffff',
    fontSize: 11,
    lineHeight: 14,
  },
  info: {
    gap: Spacing.half,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  titleText: {
    flex: 1,
  },
});
