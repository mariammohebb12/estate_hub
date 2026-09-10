import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AvailabilityCalendar } from '@/components/availability-calendar';
import { isSameDay, startOfMonth } from '@/components/date-range-calendar';
import { ErrorState } from '@/components/error-state';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/providers/auth-provider';
import {
  createSlots,
  deleteSlot,
  getSlotsForListing,
  type AvailabilitySlot,
  type NewSlot,
} from '@/services/bookings';
import { getListingById, type ListingDetail } from '@/services/listings';
import { getFriendlyErrorMessage } from '@/utils/error-message';

const DURATION_OPTIONS = [15, 30, 45, 60, 90, 120];
const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

const slotDateFormatter = new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
const slotTimeFormatter = new Intl.DateTimeFormat('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
const dayFormatter = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' });
const rangeLabelFormatter = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' });

function isValidTime(value: string) {
  return TIME_PATTERN.test(value.trim());
}

function combineDateAndTime(date: Date, hhmm: string) {
  const [hours, minutes] = hhmm.split(':').map(Number);
  const result = new Date(date);
  result.setHours(hours, minutes, 0, 0);
  return result;
}

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

  const [calendarMonth, setCalendarMonth] = useState(() => startOfMonth(new Date()));

  // Buy-mode: single date + start/end time + slot duration.
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [startTime, setStartTime] = useState('10:00');
  const [endTime, setEndTime] = useState('13:00');
  const [durationMinutes, setDurationMinutes] = useState(30);

  // Rent-mode: date range + check-in/check-out time.
  const [rangeStart, setRangeStart] = useState<Date | null>(null);
  const [rangeEnd, setRangeEnd] = useState<Date | null>(null);
  const [checkInTime, setCheckInTime] = useState('15:00');
  const [checkOutTime, setCheckOutTime] = useState('11:00');

  const [generationError, setGenerationError] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

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

  const handleSelectSingleDate = (date: Date) => {
    setGenerationError(null);
    setSelectedDate((prev) => (prev && isSameDay(prev, date) ? null : date));
  };

  const handleSelectRangeDate = (date: Date) => {
    setGenerationError(null);
    if (!rangeStart || rangeEnd) {
      setRangeStart(date);
      setRangeEnd(null);
      return;
    }
    if (isSameDay(date, rangeStart)) {
      setRangeStart(null);
      setRangeEnd(null);
      return;
    }
    const [newStart, newEnd] = date.getTime() < rangeStart.getTime() ? [date, rangeStart] : [rangeStart, date];
    setRangeStart(newStart);
    setRangeEnd(newEnd);
  };

  const handleGenerateBuySlots = async () => {
    if (!id) return;
    setGenerationError(null);

    if (!selectedDate) {
      setGenerationError('Pick a date.');
      return;
    }
    if (!isValidTime(startTime) || !isValidTime(endTime)) {
      setGenerationError('Enter times as HH:MM, e.g. 10:00.');
      return;
    }

    const start = combineDateAndTime(selectedDate, startTime);
    const end = combineDateAndTime(selectedDate, endTime);

    if (end.getTime() <= start.getTime()) {
      setGenerationError('End time must be after start time.');
      return;
    }

    const durationMs = durationMinutes * 60_000;
    const newSlots: NewSlot[] = [];
    let cursor = start.getTime();
    while (cursor + durationMs <= end.getTime()) {
      newSlots.push({
        start_time: new Date(cursor).toISOString(),
        end_time: new Date(cursor + durationMs).toISOString(),
      });
      cursor += durationMs;
    }

    if (newSlots.length === 0) {
      setGenerationError('That range is too short for one slot at this duration.');
      return;
    }

    console.log('handleGenerateBuySlots: about to insert into availability_slots', {
      listingId: id,
      listingSellerId: listing?.seller_id,
      currentUserId: userId,
    });

    setIsGenerating(true);
    const { error } = await createSlots(id, newSlots);
    setIsGenerating(false);

    if (error) {
      console.error('handleGenerateBuySlots: failed to create availability slots', error, {
        listingId: id,
        listingSellerId: listing?.seller_id,
        currentUserId: userId,
      });
      setGenerationError(getFriendlyErrorMessage(error));
      return;
    }

    setSelectedDate(null);
    await loadSlots();
  };

  const handleGenerateRentSlot = async () => {
    if (!id) return;
    setGenerationError(null);

    if (!rangeStart || !rangeEnd) {
      setGenerationError('Pick a start and end date.');
      return;
    }
    if (!isValidTime(checkInTime) || !isValidTime(checkOutTime)) {
      setGenerationError('Enter times as HH:MM, e.g. 15:00.');
      return;
    }

    const start = combineDateAndTime(rangeStart, checkInTime);
    const end = combineDateAndTime(rangeEnd, checkOutTime);

    if (end.getTime() <= start.getTime()) {
      setGenerationError('Checkout must be after check-in.');
      return;
    }

    console.log('handleGenerateRentSlot: about to insert into availability_slots', {
      listingId: id,
      listingSellerId: listing?.seller_id,
      currentUserId: userId,
    });

    setIsGenerating(true);
    const { error } = await createSlots(id, [{ start_time: start.toISOString(), end_time: end.toISOString() }]);
    setIsGenerating(false);

    if (error) {
      console.error('handleGenerateRentSlot: failed to create availability slot', error, {
        listingId: id,
        listingSellerId: listing?.seller_id,
        currentUserId: userId,
      });
      setGenerationError(getFriendlyErrorMessage(error));
      return;
    }

    setRangeStart(null);
    setRangeEnd(null);
    await loadSlots();
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

                  <AvailabilityCalendar
                    month={calendarMonth}
                    onMonthChange={setCalendarMonth}
                    selectedDate={selectedDate}
                    onSelectDate={handleSelectSingleDate}
                  />

                  <View style={styles.row}>
                    <Field label="Start time" style={styles.flex1}>
                      <TextInput
                        value={startTime}
                        onChangeText={setStartTime}
                        placeholder="10:00"
                        placeholderTextColor={theme.textSecondary}
                        style={[styles.input, { color: theme.text, borderColor: theme.backgroundSelected }]}
                      />
                    </Field>
                    <Field label="End time" style={styles.flex1}>
                      <TextInput
                        value={endTime}
                        onChangeText={setEndTime}
                        placeholder="13:00"
                        placeholderTextColor={theme.textSecondary}
                        style={[styles.input, { color: theme.text, borderColor: theme.backgroundSelected }]}
                      />
                    </Field>
                  </View>

                  <Field label="Slot duration">
                    <View style={styles.pillRow}>
                      {DURATION_OPTIONS.map((minutes) => {
                        const selected = durationMinutes === minutes;
                        return (
                          <Pressable
                            key={minutes}
                            onPress={() => setDurationMinutes(minutes)}
                            style={[
                              styles.pill,
                              { backgroundColor: selected ? theme.text : theme.background },
                            ]}>
                            <ThemedText type="small" style={{ color: selected ? theme.background : theme.text }}>
                              {minutes} min
                            </ThemedText>
                          </Pressable>
                        );
                      })}
                    </View>
                  </Field>

                  {generationError ? <ThemedText style={styles.errorText}>{generationError}</ThemedText> : null}

                  <Pressable
                    onPress={handleGenerateBuySlots}
                    disabled={isGenerating}
                    style={({ pressed }) => [
                      styles.primaryButton,
                      pressed && styles.pressed,
                      isGenerating && styles.disabled,
                    ]}>
                    {isGenerating ? (
                      <ActivityIndicator color="#ffffff" />
                    ) : (
                      <ThemedText style={styles.primaryButtonText}>Generate Slots</ThemedText>
                    )}
                  </Pressable>
                </ThemedView>
              ) : (
                <ThemedView style={[styles.card, { backgroundColor: theme.backgroundElement }]}>
                  <ThemedText type="smallBold">Add a rental period</ThemedText>

                  <AvailabilityCalendar
                    month={calendarMonth}
                    onMonthChange={setCalendarMonth}
                    rangeStart={rangeStart}
                    rangeEnd={rangeEnd}
                    onSelectDate={handleSelectRangeDate}
                  />

                  {rangeStart ? (
                    <ThemedText type="small" themeColor="textSecondary">
                      {rangeEnd
                        ? `${rangeLabelFormatter.format(rangeStart)} – ${rangeLabelFormatter.format(rangeEnd)}`
                        : `${rangeLabelFormatter.format(rangeStart)} — pick an end date`}
                    </ThemedText>
                  ) : null}

                  <View style={styles.row}>
                    <Field label="Check-in time" style={styles.flex1}>
                      <TextInput
                        value={checkInTime}
                        onChangeText={setCheckInTime}
                        placeholder="15:00"
                        placeholderTextColor={theme.textSecondary}
                        style={[styles.input, { color: theme.text, borderColor: theme.backgroundSelected }]}
                      />
                    </Field>
                    <Field label="Check-out time" style={styles.flex1}>
                      <TextInput
                        value={checkOutTime}
                        onChangeText={setCheckOutTime}
                        placeholder="11:00"
                        placeholderTextColor={theme.textSecondary}
                        style={[styles.input, { color: theme.text, borderColor: theme.backgroundSelected }]}
                      />
                    </Field>
                  </View>

                  {generationError ? <ThemedText style={styles.errorText}>{generationError}</ThemedText> : null}

                  <Pressable
                    onPress={handleGenerateRentSlot}
                    disabled={isGenerating}
                    style={({ pressed }) => [
                      styles.primaryButton,
                      pressed && styles.pressed,
                      isGenerating && styles.disabled,
                    ]}>
                    {isGenerating ? (
                      <ActivityIndicator color="#ffffff" />
                    ) : (
                      <ThemedText style={styles.primaryButtonText}>Add Rental Period</ThemedText>
                    )}
                  </Pressable>
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

function Field({
  label,
  children,
  style,
}: {
  label: string;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[styles.field, style]}>
      <ThemedText type="small" themeColor="textSecondary">
        {label}
      </ThemedText>
      {children}
    </View>
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
  row: {
    flexDirection: 'row',
    gap: Spacing.three,
  },
  flex1: {
    flex: 1,
  },
  field: {
    gap: Spacing.two,
  },
  input: {
    height: 46,
    borderRadius: Spacing.three,
    borderWidth: 1,
    paddingHorizontal: Spacing.three,
    fontSize: 15,
  },
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  pill: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Spacing.five,
  },
  primaryButton: {
    height: 52,
    borderRadius: Spacing.three,
    backgroundColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    color: '#ffffff',
    fontWeight: '600',
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
