import { useLocalSearchParams, useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { getListingById, type ListingDetail } from '@/services/listings';

const priceFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});

export default function ListingDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  const [listing, setListing] = useState<ListingDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadListing = useCallback(async () => {
    if (!id) return;
    setIsLoading(true);
    const { data, error } = await getListingById(id);
    if (error) {
      setErrorMessage(error.message);
    } else {
      setErrorMessage(null);
      setListing(data);
    }
    setIsLoading(false);
  }, [id]);

  useEffect(() => {
    loadListing();
  }, [loadListing]);

  const headerButtons = (
    <View style={[styles.headerButtons, { top: insets.top + Spacing.two }]}>
      <Pressable onPress={() => router.back()} hitSlop={8}>
        <View style={styles.iconBubble}>
          <SymbolView
            name={{ ios: 'chevron.left', android: 'chevron_left', web: 'chevron_left' }}
            tintColor="#ffffff"
            size={20}
          />
        </View>
      </Pressable>
      <Pressable hitSlop={8}>
        <View style={styles.iconBubble}>
          <SymbolView
            name={{ ios: 'heart', android: 'favorite_border', web: 'favorite_border' }}
            tintColor="#ffffff"
            size={20}
          />
        </View>
      </Pressable>
    </View>
  );

  if (isLoading) {
    return (
      <ThemedView style={styles.container}>
        {headerButtons}
        <View style={styles.centered}>
          <ActivityIndicator />
        </View>
      </ThemedView>
    );
  }

  if (errorMessage || !listing) {
    return (
      <ThemedView style={styles.container}>
        {headerButtons}
        <View style={styles.centered}>
          <ThemedText style={styles.errorText}>{errorMessage ?? 'Listing not found.'}</ThemedText>
        </View>
      </ThemedView>
    );
  }

  const stats = [
    listing.bedrooms != null ? `${listing.bedrooms} Bedrooms` : null,
    listing.bathrooms != null ? `${listing.bathrooms} Bathrooms` : null,
    listing.property_type,
    listing.area_sqm != null ? `${listing.area_sqm} m²` : null,
  ].filter((stat): stat is string => Boolean(stat));

  const amenities = listing.amenities ?? [];

  const ctaLabel = listing.listing_type === 'rent' ? 'Book Dates' : 'Book Viewing';

  return (
    <ThemedView style={styles.container}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + Spacing.six + Spacing.four }}
        showsVerticalScrollIndicator={false}>
        <View style={[styles.photo, { backgroundColor: theme.backgroundElement }]}>
          <SymbolView
            name={{ ios: 'photo', android: 'photo', web: 'photo' }}
            tintColor={theme.textSecondary}
            size={40}
          />
          <View style={styles.photoDots}>
            <View style={styles.photoDot} />
          </View>
        </View>

        <ThemedView style={styles.content}>
          <ThemedView style={styles.titleBlock}>
            <ThemedText type="subtitle">{listing.title}</ThemedText>
            <ThemedText type="title" style={styles.price}>
              {priceFormatter.format(listing.price)}
              {listing.listing_type === 'rent' ? (
                <ThemedText themeColor="textSecondary" type="default">
                  {' '}
                  / night
                </ThemedText>
              ) : null}
            </ThemedText>
            {listing.location_text ? (
              <ThemedText themeColor="textSecondary">{listing.location_text}</ThemedText>
            ) : null}
          </ThemedView>

          {stats.length > 0 ? (
            <View style={styles.statsRow}>
              {stats.map((stat) => (
                <ThemedView
                  key={stat}
                  style={[styles.statPill, { backgroundColor: theme.backgroundElement }]}>
                  <ThemedText type="small">{stat}</ThemedText>
                </ThemedView>
              ))}
            </View>
          ) : null}

          {listing.description ? (
            <ThemedView style={styles.section}>
              <ThemedText type="smallBold">About this place</ThemedText>
              <ThemedText themeColor="textSecondary" style={styles.description}>
                {listing.description}
              </ThemedText>
            </ThemedView>
          ) : null}

          {amenities.length > 0 ? (
            <ThemedView style={styles.section}>
              <ThemedText type="smallBold">Amenities</ThemedText>
              <View style={styles.statsRow}>
                {amenities.map((amenity) => (
                  <ThemedView
                    key={amenity}
                    style={[styles.statPill, { backgroundColor: theme.backgroundElement }]}>
                    <ThemedText type="small">{amenity}</ThemedText>
                  </ThemedView>
                ))}
              </View>
            </ThemedView>
          ) : null}

          <ThemedView
            style={[styles.agentCard, { backgroundColor: theme.backgroundElement }]}>
            <View style={[styles.avatar, { backgroundColor: theme.backgroundSelected }]}>
              <SymbolView
                name={{ ios: 'person.crop.circle', android: 'person', web: 'person' }}
                tintColor={theme.textSecondary}
                size={24}
              />
            </View>
            <ThemedView style={[styles.agentInfo, { backgroundColor: theme.backgroundElement }]}>
              <ThemedText type="smallBold">Listed by</ThemedText>
              <ThemedText themeColor="textSecondary" numberOfLines={1} style={styles.agentId}>
                {listing.seller_id}
              </ThemedText>
            </ThemedView>
          </ThemedView>
        </ThemedView>
      </ScrollView>

      {headerButtons}

      <ThemedView
        style={[
          styles.ctaBar,
          { paddingBottom: insets.bottom + Spacing.two, backgroundColor: theme.background },
        ]}>
        <Pressable style={({ pressed }) => [styles.ctaButton, pressed && styles.pressed]}>
          <ThemedText style={styles.ctaButtonText}>{ctaLabel}</ThemedText>
        </Pressable>
      </ThemedView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.four,
  },
  errorText: {
    color: '#D92D20',
    textAlign: 'center',
  },
  headerButtons: {
    position: 'absolute',
    left: Spacing.three,
    right: Spacing.three,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  iconBubble: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  photo: {
    width: '100%',
    aspectRatio: 4 / 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoDots: {
    position: 'absolute',
    bottom: Spacing.three,
    flexDirection: 'row',
    gap: Spacing.one,
  },
  photoDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#ffffff',
  },
  content: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.four,
    gap: Spacing.four,
  },
  titleBlock: {
    gap: Spacing.one,
  },
  price: {
    fontSize: 24,
    lineHeight: 30,
  },
  statsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  statPill: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Spacing.five,
  },
  section: {
    gap: Spacing.two,
  },
  description: {
    lineHeight: 22,
  },
  agentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: Spacing.three,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  agentInfo: {
    flex: 1,
    gap: Spacing.half,
  },
  agentId: {
    fontSize: 12,
  },
  ctaBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
  },
  ctaButton: {
    height: 52,
    borderRadius: Spacing.three,
    backgroundColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaButtonText: {
    color: '#ffffff',
    fontWeight: '600',
  },
  pressed: {
    opacity: 0.85,
  },
});
