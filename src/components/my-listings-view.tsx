import { useFocusEffect, useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, Image, Pressable, RefreshControl, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTabBarClearance } from '@/hooks/use-tab-bar-clearance';
import { useTheme } from '@/hooks/use-theme';
import { getMyListings, type MyListing } from '@/services/listings';

const priceFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});

const STATUS_LABELS: Record<string, string> = {
  available: 'Available',
  under_offer: 'Under Offer',
  sold: 'Sold',
};

// Kept in sync with the same softened palette used for listing status in listing-form.tsx.
const STATUS_COLORS: Record<string, { background: string; text: string }> = {
  available: { background: '#E7F4EC', text: '#3F7A5C' },
  under_offer: { background: '#F6EFE3', text: '#96703F' },
  sold: { background: '#EAEAEE', text: '#5B5F6A' },
};

const LISTING_TYPE_LABELS: Record<'buy' | 'rent', string> = {
  buy: 'For Sale',
  rent: 'For Rent',
};

function StatusBadge({ status }: { status: string }) {
  const colors = STATUS_COLORS[status] ?? { background: '#EAEAEE', text: '#5B5F6A' };
  const label = STATUS_LABELS[status] ?? status;

  return (
    <View style={[styles.statusBadge, { backgroundColor: colors.background }]}>
      <ThemedText type="small" style={[styles.statusBadgeText, { color: colors.text }]}>
        {label}
      </ThemedText>
    </View>
  );
}

function ListingTypeBadge({ listingType }: { listingType: 'buy' | 'rent' }) {
  return (
    <View style={[styles.listingTypeBadge, listingType === 'rent' && styles.listingTypeBadgeRent]}>
      <ThemedText
        type="small"
        style={[styles.listingTypeBadgeText, listingType === 'rent' && styles.listingTypeBadgeTextRent]}>
        {LISTING_TYPE_LABELS[listingType]}
      </ThemedText>
    </View>
  );
}

type MyListingsViewProps = {
  userId: string;
};

export function MyListingsView({ userId }: MyListingsViewProps) {
  const theme = useTheme();
  const tabBarClearance = useTabBarClearance();
  const router = useRouter();

  const [listings, setListings] = useState<MyListing[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadMyListings = useCallback(async () => {
    const { data, error } = await getMyListings(userId);
    if (error) {
      setErrorMessage(error.message);
    } else {
      setErrorMessage(null);
      setListings(data);
    }
  }, [userId]);

  useFocusEffect(
    useCallback(() => {
      setIsLoading(true);
      loadMyListings().finally(() => setIsLoading(false));
    }, [loadMyListings]),
  );

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadMyListings();
    setIsRefreshing(false);
  };

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.headerRow}>
          <ThemedText type="title" style={styles.title}>
            My Listings
          </ThemedText>
          <Pressable
            onPress={() => router.push('/listing-form')}
            style={({ pressed }) => [styles.fab, pressed && styles.pressed]}>
            <SymbolView name={{ ios: 'plus', android: 'add', web: 'add' }} tintColor="#ffffff" size={20} />
          </Pressable>
        </View>

        {isLoading ? (
          <ThemedView style={styles.centered}>
            <ActivityIndicator />
          </ThemedView>
        ) : errorMessage ? (
          <ThemedView style={styles.centered}>
            <ThemedText style={styles.errorText}>{errorMessage}</ThemedText>
          </ThemedView>
        ) : listings.length === 0 ? (
          <ThemedView style={styles.centered}>
            <ThemedText type="smallBold" style={styles.emptyTitle}>
              You haven&apos;t listed any properties yet
            </ThemedText>
            <ThemedText themeColor="textSecondary" style={styles.emptySubtitle}>
              Tap the + button to create your first listing.
            </ThemedText>
          </ThemedView>
        ) : (
          <FlatList
            data={listings}
            keyExtractor={(item) => item.id}
            contentContainerStyle={[styles.listContent, { paddingBottom: Spacing.five + tabBarClearance }]}
            ItemSeparatorComponent={() => <View style={styles.separator} />}
            renderItem={({ item }) => (
              <Pressable
                onPress={() => router.push({ pathname: '/listing-form', params: { id: item.id } })}
                style={({ pressed }) => [
                  styles.card,
                  { backgroundColor: theme.background, borderColor: theme.backgroundElement },
                  pressed && styles.pressed,
                ]}>
                <View style={[styles.thumbnail, { backgroundColor: theme.backgroundElement }]}>
                  {item.cover_photo_url ? (
                    <Image source={{ uri: item.cover_photo_url }} style={styles.thumbnailImage} />
                  ) : (
                    <SymbolView
                      name={{ ios: 'photo', android: 'photo', web: 'photo' }}
                      tintColor={theme.textSecondary}
                      size={20}
                    />
                  )}
                </View>
                <View style={styles.rowInfo}>
                  <ThemedText type="smallBold" numberOfLines={1}>
                    {item.title}
                  </ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {priceFormatter.format(item.price)}
                  </ThemedText>
                  <View style={styles.badgeRow}>
                    <ListingTypeBadge listingType={item.listing_type} />
                    <StatusBadge status={item.status} />
                  </View>
                </View>
              </Pressable>
            )}
            refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />}
          />
        )}
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.two,
    paddingBottom: Spacing.three,
  },
  title: {
    fontSize: 32,
    lineHeight: 38,
  },
  fab: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.four,
    gap: Spacing.one,
  },
  emptyTitle: {
    textAlign: 'center',
  },
  emptySubtitle: {
    textAlign: 'center',
  },
  errorText: {
    color: '#D92D20',
    textAlign: 'center',
  },
  listContent: {
    paddingHorizontal: Spacing.four,
  },
  separator: {
    height: Spacing.three,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: Spacing.three,
    borderRadius: Spacing.four,
    borderWidth: 1,
    padding: Spacing.three,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  thumbnail: {
    aspectRatio: 1,
    minWidth: 64,
    borderRadius: Spacing.three,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  thumbnailImage: {
    width: '100%',
    height: '100%',
  },
  rowInfo: {
    flex: 1,
    justifyContent: 'center',
    gap: Spacing.half,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    marginTop: Spacing.half,
  },
  listingTypeBadge: {
    backgroundColor: '#EAF1F8',
    paddingHorizontal: Spacing.two,
    paddingVertical: 2,
    borderRadius: Spacing.five,
  },
  listingTypeBadgeRent: {
    backgroundColor: '#F6EFE3',
  },
  listingTypeBadgeText: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '600',
    color: '#4A6C8C',
  },
  listingTypeBadgeTextRent: {
    color: '#96703F',
  },
  statusBadge: {
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.half,
    borderRadius: Spacing.five,
  },
  statusBadgeText: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '600',
  },
  pressed: {
    opacity: 0.85,
  },
});
