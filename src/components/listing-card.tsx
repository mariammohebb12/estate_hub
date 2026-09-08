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
        <Pressable onPress={onToggleFavorite} style={styles.favoriteButton} hitSlop={8}>
          <View style={styles.favoriteBubble}>
            <SymbolView
              name={
                isFavorited
                  ? { ios: 'heart.fill', android: 'favorite', web: 'favorite' }
                  : { ios: 'heart', android: 'favorite_border', web: 'favorite_border' }
              }
              tintColor="#ffffff"
              size={18}
            />
          </View>
        </Pressable>
      </View>

      <ThemedView style={styles.info}>
        <ThemedText type="smallBold" numberOfLines={1}>
          {listing.title}
        </ThemedText>
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
  favoriteButton: {
    position: 'absolute',
    top: Spacing.two,
    right: Spacing.two,
  },
  favoriteBubble: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  info: {
    gap: Spacing.half,
  },
});
