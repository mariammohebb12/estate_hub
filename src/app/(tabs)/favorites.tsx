import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ErrorState } from '@/components/error-state';
import { ListingCard } from '@/components/listing-card';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTabBarClearance } from '@/hooks/use-tab-bar-clearance';
import { useAuth } from '@/providers/auth-provider';
import { useToast } from '@/providers/toast-provider';
import { getFavoritedListings, removeFavorite } from '@/services/favorites';
import type { Listing } from '@/services/listings';
import { getFriendlyErrorMessage } from '@/utils/error-message';

export default function FavoritesScreen() {
  const router = useRouter();
  const { session } = useAuth();
  const userId = session?.user.id;
  const tabBarClearance = useTabBarClearance();
  const { showToast } = useToast();

  const [listings, setListings] = useState<Listing[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadFavorites = useCallback(async () => {
    if (!userId) return;
    const { data, error } = await getFavoritedListings(userId);
    if (error) {
      console.error('loadFavorites: failed to load favorites', error);
      setErrorMessage(getFriendlyErrorMessage(error));
    } else {
      setErrorMessage(null);
      setListings(data);
    }
  }, [userId]);

  useFocusEffect(
    useCallback(() => {
      setIsLoading(true);
      loadFavorites().finally(() => setIsLoading(false));
    }, [loadFavorites]),
  );

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadFavorites();
    setIsRefreshing(false);
  };

  const handleRetry = () => {
    setIsLoading(true);
    loadFavorites().finally(() => setIsLoading(false));
  };

  const handleUnfavorite = async (listingId: string) => {
    if (!userId) return;
    const previousListings = listings;
    setListings((prev) => prev.filter((listing) => listing.id !== listingId));

    try {
      const { error } = await removeFavorite(userId, listingId);
      if (error) throw error;
    } catch (error) {
      console.error('handleUnfavorite: failed to remove favorite', error);
      setListings(previousListings);
      showToast(getFriendlyErrorMessage(error));
    }
  };

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <ThemedText type="title" style={styles.title}>
          Favorites
        </ThemedText>

        {isLoading && listings.length === 0 ? (
          <ThemedView style={styles.centered}>
            <ActivityIndicator />
          </ThemedView>
        ) : errorMessage ? (
          <ThemedView style={styles.centered}>
            <ErrorState message={errorMessage} onRetry={handleRetry} isRetrying={isLoading} />
          </ThemedView>
        ) : listings.length === 0 ? (
          <ThemedView style={styles.centered}>
            <ThemedText themeColor="textSecondary">
              No favorites yet. Tap the heart on a listing to save it here.
            </ThemedText>
          </ThemedView>
        ) : (
          <FlatList
            data={listings}
            keyExtractor={(item) => item.id}
            numColumns={2}
            columnWrapperStyle={styles.row}
            contentContainerStyle={[styles.listContent, { paddingBottom: Spacing.five + tabBarClearance }]}
            renderItem={({ item }) => (
              <ListingCard
                listing={item}
                onPress={() => router.push(`/listing/${item.id}`)}
                isFavorited
                onToggleFavorite={() => handleUnfavorite(item.id)}
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
  title: {
    fontSize: 32,
    lineHeight: 38,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.two,
    paddingBottom: Spacing.three,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.four,
  },
  listContent: {
    paddingHorizontal: Spacing.four,
    gap: Spacing.three,
  },
  row: {
    gap: Spacing.three,
  },
});
