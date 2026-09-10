import { useState, type ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, TextInput, View, type StyleProp, type ViewStyle } from 'react-native';

import { AvailabilityCalendar } from '@/components/availability-calendar';
import { isSameDay, startOfMonth } from '@/components/date-range-calendar';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { NewSlot } from '@/services/bookings';

const DURATION_OPTIONS = [15, 30, 45, 60, 90, 120];
const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;
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

export type AvailabilitySlotFormProps = {
  listingType: 'buy' | 'rent';
  // Lets the caller decide what "submit" means: create the slots immediately
  // against a real listing_id (edit flow), or just stage them locally until
  // the parent record is created (new-listing flow). Either way this form
  // stays a pure calendar/time picker with no opinion on persistence.
  onSubmitSlots: (slots: NewSlot[]) => Promise<{ error: string | null }>;
};

export function AvailabilitySlotForm({ listingType, onSubmitSlots }: AvailabilitySlotFormProps) {
  const theme = useTheme();

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

    setIsGenerating(true);
    const { error } = await onSubmitSlots(newSlots);
    setIsGenerating(false);

    if (error) {
      setGenerationError(error);
      return;
    }

    setSelectedDate(null);
  };

  const handleGenerateRentSlot = async () => {
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

    setIsGenerating(true);
    const { error } = await onSubmitSlots([{ start_time: start.toISOString(), end_time: end.toISOString() }]);
    setIsGenerating(false);

    if (error) {
      setGenerationError(error);
      return;
    }

    setRangeStart(null);
    setRangeEnd(null);
  };

  if (listingType === 'buy') {
    return (
      <View style={styles.form}>
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
                  style={[styles.pill, { backgroundColor: selected ? theme.text : theme.background }]}>
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
          style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed, isGenerating && styles.disabled]}>
          {isGenerating ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <ThemedText style={styles.primaryButtonText}>Generate Slots</ThemedText>
          )}
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.form}>
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
        style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed, isGenerating && styles.disabled]}>
        {isGenerating ? (
          <ActivityIndicator color="#ffffff" />
        ) : (
          <ThemedText style={styles.primaryButtonText}>Add Rental Period</ThemedText>
        )}
      </Pressable>
    </View>
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
  form: {
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
  errorText: {
    color: '#D92D20',
  },
  pressed: {
    opacity: 0.85,
  },
  disabled: {
    opacity: 0.7,
  },
});
