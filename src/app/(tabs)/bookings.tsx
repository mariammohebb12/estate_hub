import { useFocusEffect } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, Image, Modal, Pressable, RefreshControl, StyleSheet, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { ErrorState } from '@/components/error-state';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTabBarClearance } from '@/hooks/use-tab-bar-clearance';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/providers/auth-provider';
import { useMode } from '@/providers/mode-provider';
import { getBookingsOnMyListings, getMyBookings, type BookingRow } from '@/services/bookings';
import { getFriendlyErrorMessage } from '@/utils/error-message';
import { getShortLocation } from '@/utils/format-location';

const dateFormatter = new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
const timeFormatter = new Intl.DateTimeFormat('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
const dayFormatter = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' });

const STATUS_COLORS: Record<string, { background: string; text: string }> = {
  confirmed: { background: '#E7F4EC', text: '#3F7A5C' },
  cancelled: { background: '#F3E8E8', text: '#9C6363' },
};

const LISTING_TYPE_LABELS: Record<'buy' | 'rent', string> = {
  buy: 'For Sale',
  rent: 'For Rent',
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

function ListingTypeBadge({ listingType }: { listingType: 'buy' | 'rent' }) {
  return (
    <View style={[styles.listingTypeBadge, listingType === 'rent' && styles.listingTypeBadgeRent]}>
      <ThemedText type="small" style={[styles.listingTypeBadgeText, listingType === 'rent' && styles.listingTypeBadgeTextRent]}>
        {LISTING_TYPE_LABELS[listingType]}
      </ThemedText>
    </View>
  );
}

function formatSlot(slot: BookingRow['availability_slots'], listingType: 'buy' | 'rent' | undefined) {
  if (!slot) return null;
  const start = new Date(slot.start_time);
  const end = new Date(slot.end_time);
  if (listingType === 'rent') {
    return `${dayFormatter.format(start)} - ${dayFormatter.format(end)}`;
  }
  return `${dateFormatter.format(start)}, ${timeFormatter.format(start)}–${timeFormatter.format(end)}`;
}

export default function BookingsScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { session } = useAuth();
  const { mode } = useMode();
  const userId = session?.user.id;
  const isSelling = mode === 'sell';
  const tabBarClearance = useTabBarClearance();

  const [bookings, setBookings] = useState<BookingRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [selectedBooking, setSelectedBooking] = useState<BookingRow | null>(null);

  const loadBookings = useCallback(async () => {
    if (!userId) return;
    const { data, error } = isSelling ? await getBookingsOnMyListings(userId) : await getMyBookings(userId);
    if (error) {
      console.error('loadBookings: failed to load bookings', error);
      setErrorMessage(getFriendlyErrorMessage(error));
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

  const handleRetry = () => {
    setIsLoading(true);
    loadBookings().finally(() => setIsLoading(false));
  };

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <ThemedText type="title" style={styles.title}>
          Bookings
        </ThemedText>

        {isLoading && bookings.length === 0 ? (
          <ThemedView style={styles.centered}>
            <ActivityIndicator />
          </ThemedView>
        ) : errorMessage ? (
          <ThemedView style={styles.centered}>
            <ErrorState message={errorMessage} onRetry={handleRetry} isRetrying={isLoading} />
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
            contentContainerStyle={[styles.listContent, { paddingBottom: Spacing.five + tabBarClearance }]}
            ItemSeparatorComponent={() => <View style={styles.separator} />}
            renderItem={({ item }) => (
              <Pressable
                onPress={() => setSelectedBooking(item)}
                style={({ pressed }) => [
                  styles.card,
                  { backgroundColor: theme.background, borderColor: theme.backgroundElement },
                  pressed && styles.pressed,
                ]}>
                <View style={styles.cardTopRow}>
                  <View style={[styles.thumbnail, { backgroundColor: theme.backgroundElement }]}>
                    {item.listings?.cover_photo_url ? (
                      <Image source={{ uri: item.listings.cover_photo_url }} style={styles.thumbnailImage} />
                    ) : (
                      <SymbolView
                        name={{ ios: 'photo', android: 'photo', web: 'photo' }}
                        tintColor={theme.textSecondary}
                        size={20}
                      />
                    )}
                  </View>

                  <View style={styles.rowInfo}>
                    <ThemedText type="smallBold" numberOfLines={1} style={styles.rowTitle}>
                      {item.listings?.title ?? 'Listing'}
                    </ThemedText>
                    {item.listings?.location_text ? (
                      <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
                        {getShortLocation(item.listings.location_text)}
                      </ThemedText>
                    ) : null}
                    <View style={styles.badgeRow}>
                      {item.listings?.listing_type ? (
                        <ListingTypeBadge listingType={item.listings.listing_type} />
                      ) : null}
                      <StatusBadge status={item.status} />
                    </View>
                  </View>
                </View>

                <View style={styles.detailsColumn}>
                  <View style={styles.detailRow}>
                    <SymbolView
                      name={{ ios: 'calendar', android: 'calendar_today', web: 'calendar_today' }}
                      tintColor={theme.textSecondary}
                      size={14}
                    />
                    <ThemedText type="small" themeColor="textSecondary" numberOfLines={1} style={styles.detailText}>
                      {formatSlot(item.availability_slots, item.listings?.listing_type) ?? '—'}
                    </ThemedText>
                  </View>
                  {isSelling ? (
                    <View style={styles.detailRow}>
                      <SymbolView
                        name={{ ios: 'person.circle', android: 'person', web: 'person' }}
                        tintColor={theme.textSecondary}
                        size={14}
                      />
                      <ThemedText type="small" themeColor="textSecondary" numberOfLines={1} style={styles.detailText}>
                        {item.buyer_full_name ?? 'Buyer'}
                        {item.buyer_phone ? ` · ${item.buyer_phone}` : ''}
                      </ThemedText>
                    </View>
                  ) : null}
                </View>
              </Pressable>
            )}
            refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />}
          />
        )}
      </SafeAreaView>

      <Modal
        visible={selectedBooking != null}
        transparent
        animationType="slide"
        onRequestClose={() => setSelectedBooking(null)}>
        <Pressable style={styles.backdrop} onPress={() => setSelectedBooking(null)} />
        <View style={styles.sheetContainer} pointerEvents="box-none">
          <ThemedView
            style={[styles.sheet, { backgroundColor: theme.background, paddingBottom: insets.bottom + Spacing.four }]}>
            <View style={styles.sheetHeader}>
              <ThemedText type="smallBold">Booking details</ThemedText>
              <Pressable onPress={() => setSelectedBooking(null)} hitSlop={8}>
                <View style={[styles.closeButton, { backgroundColor: theme.backgroundElement }]}>
                  <SymbolView
                    name={{ ios: 'xmark', android: 'close', web: 'close' }}
                    tintColor={theme.text}
                    size={16}
                  />
                </View>
              </Pressable>
            </View>

            {selectedBooking ? (
              <>
                <View style={styles.cardTopRow}>
                  <View style={[styles.thumbnail, { backgroundColor: theme.backgroundElement }]}>
                    {selectedBooking.listings?.cover_photo_url ? (
                      <Image source={{ uri: selectedBooking.listings.cover_photo_url }} style={styles.thumbnailImage} />
                    ) : (
                      <SymbolView
                        name={{ ios: 'photo', android: 'photo', web: 'photo' }}
                        tintColor={theme.textSecondary}
                        size={20}
                      />
                    )}
                  </View>

                  <View style={styles.rowInfo}>
                    <ThemedText type="smallBold" numberOfLines={1} style={styles.rowTitle}>
                      {selectedBooking.listings?.title ?? 'Listing'}
                    </ThemedText>
                    {selectedBooking.listings?.location_text ? (
                      <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
                        {getShortLocation(selectedBooking.listings.location_text)}
                      </ThemedText>
                    ) : null}
                    <View style={styles.badgeRow}>
                      {selectedBooking.listings?.listing_type ? (
                        <ListingTypeBadge listingType={selectedBooking.listings.listing_type} />
                      ) : null}
                      <StatusBadge status={selectedBooking.status} />
                    </View>
                  </View>
                </View>

                <View style={styles.detailsColumn}>
                  <View style={styles.detailRow}>
                    <SymbolView
                      name={{ ios: 'calendar', android: 'calendar_today', web: 'calendar_today' }}
                      tintColor={theme.textSecondary}
                      size={14}
                    />
                    <ThemedText type="small" themeColor="textSecondary" style={styles.detailText}>
                      {formatSlot(selectedBooking.availability_slots, selectedBooking.listings?.listing_type) ?? '—'}
                    </ThemedText>
                  </View>
                  {isSelling ? (
                    <View style={styles.detailRow}>
                      <SymbolView
                        name={{ ios: 'person.circle', android: 'person', web: 'person' }}
                        tintColor={theme.textSecondary}
                        size={14}
                      />
                      <ThemedText type="small" themeColor="textSecondary" style={styles.detailText}>
                        {selectedBooking.buyer_full_name ?? 'Buyer'}
                        {selectedBooking.buyer_phone ? ` · ${selectedBooking.buyer_phone}` : ''}
                      </ThemedText>
                    </View>
                  ) : null}
                </View>
              </>
            ) : null}
          </ThemedView>
        </View>
      </Modal>
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
  listContent: {
    paddingHorizontal: Spacing.four,
  },
  separator: {
    height: Spacing.three,
  },
  card: {
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
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: Spacing.three,
  },
  thumbnail: {
    aspectRatio: 1,
    minWidth: 56,
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
    gap: Spacing.half,
  },
  rowTitle: {
    flexShrink: 1,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    marginTop: Spacing.half,
  },
  detailsColumn: {
    gap: Spacing.one,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  detailText: {
    flex: 1,
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
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheetContainer: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  sheet: {
    borderTopLeftRadius: Spacing.five,
    borderTopRightRadius: Spacing.five,
    padding: Spacing.four,
    gap: Spacing.three,
  },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  closeButton: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
});
