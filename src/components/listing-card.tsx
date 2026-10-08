import { SymbolView } from 'expo-symbols';
import { Image, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { Listing } from '@/services/listings';
import { getShortLocation } from '@/utils/format-location';

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
        {listing.cover_photo_url ? (
          <Image source={{ uri: listing.cover_photo_url }} style={styles.photoImage} resizeMode="cover" />
        ) : (
          <SymbolView
            name={{ ios: 'photo', android: 'photo', web: 'photo' }}
            tintColor={theme.textSecondary}
            size={28}
          />
        )}
        <Pressable
          onPress={(event) => {
            event.stopPropagation();
            onToggleFavorite?.();
          }}
          hitSlop={8}
          style={styles.heartButton}>
          <SymbolView
            name={
              isFavorited
                ? { ios: 'heart.fill', android: 'favorite', web: 'favorite' }
                : { ios: 'heart', android: 'favorite_border', web: 'favorite_border' }
            }
            tintColor={isFavorited ? '#000000' : '#4B4B4B'}
            size={15}
          />
        </Pressable>
      </View>

      <ThemedView style={styles.info}>
        <ThemedText numberOfLines={1} style={styles.title}>
          {listing.title}
        </ThemedText>
        <ThemedText themeColor="textSecondary" numberOfLines={1} style={styles.location}>
          {getShortLocation(listing.location_text)}
        </ThemedText>
        <View style={styles.priceRow}>
          <ThemedText style={styles.price}>{priceFormatter.format(listing.price)}</ThemedText>
          <View style={[styles.typePill, { backgroundColor: theme.backgroundElement }]}>
            <ThemedText themeColor="textSecondary" style={styles.typePillText}>
              {listing.listing_type === 'rent' ? 'For Rent' : 'For Sale'}
            </ThemedText>
          </View>
        </View>
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
    width: '100%',
    aspectRatio: 1,
    borderRadius: Spacing.four,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  photoImage: {
    width: '100%',
    height: '100%',
  },
  heartButton: {
    position: 'absolute',
    top: Spacing.two,
    right: Spacing.two,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.85)',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 2,
  },
  info: {
    gap: Spacing.one,
  },
  title: {
    fontSize: 15,
    lineHeight: 19,
    fontWeight: '700',
  },
  location: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '500',
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: Spacing.one,
  },
  price: {
    fontSize: 13,
    lineHeight: 17,
    fontWeight: '700',
  },
  typePill: {
    paddingHorizontal: Spacing.one,
    paddingVertical: 2,
    borderRadius: 999,
  },
  typePillText: {
    fontSize: 10,
    lineHeight: 13,
    fontWeight: '600',
  },
});
