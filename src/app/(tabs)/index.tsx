import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ListingCard } from '@/components/listing-card';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { getAvailableListings, type Listing } from '@/services/listings';

export default function HomeScreen() {
  const [listings, setListings] = useState<Listing[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadListings = useCallback(async () => {
    const { data, error } = await getAvailableListings();
    if (error) {
      setErrorMessage(error.message);
    } else {
      setErrorMessage(null);
      setListings(data);
    }
  }, []);

  useEffect(() => {
    setIsLoading(true);
    loadListings().finally(() => setIsLoading(false));
  }, [loadListings]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadListings();
    setIsRefreshing(false);
  };

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <ThemedText type="title" style={styles.title}>
          Home
        </ThemedText>

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
            renderItem={({ item }) => <ListingCard listing={item} />}
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
