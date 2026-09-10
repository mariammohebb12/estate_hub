import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AvailabilitySlotForm } from '@/components/availability-slot-form';
import { ErrorState } from '@/components/error-state';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/providers/auth-provider';
import { createSlots, deleteSlot, getSlotsForListing, type AvailabilitySlot } from '@/services/bookings';
import { getListingById, type ListingDetail } from '@/services/listings';
import { getFriendlyErrorMessage } from '@/utils/error-message';

const slotDateFormatter = new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
const slotTimeFormatter = new Intl.DateTimeFormat('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
const dayFormatter = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' });

function formatSlotRow(slot: AvailabilitySlot, listingType: 'buy' | 'rent') {
  const start = new Date(slot.start_time);
  const end = new Date(slot.end_time);
  if (listingType === 'rent') {
    return `${dayFormatter.format(start)} - ${dayFormatter.format(end)}`;
  }
  return `${slotDateFormatter.format(start)}, ${slotTimeFormatter.format(start)}–${slotTimeFormatter.format(end)}`;
}

export default function ManageAvailabilityScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const theme = useTheme();
  const { session } = useAuth();
  const userId = session?.user.id;

  const [listing, setListing] = useState<ListingDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [slots, setSlots] = useState<AvailabilitySlot[]>([]);
  const [isLoadingSlots, setIsLoadingSlots] = useState(true);
  const [slotsError, setSlotsError] = useState<string | null>(null);
  const [deletingSlotId, setDeletingSlotId] = useState<string | null>(null);

  const loadListing = useCallback(async () => {
    if (!id) return;
    setIsLoading(true);
    const { data, error } = await getListingById(id);
    if (error || !data) {
      if (error) console.error('loadListing: failed to load listing', error);
      setLoadError(error ? getFriendlyErrorMessage(error) : 'Listing not found.');
    } else {
      setLoadError(null);
      setListing(data);
    }
    setIsLoading(false);
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      loadListing();
    }, [loadListing]),
  );

  const currentListingIdRef = useRef(id);
  currentListingIdRef.current = id;

  const loadSlots = useCallback(async () => {
    if (!id) {
      setSlots([]);
      return;
    }
    const requestedListingId = id;
    // Clear immediately so a previous listing's slots can never render for
    // this one, even for the instant before the new fetch resolves.
    setSlots([]);
    setSlotsError(null);
    setIsLoadingSlots(true);
    const { data, error } = await getSlotsForListing(requestedListingId);
    if (currentListingIdRef.current !== requestedListingId) {
      // The listing id changed again while this request was in flight —
      // discard the stale result instead of applying it to the new listing.
      return;
    }
    if (error) {
      console.error('loadSlots: failed to load availability slots', error);
      setSlotsError(getFriendlyErrorMessage(error));
    } else {
      setSlotsError(null);
      setSlots(data);
    }
    setIsLoadingSlots(false);
  }, [id]);

  useEffect(() => {
    loadSlots();
  }, [loadSlots]);

  const handleAddBuySlots = async (newSlots: Parameters<typeof createSlots>[1]) => {
    if (!id) return { error: 'Missing listing id.' };

    console.log('handleAddBuySlots: about to insert into availability_slots', {
      listingId: id,
      listingSellerId: listing?.seller_id,
      currentUserId: userId,
    });

    const { error } = await createSlots(id, newSlots);
    if (error) {
      console.error('handleAddBuySlots: failed to create availability slots', error, {
        listingId: id,
        listingSellerId: listing?.seller_id,
        currentUserId: userId,
      });
      return { error: getFriendlyErrorMessage(error) };
    }

    await loadSlots();
    return { error: null };
  };

  const handleAddRentSlot = async (newSlots: Parameters<typeof createSlots>[1]) => {
    if (!id) return { error: 'Missing listing id.' };

    console.log('handleAddRentSlot: about to insert into availability_slots', {
      listingId: id,
      listingSellerId: listing?.seller_id,
      currentUserId: userId,
    });

    const { error } = await createSlots(id, newSlots);
    if (error) {
      console.error('handleAddRentSlot: failed to create availability slot', error, {
        listingId: id,
        listingSellerId: listing?.seller_id,
        currentUserId: userId,
      });
      return { error: getFriendlyErrorMessage(error) };
    }

    await loadSlots();
    return { error: null };
  };

  const handleDeleteSlot = (slot: AvailabilitySlot) => {
    Alert.alert('Delete this slot?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setDeletingSlotId(slot.id);
          const { error } = await deleteSlot(slot.id);
          setDeletingSlotId(null);
          if (error) {
            console.error('handleDeleteSlot: failed to delete slot', error);
            setSlotsError(getFriendlyErrorMessage(error));
            return;
          }
          setSlots((prev) => prev.filter((s) => s.id !== slot.id));
        },
      },
    ]);
  };

  if (isLoading) {
    return (
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.centered}>
          <ActivityIndicator />
        </SafeAreaView>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={8}>
            <SymbolView name={{ ios: 'xmark', android: 'close', web: 'close' }} tintColor={theme.text} size={22} />
          </Pressable>
          <ThemedText type="smallBold">Manage Availability</ThemedText>
          <View style={{ width: 22 }} />
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          {loadError ? (
            <ErrorState message={loadError} onRetry={loadListing} isRetrying={isLoading} />
          ) : !listing ? (
            <ThemedText style={styles.errorText}>Listing not found.</ThemedText>
          ) : (
            <>
              <ThemedText themeColor="textSecondary" style={styles.subtitle}>
                {listing.title} · {listing.listing_type === 'rent' ? 'Rental dates' : 'Viewing slots'}
              </ThemedText>

              {listing.listing_type === 'buy' ? (
                <ThemedView style={[styles.card, { backgroundColor: theme.backgroundElement }]}>
                  <ThemedText type="smallBold">Add viewing slots</ThemedText>
                  <AvailabilitySlotForm listingType="buy" onSubmitSlots={handleAddBuySlots} />
                </ThemedView>
              ) : (
                <ThemedView style={[styles.card, { backgroundColor: theme.backgroundElement }]}>
                  <ThemedText type="smallBold">Add a rental period</ThemedText>
                  <AvailabilitySlotForm listingType="rent" onSubmitSlots={handleAddRentSlot} />
                </ThemedView>
              )}

              <View style={styles.field}>
                <ThemedText type="smallBold">Existing availability</ThemedText>

                {isLoadingSlots ? (
                  <ActivityIndicator style={styles.slotsSpacing} />
                ) : slotsError ? (
                  <View style={styles.slotsSpacing}>
                    <ThemedText style={styles.errorText}>{slotsError}</ThemedText>
                    <Pressable onPress={loadSlots} hitSlop={8} disabled={isLoadingSlots}>
                      <ThemedText type="linkPrimary" style={styles.retryLinkText}>
                        Try again
                      </ThemedText>
                    </Pressable>
                  </View>
                ) : slots.length === 0 ? (
                  <ThemedText themeColor="textSecondary" style={styles.slotsSpacing}>
                    No availability added yet.
                  </ThemedText>
                ) : (
                  <View style={[styles.slotsList, styles.slotsSpacing]}>
                    {slots.map((slot) => (
                      <View key={slot.id} style={[styles.slotRow, { backgroundColor: theme.backgroundElement }]}>
                        <View style={styles.slotInfo}>
                          <ThemedText type="small">{formatSlotRow(slot, listing.listing_type)}</ThemedText>
                          <ThemedText type="small" themeColor="textSecondary">
                            {slot.is_booked ? 'Booked' : 'Open'}
                          </ThemedText>
                        </View>
                        {!slot.is_booked ? (
                          <Pressable onPress={() => handleDeleteSlot(slot)} hitSlop={8} disabled={deletingSlotId === slot.id}>
                            {deletingSlotId === slot.id ? (
                              <ActivityIndicator size="small" color={theme.textSecondary} />
                            ) : (
                              <SymbolView
                                name={{ ios: 'trash', android: 'delete', web: 'delete' }}
                                tintColor="#D92D20"
                                size={18}
                              />
                            )}
                          </Pressable>
                        ) : null}
                      </View>
                    ))}
                  </View>
                )}
              </View>
            </>
          )}
        </ScrollView>
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
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.three,
  },
  scrollContent: {
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.six,
    gap: Spacing.four,
  },
  subtitle: {
    marginTop: -Spacing.two,
  },
  card: {
    borderRadius: Spacing.four,
    padding: Spacing.four,
    gap: Spacing.three,
  },
  field: {
    gap: Spacing.two,
  },
  slotsSpacing: {
    marginTop: Spacing.one,
  },
  slotsList: {
    gap: Spacing.two,
  },
  slotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    borderRadius: Spacing.three,
  },
  slotInfo: {
    gap: Spacing.half,
  },
  errorText: {
    color: '#D92D20',
  },
  retryLinkText: {
    marginTop: Spacing.half,
  },
  pressed: {
    opacity: 0.85,
  },
  disabled: {
    opacity: 0.7,
  },
});
