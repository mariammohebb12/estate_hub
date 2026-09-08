import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/providers/auth-provider';
import { useMode } from '@/providers/mode-provider';
import { getBookingsOnMyListings, getMyBookings, type BookingRow } from '@/services/bookings';

const dateFormatter = new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
const timeFormatter = new Intl.DateTimeFormat('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });

const STATUS_COLORS: Record<string, { background: string; text: string }> = {
  confirmed: { background: '#DCFCE7', text: '#15803D' },
  cancelled: { background: '#E5E7EB', text: '#374151' },
};

function StatusBadge({ status }: { status: string }) {
  const colors = STATUS_COLORS[status] ?? { background: '#E5E7EB', text: '#374151' };
  return (
    <View style={[styles.statusBadge, { backgroundColor: colors.background }]}>
      <ThemedText type="small" style={[styles.statusBadgeText, { color: colors.text }]}>
        {status === 'confirmed' ? 'Confirmed' : 'Cancelled'}
      </ThemedText>
    </View>
  );
}

function formatSlot(slot: BookingRow['availability_slots']) {
  if (!slot) return null;
  const start = new Date(slot.start_time);
  const end = new Date(slot.end_time);
  return `${dateFormatter.format(start)}, ${timeFormatter.format(start)}–${timeFormatter.format(end)}`;
}

export default function BookingsScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { session } = useAuth();
  const { mode } = useMode();
  const userId = session?.user.id;
  const isSelling = mode === 'sell';

  const [bookings, setBookings] = useState<BookingRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadBookings = useCallback(async () => {
    if (!userId) return;
    const { data, error } = isSelling ? await getBookingsOnMyListings(userId) : await getMyBookings(userId);
    if (error) {
      setErrorMessage(error.message);
    } else {
      setErrorMessage(null);
      setBookings(data);
    }
  }, [userId, isSelling]);

  useFocusEffect(
    useCallback(() => {
      setIsLoading(true);
      loadBookings().finally(() => setIsLoading(false));
    }, [loadBookings]),
  );

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadBookings();
    setIsRefreshing(false);
  };

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <ThemedText type="title" style={styles.title}>
          Bookings
        </ThemedText>

        {isLoading ? (
          <ThemedView style={styles.centered}>
            <ActivityIndicator />
          </ThemedView>
        ) : errorMessage ? (
          <ThemedView style={styles.centered}>
            <ThemedText style={styles.errorText}>{errorMessage}</ThemedText>
          </ThemedView>
        ) : bookings.length === 0 ? (
          <ThemedView style={styles.centered}>
            <ThemedText type="smallBold" style={styles.emptyTitle}>
              {isSelling ? 'No bookings on your listings yet' : "You don't have any bookings yet"}
            </ThemedText>
            <ThemedText themeColor="textSecondary" style={styles.emptySubtitle}>
              {isSelling
                ? 'When someone books a viewing or dates, it will show up here.'
                : 'Book a viewing or reserve dates from a listing to see it here.'}
            </ThemedText>
          </ThemedView>
        ) : (
          <FlatList
            data={bookings}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            ItemSeparatorComponent={() => <View style={styles.separator} />}
            renderItem={({ item }) => (
              <Pressable
                onPress={() => item.listings && router.push(`/listing/${item.listings.id}`)}
                style={({ pressed }) => [
                  styles.row,
                  { backgroundColor: theme.backgroundElement },
                  pressed && styles.pressed,
                ]}>
                <View style={styles.rowInfo}>
                  <ThemedText type="smallBold" numberOfLines={1}>
                    {item.listings?.title ?? 'Listing'}
                  </ThemedText>
                  {item.listings?.location_text ? (
                    <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
                      {item.listings.location_text}
                    </ThemedText>
                  ) : null}
                  <ThemedText type="small" themeColor="textSecondary">
                    {formatSlot(item.availability_slots) ?? '—'}
                  </ThemedText>
                </View>
                <StatusBadge status={item.status} />
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
    paddingBottom: Spacing.five,
  },
  separator: {
    height: Spacing.three,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.three,
    borderRadius: Spacing.three,
    padding: Spacing.three,
  },
  rowInfo: {
    flex: 1,
    gap: Spacing.half,
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
