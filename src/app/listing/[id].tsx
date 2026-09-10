import * as Clipboard from 'expo-clipboard';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SymbolView, type AndroidSymbol } from 'expo-symbols';
import { useCallback, useEffect, useState } from 'react';
import type { SFSymbol } from 'sf-symbols-typescript';
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Image,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DateRangeCalendar, dateCoveredBySlot, isSameDay, startOfMonth } from '@/components/date-range-calendar';
import { ErrorState } from '@/components/error-state';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/providers/auth-provider';
import { useToast } from '@/providers/toast-provider';
import { bookSlot, getAvailableSlots, type AvailabilitySlot } from '@/services/bookings';
import { addFavorite, getFavoritedListingIds, removeFavorite } from '@/services/favorites';
import { getListingPhotos, type ListingPhoto } from '@/services/listing-photos';
import { getListingById, type ListingDetail } from '@/services/listings';
import { getFriendlyErrorMessage } from '@/utils/error-message';

const screenWidth = Dimensions.get('window').width;
const photoHeight = screenWidth * (3 / 4);

const priceFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});

function getInitials(fullName: string) {
  return fullName
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}


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

const rangeDateFormatter = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' });

type TagIcon = { ios: SFSymbol; android: AndroidSymbol };

type Tag = {
  key: string;
  label: string;
  icon: TagIcon;
};

const DEFAULT_AMENITY_ICON: TagIcon = { ios: 'checkmark.circle.fill', android: 'check_circle' };

const AMENITY_ICON_RULES: { match: RegExp; icon: TagIcon }[] = [
  { match: /wi-?fi|internet/i, icon: { ios: 'wifi', android: 'wifi' } },
  { match: /pool|swim/i, icon: { ios: 'figure.pool.swim', android: 'pool' } },
  { match: /park|garage/i, icon: { ios: 'parkingsign.circle.fill', android: 'local_parking' } },
  { match: /gym|fitness/i, icon: { ios: 'dumbbell.fill', android: 'fitness_center' } },
  { match: /air.?condition|\bac\b/i, icon: { ios: 'snowflake', android: 'ac_unit' } },
  { match: /heat|fireplace/i, icon: { ios: 'flame.fill', android: 'local_fire_department' } },
  { match: /laundry|washer/i, icon: { ios: 'washer.fill', android: 'local_laundry_service' } },
  { match: /pet/i, icon: { ios: 'pawprint.fill', android: 'pets' } },
  { match: /balcony|terrace|patio|deck/i, icon: { ios: 'sun.max.fill', android: 'balcony' } },
  { match: /security|alarm/i, icon: { ios: 'shield.fill', android: 'security' } },
  { match: /elevator|lift/i, icon: { ios: 'arrow.up.arrow.down.circle.fill', android: 'elevator' } },
  { match: /\btv\b|cable/i, icon: { ios: 'tv.fill', android: 'tv' } },
  { match: /garden|yard/i, icon: { ios: 'leaf.fill', android: 'yard' } },
];

function getAmenityIcon(amenity: string): TagIcon {
  return AMENITY_ICON_RULES.find(({ match }) => match.test(amenity))?.icon ?? DEFAULT_AMENITY_ICON;
}

export default function ListingDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { session } = useAuth();
  const userId = session?.user.id;
  const { showToast } = useToast();

  const [listing, setListing] = useState<ListingDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isFavorited, setIsFavorited] = useState(false);
  const [isPhoneSheetVisible, setIsPhoneSheetVisible] = useState(false);
  const [isPhoneCopied, setIsPhoneCopied] = useState(false);

  const [photos, setPhotos] = useState<ListingPhoto[]>([]);
  const [activePhotoIndex, setActivePhotoIndex] = useState(0);

  const [slots, setSlots] = useState<AvailabilitySlot[]>([]);
  const [isLoadingSlots, setIsLoadingSlots] = useState(false);
  const [slotsError, setSlotsError] = useState<string | null>(null);
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);
  const [isBooking, setIsBooking] = useState(false);
  const [bookingError, setBookingError] = useState<string | null>(null);
  const [confirmedSlot, setConfirmedSlot] = useState<AvailabilitySlot | null>(null);

  const [calendarMonth, setCalendarMonth] = useState(() => startOfMonth(new Date()));
  const [rangeStart, setRangeStart] = useState<Date | null>(null);
  const [rangeEnd, setRangeEnd] = useState<Date | null>(null);

  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [isDaySheetVisible, setIsDaySheetVisible] = useState(false);

  const loadListing = useCallback(async () => {
    if (!id) return;
    setIsLoading(true);
    const { data, error } = await getListingById(id);
    if (error) {
      console.error('loadListing: failed to load listing', error);
      setErrorMessage(getFriendlyErrorMessage(error));
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
    if (!id) return;
    setActivePhotoIndex(0);
    getListingPhotos(id).then(({ data, error }) => {
      if (!error) {
        setPhotos(data);
      }
    });
  }, [id]);

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
      console.error('loadSlots: failed to load availability slots', error);
      setSlotsError(getFriendlyErrorMessage(error));
    } else {
      setSlotsError(null);
      setSlots(data);
    }
    setIsLoadingSlots(false);
  }, [id]);

  useEffect(() => {
    if (listing) {
      loadSlots();
    }
  }, [listing, loadSlots]);

  const handleSelectSlot = (slotId: string) => {
    setBookingError(null);
    setSelectedSlotId((prev) => (prev === slotId ? null : slotId));
  };

  const getSlotsForDay = (day: Date) =>
    slots
      .filter((slot) => dateCoveredBySlot(day, slot))
      .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());

  const handleSelectDay = (day: Date) => {
    setBookingError(null);
    if (getSlotsForDay(day).length === 0) return;
    setSelectedDay(day);
    setIsDaySheetVisible(true);
  };

  const handleSelectSlotFromSheet = (slotId: string) => {
    handleSelectSlot(slotId);
    setIsDaySheetVisible(false);
  };

  const handleSelectDate = (date: Date) => {
    setBookingError(null);
    const coveringSlot = slots.find((slot) => dateCoveredBySlot(date, slot));
    if (!coveringSlot) return;

    if (!rangeStart || rangeEnd) {
      setRangeStart(date);
      setRangeEnd(null);
      setSelectedSlotId(null);
      return;
    }

    if (isSameDay(date, rangeStart)) {
      setRangeStart(null);
      setRangeEnd(null);
      setSelectedSlotId(null);
      return;
    }

    const startSlot = slots.find((slot) => dateCoveredBySlot(rangeStart, slot));
    const [newStart, newEnd] = date.getTime() < rangeStart.getTime() ? [date, rangeStart] : [rangeStart, date];

    if (!startSlot || !dateCoveredBySlot(newStart, startSlot) || !dateCoveredBySlot(newEnd, startSlot)) {
      setRangeStart(date);
      setRangeEnd(null);
      setSelectedSlotId(null);
      return;
    }

    setRangeStart(newStart);
    setRangeEnd(newEnd);
    setSelectedSlotId(startSlot.id);
  };

  const handleConfirmBooking = async () => {
    if (!id || !userId || !selectedSlotId) return;
    setIsBooking(true);
    setBookingError(null);

    const bookedSlot = slots.find((slot) => slot.id === selectedSlotId) ?? null;
    const { error } = await bookSlot({ slotId: selectedSlotId, listingId: id, buyerId: userId });

    if (error) {
      if (error === 'slot_taken') {
        setBookingError(
          listing?.listing_type === 'rent'
            ? 'Those dates were just booked by someone else. Pick a different range.'
            : 'That time was just booked by someone else. Pick another time.',
        );
        setSelectedSlotId(null);
        setRangeStart(null);
        setRangeEnd(null);
        await loadSlots();
      } else if (error === 'not_permitted') {
        setBookingError("Couldn't book this slot right now — please try again in a moment.");
      } else {
        console.error('handleConfirmBooking: failed to book slot', error);
        setBookingError(getFriendlyErrorMessage(error));
      }
    } else {
      setConfirmedSlot(bookedSlot);
      setSelectedSlotId(null);
      setRangeStart(null);
      setRangeEnd(null);
    }

    setIsBooking(false);
  };

  const handleToggleFavorite = async () => {
    if (!id || !userId) return;
    const wasFavorited = isFavorited;
    setIsFavorited(!wasFavorited);

    try {
      const { error } = wasFavorited ? await removeFavorite(userId, id) : await addFavorite(userId, id);
      if (error) throw error;
    } catch (error) {
      console.error('handleToggleFavorite: failed to update favorite', error);
      setIsFavorited(wasFavorited);
      showToast(getFriendlyErrorMessage(error));
    }
  };

  const handleOpenMaps = async () => {
    if (!listing?.location_text) return;
    const query = encodeURIComponent(listing.location_text);
    const webFallbackUrl = `https://www.google.com/maps/search/?api=1&query=${query}`;
    const url = Platform.select({
      ios: `maps://?q=${query}`,
      android: `geo:0,0?q=${query}`,
      default: webFallbackUrl,
    });

    try {
      const canOpen = await Linking.canOpenURL(url);
      await Linking.openURL(canOpen ? url : webFallbackUrl);
    } catch (error) {
      console.error('handleOpenMaps: failed to open maps', error);
    }
  };

  const handleCopyPhone = async () => {
    if (!listing?.seller_phone) return;
    await Clipboard.setStringAsync(listing.seller_phone);
    setIsPhoneCopied(true);
    setTimeout(() => setIsPhoneCopied(false), 1500);
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
          {errorMessage ? (
            <ErrorState message={errorMessage} onRetry={loadListing} isRetrying={isLoading} />
          ) : (
            <ThemedText style={styles.errorText}>Listing not found.</ThemedText>
          )}
        </View>
      </ThemedView>
    );
  }

  const stats: Tag[] = [
    listing.bedrooms != null
      ? { key: 'bedrooms', label: `${listing.bedrooms} Bedrooms`, icon: { ios: 'bed.double.fill', android: 'bed' } }
      : null,
    listing.bathrooms != null
      ? { key: 'bathrooms', label: `${listing.bathrooms} Bathrooms`, icon: { ios: 'bathtub.fill', android: 'bathtub' } }
      : null,
    listing.property_type
      ? { key: 'type', label: listing.property_type, icon: { ios: 'house.fill', android: 'home' } }
      : null,
    listing.area_sqm != null
      ? { key: 'area', label: `${listing.area_sqm} m²`, icon: { ios: 'ruler.fill', android: 'straighten' } }
      : null,
  ].filter((stat): stat is Tag => Boolean(stat));

  const amenities: Tag[] = (listing.amenities ?? []).map((amenity) => ({
    key: amenity,
    label: amenity,
    icon: getAmenityIcon(amenity),
  }));

  const ctaLabel = listing.listing_type === 'rent' ? 'Book Dates' : 'Book Viewing';
  const selectedBuySlot = slots.find((slot) => slot.id === selectedSlotId) ?? null;

  return (
    <ThemedView style={styles.container}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + Spacing.six + Spacing.four }}
        showsVerticalScrollIndicator={false}>
        <View style={[styles.photo, { backgroundColor: theme.backgroundElement }]}>
          {photos.length > 0 ? (
            <FlatList
              data={photos}
              keyExtractor={(photo) => photo.id}
              style={styles.photoList}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onMomentumScrollEnd={(event) => {
                const index = Math.round(event.nativeEvent.contentOffset.x / screenWidth);
                setActivePhotoIndex(index);
              }}
              renderItem={({ item }) => (
                <Image source={{ uri: item.photo_url }} style={styles.photoImage} />
              )}
            />
          ) : (
            <SymbolView
              name={{ ios: 'photo', android: 'photo', web: 'photo' }}
              tintColor={theme.textSecondary}
              size={40}
            />
          )}
          <View style={[styles.photoTypeBadge, { top: insets.top + Spacing.two + 36 + Spacing.two }]}>
            <ThemedText type="small" style={styles.photoTypeBadgeText}>
              {listing.listing_type === 'rent' ? 'For Rent' : 'For Sale'}
            </ThemedText>
          </View>
          {photos.length > 1 ? (
            <View style={styles.photoDots}>
              {photos.map((photo, index) => (
                <View
                  key={photo.id}
                  style={[styles.photoDot, index !== activePhotoIndex && styles.photoDotInactive]}
                />
              ))}
            </View>
          ) : null}
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
                  tintColor={isFavorited ? '#000000' : theme.textSecondary}
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

          {listing.location_text ? (
            <Pressable
              onPress={handleOpenMaps}
              style={({ pressed }) => [
                styles.mapCard,
                { backgroundColor: theme.backgroundElement },
                pressed && styles.mapCardPressed,
              ]}>
              <View style={[styles.mapCardIcon, { backgroundColor: theme.backgroundSelected }]}>
                <SymbolView
                  name={{ ios: 'map.fill', android: 'map', web: 'map' }}
                  tintColor={theme.text}
                  size={20}
                />
              </View>
              <View style={styles.mapCardInfo}>
                <ThemedText type="smallBold">Open in Maps</ThemedText>
                <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
                  {listing.location_text}
                </ThemedText>
              </View>
              <SymbolView
                name={{ ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' }}
                tintColor={theme.textSecondary}
                size={18}
              />
            </Pressable>
          ) : null}

          {stats.length > 0 ? (
            <ThemedView style={styles.section}>
              <ThemedText type="smallBold">Facilities</ThemedText>
              <View style={styles.tileGrid}>
                {stats.map((stat) => (
                  <ThemedView
                    key={stat.key}
                    style={[styles.tile, { backgroundColor: theme.backgroundElement }]}>
                    <SymbolView
                      name={{ ios: stat.icon.ios, android: stat.icon.android, web: stat.icon.android }}
                      tintColor={theme.textSecondary}
                      size={13}
                    />
                    <ThemedText type="small">{stat.label}</ThemedText>
                  </ThemedView>
                ))}
              </View>
            </ThemedView>
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
              <View style={styles.tileGrid}>
                {amenities.map((amenity) => (
                  <ThemedView
                    key={amenity.key}
                    style={[styles.tile, { backgroundColor: theme.backgroundElement }]}>
                    <SymbolView
                      name={{ ios: amenity.icon.ios, android: amenity.icon.android, web: amenity.icon.android }}
                      tintColor={theme.textSecondary}
                      size={13}
                    />
                    <ThemedText type="small">{amenity.label}</ThemedText>
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
                  No viewing times available
                </ThemedText>
              ) : (
                <View style={styles.slotsSpacing}>
                  {bookingError ? (
                    <ThemedText style={[styles.errorText, styles.slotError]}>{bookingError}</ThemedText>
                  ) : null}
                  <DateRangeCalendar
                    month={calendarMonth}
                    minMonth={startOfMonth(new Date())}
                    onMonthChange={setCalendarMonth}
                    slots={slots}
                    rangeStart={null}
                    rangeEnd={null}
                    onSelectDate={handleSelectDay}
                  />
                  {selectedBuySlot ? (
                    <ThemedText type="small" themeColor="textSecondary" style={styles.slotsSpacing}>
                      Selected: {formatSlotLabel(selectedBuySlot)}
                    </ThemedText>
                  ) : null}
                </View>
              )}
            </ThemedView>
          ) : null}

          {listing.listing_type === 'rent' && !confirmedSlot ? (
            <ThemedView style={styles.section}>
              <ThemedText type="smallBold">Select your dates</ThemedText>

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
                  No available dates
                </ThemedText>
              ) : (
                <View style={styles.slotsSpacing}>
                  {bookingError ? (
                    <ThemedText style={[styles.errorText, styles.slotError]}>{bookingError}</ThemedText>
                  ) : null}
                  <DateRangeCalendar
                    month={calendarMonth}
                    minMonth={startOfMonth(new Date())}
                    onMonthChange={setCalendarMonth}
                    slots={slots}
                    rangeStart={rangeStart}
                    rangeEnd={rangeEnd}
                    onSelectDate={handleSelectDate}
                  />
                  {rangeStart ? (
                    <ThemedText type="small" themeColor="textSecondary" style={styles.slotsSpacing}>
                      {rangeEnd
                        ? `${rangeDateFormatter.format(rangeStart)} – ${rangeDateFormatter.format(rangeEnd)}`
                        : `${rangeDateFormatter.format(rangeStart)} — pick a checkout date`}
                    </ThemedText>
                  ) : null}

                  {rangeStart && rangeEnd ? (
                    <View style={styles.checkTimesRow}>
                      <ThemedText type="small" themeColor="textSecondary">
                        Check-in: 3:00 PM
                      </ThemedText>
                      <ThemedText type="small" themeColor="textSecondary">
                        Check-out: 11:00 AM
                      </ThemedText>
                    </View>
                  ) : null}
                </View>
              )}
            </ThemedView>
          ) : null}

          <ThemedView
            style={[styles.agentCard, { backgroundColor: theme.backgroundElement }]}>
            <View style={[styles.avatar, { backgroundColor: theme.backgroundSelected }]}>
              {listing.seller_avatar_url ? (
                <Image source={{ uri: listing.seller_avatar_url }} style={styles.avatarImage} />
              ) : listing.seller_full_name ? (
                <ThemedText type="smallBold">{getInitials(listing.seller_full_name)}</ThemedText>
              ) : (
                <SymbolView
                  name={{ ios: 'person.crop.circle', android: 'person', web: 'person' }}
                  tintColor={theme.textSecondary}
                  size={24}
                />
              )}
            </View>
            <ThemedView style={[styles.agentInfo, { backgroundColor: theme.backgroundElement }]}>
              <ThemedText type="smallBold" numberOfLines={1}>
                {listing.seller_full_name ?? 'Seller'}
              </ThemedText>
              {listing.seller_phone ? (
                <Pressable onPress={() => setIsPhoneSheetVisible(true)} hitSlop={4}>
                  <ThemedText themeColor="textSecondary" numberOfLines={1}>
                    Phone number
                  </ThemedText>
                </Pressable>
              ) : null}
            </ThemedView>
          </ThemedView>
        </ThemedView>
      </ScrollView>

      <Modal
        visible={isPhoneSheetVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setIsPhoneSheetVisible(false)}>
        <Pressable style={styles.backdrop} onPress={() => setIsPhoneSheetVisible(false)} />
        <View style={styles.sheetContainer} pointerEvents="box-none">
          <ThemedView style={[styles.sheet, { backgroundColor: theme.background, paddingBottom: insets.bottom + Spacing.four }]}>
            <View style={styles.sheetHeader}>
              <ThemedText type="smallBold">Phone number</ThemedText>
              <Pressable onPress={() => setIsPhoneSheetVisible(false)} hitSlop={8}>
                <View style={[styles.closeButton, { backgroundColor: theme.backgroundElement }]}>
                  <SymbolView
                    name={{ ios: 'xmark', android: 'close', web: 'close' }}
                    tintColor={theme.text}
                    size={16}
                  />
                </View>
              </Pressable>
            </View>
            <View style={[styles.phoneRow, { backgroundColor: theme.backgroundElement }]}>
              <ThemedText type="subtitle" style={styles.phoneText} numberOfLines={1}>
                {listing.seller_phone}
              </ThemedText>
              <Pressable onPress={handleCopyPhone} hitSlop={8}>
                <SymbolView
                  name={
                    isPhoneCopied
                      ? { ios: 'checkmark', android: 'check', web: 'check' }
                      : { ios: 'doc.on.doc', android: 'content_copy', web: 'content_copy' }
                  }
                  tintColor={theme.text}
                  size={20}
                />
              </Pressable>
            </View>
            {isPhoneCopied ? (
              <ThemedText type="small" themeColor="textSecondary">
                Copied to clipboard
              </ThemedText>
            ) : null}
          </ThemedView>
        </View>
      </Modal>

      <Modal
        visible={isDaySheetVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setIsDaySheetVisible(false)}>
        <Pressable style={styles.backdrop} onPress={() => setIsDaySheetVisible(false)} />
        <View style={styles.sheetContainer} pointerEvents="box-none">
          <ThemedView style={[styles.sheet, { backgroundColor: theme.background, paddingBottom: insets.bottom + Spacing.four }]}>
            <View style={styles.sheetHeader}>
              <ThemedText type="smallBold">
                {selectedDay ? slotDateFormatter.format(selectedDay) : 'Available times'}
              </ThemedText>
              <Pressable onPress={() => setIsDaySheetVisible(false)} hitSlop={8}>
                <View style={[styles.closeButton, { backgroundColor: theme.backgroundElement }]}>
                  <SymbolView
                    name={{ ios: 'xmark', android: 'close', web: 'close' }}
                    tintColor={theme.text}
                    size={16}
                  />
                </View>
              </Pressable>
            </View>
            <View style={styles.slotsList}>
              {(selectedDay ? getSlotsForDay(selectedDay) : []).map((slot) => {
                const selected = selectedSlotId === slot.id;
                return (
                  <Pressable
                    key={slot.id}
                    onPress={() => handleSelectSlotFromSheet(slot.id)}
                    disabled={isBooking}
                    style={[
                      styles.slotRow,
                      { backgroundColor: selected ? theme.text : theme.backgroundElement },
                    ]}>
                    <ThemedText type="small" style={{ color: selected ? theme.background : theme.text }}>
                      {slotTimeFormatter.format(new Date(slot.start_time))}–
                      {slotTimeFormatter.format(new Date(slot.end_time))}
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
          </ThemedView>
        </View>
      </Modal>

      {headerButtons}

      <ThemedView
        style={[
          styles.ctaBar,
          { paddingBottom: insets.bottom + Spacing.two, backgroundColor: theme.background },
        ]}>
        {confirmedSlot ? (
          <View style={[styles.ctaButton, styles.ctaSuccess]}>
            <SymbolView
              name={{ ios: 'checkmark.circle.fill', android: 'check_circle', web: 'check_circle' }}
              tintColor="#ffffff"
              size={18}
            />
            <ThemedText style={styles.ctaButtonText}>Booking Confirmed</ThemedText>
          </View>
        ) : (
          <Pressable
            onPress={handleConfirmBooking}
            disabled={!selectedSlotId || isBooking}
            style={({ pressed }) => [
              styles.ctaButton,
              pressed && styles.pressed,
              !selectedSlotId ? styles.ctaButtonDisabled : null,
            ]}>
            <ThemedText style={styles.ctaButtonText}>{isBooking ? 'Booking…' : ctaLabel}</ThemedText>
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
  phoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
  },
  phoneText: {
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
  retryLinkText: {
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
    height: photoHeight,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  photoList: {
    width: screenWidth,
    height: photoHeight,
  },
  photoImage: {
    width: screenWidth,
    height: photoHeight,
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
  photoDotInactive: {
    opacity: 0.4,
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
  mapCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: Spacing.three,
  },
  mapCardPressed: {
    opacity: 0.85,
  },
  mapCardIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapCardInfo: {
    flex: 1,
    gap: Spacing.half,
  },
  tileGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  tile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
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
  checkTimesRow: {
    flexDirection: 'row',
    gap: Spacing.four,
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
    overflow: 'hidden',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  agentInfo: {
    flex: 1,
    gap: Spacing.half,
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
