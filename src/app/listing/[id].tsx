import { useLocalSearchParams, useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/providers/auth-provider';
import { bookSlot, getAvailableSlots, type AvailabilitySlot } from '@/services/bookings';
import { addFavorite, getFavoritedListingIds, removeFavorite } from '@/services/favorites';
import { getListingById, type ListingDetail } from '@/services/listings';

const priceFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});

const slotDateFormatter = new Intl.DateTimeFormat('en-US', {
  weekday: 'short',
  month: 'short',
  day: 'numeric',
});

const slotTimeFormatter = new Intl.DateTimeFormat('en-US', {
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

function formatSlotLabel(slot: AvailabilitySlot) {
  const start = new Date(slot.start_time);
  const end = new Date(slot.end_time);
  return `${slotDateFormatter.format(start)}, ${slotTimeFormatter.format(start)}–${slotTimeFormatter.format(end)}`;
}

export default function ListingDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { session } = useAuth();
  const userId = session?.user.id;

  const [listing, setListing] = useState<ListingDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isFavorited, setIsFavorited] = useState(false);

  const [slots, setSlots] = useState<AvailabilitySlot[]>([]);
  const [isLoadingSlots, setIsLoadingSlots] = useState(false);
  const [slotsError, setSlotsError] = useState<string | null>(null);
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);
  const [isBooking, setIsBooking] = useState(false);
  const [bookingError, setBookingError] = useState<string | null>(null);
  const [confirmedSlot, setConfirmedSlot] = useState<AvailabilitySlot | null>(null);

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

  useEffect(() => {
    if (!id || !userId) return;
    getFavoritedListingIds(userId).then(({ data }) => {
      setIsFavorited(data.includes(id));
    });
  }, [id, userId]);

  const loadSlots = useCallback(async () => {
    if (!id) return;
    setIsLoadingSlots(true);
    const { data, error } = await getAvailableSlots(id);
    if (error) {
      setSlotsError(error.message);
    } else {
      setSlotsError(null);
      setSlots(data);
    }
    setIsLoadingSlots(false);
  }, [id]);

  useEffect(() => {
    if (listing?.listing_type === 'buy') {
      loadSlots();
    }
  }, [listing?.listing_type, loadSlots]);

  const handleSelectSlot = (slotId: string) => {
    setBookingError(null);
    setSelectedSlotId((prev) => (prev === slotId ? null : slotId));
  };

  const handleConfirmBooking = async () => {
    if (!id || !userId || !selectedSlotId) return;
    setIsBooking(true);
    setBookingError(null);

    const bookedSlot = slots.find((slot) => slot.id === selectedSlotId) ?? null;
    const { error } = await bookSlot({ slotId: selectedSlotId, listingId: id, buyerId: userId });

    if (error) {
      if (error === 'slot_taken') {
        setBookingError('That time was just booked by someone else. Pick another time.');
        setSelectedSlotId(null);
        await loadSlots();
      } else if (error === 'not_permitted') {
        setBookingError("Couldn't book this slot right now — please try again in a moment.");
      } else {
        setBookingError(error);
      }
    } else {
      setConfirmedSlot(bookedSlot);
      setSelectedSlotId(null);
    }

    setIsBooking(false);
  };

  const handleToggleFavorite = async () => {
    if (!id || !userId) return;
    const wasFavorited = isFavorited;
    setIsFavorited(!wasFavorited);

    const { error } = wasFavorited ? await removeFavorite(userId, id) : await addFavorite(userId, id);
    if (error) {
      console.error('handleToggleFavorite: failed to update favorite', error);
      setIsFavorited(wasFavorited);
    }
  };

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
          <View style={[styles.photoTypeBadge, { top: insets.top + Spacing.two + 36 + Spacing.two }]}>
            <ThemedText type="small" style={styles.photoTypeBadgeText}>
              {listing.listing_type === 'rent' ? 'For Rent' : 'For Sale'}
            </ThemedText>
          </View>
          <View style={styles.photoDots}>
            <View style={styles.photoDot} />
          </View>
        </View>

        <ThemedView style={styles.content}>
          <ThemedView style={styles.titleBlock}>
            <View style={styles.titleRow}>
              <ThemedText type="subtitle" style={styles.titleText}>
                {listing.title}
              </ThemedText>
              <Pressable onPress={handleToggleFavorite} hitSlop={8}>
                <SymbolView
                  name={
                    isFavorited
                      ? { ios: 'heart.fill', android: 'favorite', web: 'favorite' }
                      : { ios: 'heart', android: 'favorite_border', web: 'favorite_border' }
                  }
                  tintColor={isFavorited ? theme.text : theme.textSecondary}
                  size={24}
                />
              </Pressable>
            </View>
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

          {listing.listing_type === 'buy' && !confirmedSlot ? (
            <ThemedView style={styles.section}>
              <ThemedText type="smallBold">Available viewing times</ThemedText>

              {isLoadingSlots ? (
                <ActivityIndicator style={styles.slotsSpacing} />
              ) : slotsError ? (
                <ThemedText style={[styles.errorText, styles.slotsSpacing]}>{slotsError}</ThemedText>
              ) : slots.length === 0 ? (
                <ThemedText themeColor="textSecondary" style={styles.slotsSpacing}>
                  No viewing times available
                </ThemedText>
              ) : (
                <View style={styles.slotsSpacing}>
                  {bookingError ? (
                    <ThemedText style={[styles.errorText, styles.slotError]}>{bookingError}</ThemedText>
                  ) : null}
                  <View style={styles.slotsList}>
                    {slots.map((slot) => {
                      const selected = selectedSlotId === slot.id;
                      return (
                        <Pressable
                          key={slot.id}
                          onPress={() => handleSelectSlot(slot.id)}
                          disabled={isBooking}
                          style={[
                            styles.slotRow,
                            {
                              backgroundColor: selected ? theme.text : theme.backgroundElement,
                            },
                          ]}>
                          <ThemedText
                            type="small"
                            style={{ color: selected ? theme.background : theme.text }}>
                            {formatSlotLabel(slot)}
                          </ThemedText>
                          {selected ? (
                            <SymbolView
                              name={{ ios: 'checkmark.circle.fill', android: 'check_circle', web: 'check_circle' }}
                              tintColor={theme.background}
                              size={18}
                            />
                          ) : null}
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              )}
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
        {listing.listing_type === 'buy' && confirmedSlot ? (
          <View style={[styles.ctaButton, styles.ctaSuccess]}>
            <SymbolView
              name={{ ios: 'checkmark.circle.fill', android: 'check_circle', web: 'check_circle' }}
              tintColor="#ffffff"
              size={18}
            />
            <ThemedText style={styles.ctaButtonText} numberOfLines={1}>
              Viewing booked for {formatSlotLabel(confirmedSlot)}
            </ThemedText>
          </View>
        ) : (
          <Pressable
            onPress={listing.listing_type === 'buy' ? handleConfirmBooking : undefined}
            disabled={listing.listing_type === 'buy' && (!selectedSlotId || isBooking)}
            style={({ pressed }) => [
              styles.ctaButton,
              pressed && styles.pressed,
              listing.listing_type === 'buy' && !selectedSlotId ? styles.ctaButtonDisabled : null,
            ]}>
            <ThemedText style={styles.ctaButtonText}>
              {listing.listing_type === 'buy' && isBooking ? 'Booking…' : ctaLabel}
            </ThemedText>
          </Pressable>
        )}
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
  photoTypeBadge: {
    position: 'absolute',
    left: Spacing.three,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.half,
    borderRadius: Spacing.five,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  photoTypeBadgeText: {
    color: '#ffffff',
    fontSize: 11,
    lineHeight: 14,
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
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  titleText: {
    flex: 1,
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
  slotsSpacing: {
    marginTop: Spacing.one,
  },
  slotError: {
    marginBottom: Spacing.two,
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
  ctaButtonDisabled: {
    opacity: 0.4,
  },
  ctaSuccess: {
    flexDirection: 'row',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
  },
  ctaButtonText: {
    color: '#ffffff',
    fontWeight: '600',
  },
  pressed: {
    opacity: 0.85,
  },
});
