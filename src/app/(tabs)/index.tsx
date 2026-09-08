import { useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FilterModal } from '@/components/filter-modal';
import { ListingCard } from '@/components/listing-card';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useFavoriteToggle } from '@/hooks/use-favorite-toggle';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/providers/auth-provider';
import { getFavoritedListingIds } from '@/services/favorites';
import { getAvailableListings, type Listing, type ListingFilters } from '@/services/listings';

function countActiveFilters(filters: ListingFilters) {
  let count = 0;
  if (filters.minBedrooms != null) count += 1;
  if (filters.minPrice != null || filters.maxPrice != null) count += 1;
  if (filters.propertyType) count += 1;
  return count;
}

export default function HomeScreen() {
  const router = useRouter();
  const theme = useTheme();
  const { session } = useAuth();
  const userId = session?.user.id;
  const { favoritedIds, setFavoritedIds, toggleFavorite } = useFavoriteToggle(userId);

  const [listings, setListings] = useState<Listing[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [filters, setFilters] = useState<ListingFilters>({});
  const [isFilterModalVisible, setIsFilterModalVisible] = useState(false);
  const activeFilterCount = countActiveFilters(filters);

  const loadListings = useCallback(async () => {
    const { data, error } = await getAvailableListings(filters);
    if (error) {
      setErrorMessage(error.message);
    } else {
      setErrorMessage(null);
      setListings(data);
    }

    if (userId) {
      const { data: favoriteIds } = await getFavoritedListingIds(userId);
      setFavoritedIds(new Set(favoriteIds));
    }
  }, [userId, setFavoritedIds, filters]);

  useEffect(() => {
    setIsLoading(true);
    loadListings().finally(() => setIsLoading(false));
  }, [loadListings]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadListings();
    setIsRefreshing(false);
  };

  const handleApplyFilters = (nextFilters: ListingFilters) => {
    setFilters(nextFilters);
    setIsFilterModalVisible(false);
  };

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.headerRow}>
          <ThemedText type="title" style={styles.title}>
            Home
          </ThemedText>
          <Pressable onPress={() => setIsFilterModalVisible(true)} style={styles.filterButtonWrapper}>
            <View style={[styles.filterButton, { backgroundColor: theme.backgroundElement }]}>
              <SymbolView
                name={{ ios: 'slider.horizontal.3', android: 'tune', web: 'tune' }}
                tintColor={theme.text}
                size={18}
              />
              <ThemedText type="smallBold">Filters</ThemedText>
              {activeFilterCount > 0 ? (
                <View style={styles.badge}>
                  <ThemedText type="small" style={styles.badgeText}>
                    {activeFilterCount}
                  </ThemedText>
                </View>
              ) : null}
            </View>
          </Pressable>
        </View>

        <FilterModal
          visible={isFilterModalVisible}
          filters={filters}
          onApply={handleApplyFilters}
          onClose={() => setIsFilterModalVisible(false)}
        />

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
            <ThemedText themeColor="textSecondary">No listings available yet.</ThemedText>
          </ThemedView>
        ) : (
          <FlatList
            data={listings}
            keyExtractor={(item) => item.id}
            numColumns={2}
            columnWrapperStyle={styles.row}
            contentContainerStyle={styles.listContent}
            renderItem={({ item }) => (
              <ListingCard
                listing={item}
                onPress={() => router.push(`/listing/${item.id}`)}
                isFavorited={favoritedIds.has(item.id)}
                onToggleFavorite={() => toggleFavorite(item.id)}
              />
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
  filterButtonWrapper: {
    flexShrink: 0,
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    height: 40,
    borderRadius: Spacing.five,
  },
  badge: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    backgroundColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    color: '#ffffff',
    fontSize: 11,
    lineHeight: 14,
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
  listContent: {
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.five,
    gap: Spacing.three,
  },
  row: {
    gap: Spacing.three,
  },
});
