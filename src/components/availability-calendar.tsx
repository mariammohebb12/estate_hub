import { SymbolView } from 'expo-symbols';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { addMonths, isSameDay, startOfDay, startOfMonth } from '@/components/date-range-calendar';

const WEEKDAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

const monthFormatter = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' });

function getMonthGrid(month: Date): (Date | null)[] {
  const firstOfMonth = startOfMonth(month);
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const leadingBlanks = firstOfMonth.getDay();

  const cells: (Date | null)[] = [];
  for (let i = 0; i < leadingBlanks; i += 1) {
    cells.push(null);
  }
  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push(new Date(month.getFullYear(), month.getMonth(), day));
  }
  while (cells.length % 7 !== 0) {
    cells.push(null);
  }
  return cells;
}

type AvailabilityCalendarProps = {
  month: Date;
  onMonthChange: (next: Date) => void;
  selectedDate?: Date | null;
  rangeStart?: Date | null;
  rangeEnd?: Date | null;
  onSelectDate: (date: Date) => void;
};

export function AvailabilityCalendar({
  month,
  onMonthChange,
  selectedDate,
  rangeStart,
  rangeEnd,
  onSelectDate,
}: AvailabilityCalendarProps) {
  const theme = useTheme();
  const today = startOfDay(new Date());
  const cells = getMonthGrid(month);
  const minMonth = startOfMonth(new Date());
  const canGoPrev = month.getTime() > minMonth.getTime();

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable
          onPress={() => canGoPrev && onMonthChange(addMonths(month, -1))}
          disabled={!canGoPrev}
          hitSlop={8}
          style={styles.navButton}>
          <SymbolView
            name={{ ios: 'chevron.left', android: 'chevron_left', web: 'chevron_left' }}
            tintColor={canGoPrev ? theme.text : theme.textSecondary}
            size={18}
          />
        </Pressable>
        <ThemedText type="smallBold">{monthFormatter.format(month)}</ThemedText>
        <Pressable onPress={() => onMonthChange(addMonths(month, 1))} hitSlop={8} style={styles.navButton}>
          <SymbolView
            name={{ ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' }}
            tintColor={theme.text}
            size={18}
          />
        </Pressable>
      </View>

      <View style={styles.weekdayRow}>
        {WEEKDAY_LABELS.map((label, index) => (
          <View key={`${label}-${index}`} style={styles.weekdayCell}>
            <ThemedText type="small" themeColor="textSecondary">
              {label}
            </ThemedText>
          </View>
        ))}
      </View>

      <View style={styles.grid}>
        {cells.map((date, index) => {
          if (!date) {
            return <View key={`blank-${index}`} style={styles.cell} />;
          }

          const isPast = date.getTime() < today.getTime();

          const isSelected = selectedDate ? isSameDay(date, selectedDate) : false;
          const isStart = rangeStart ? isSameDay(date, rangeStart) : false;
          const isEnd = rangeEnd ? isSameDay(date, rangeEnd) : false;
          const isInRange = Boolean(
            rangeStart &&
              rangeEnd &&
              date.getTime() > rangeStart.getTime() &&
              date.getTime() < rangeEnd.getTime(),
          );

          let backgroundColor: string = 'transparent';
          let textColor: string = isPast ? theme.textSecondary : theme.text;

          if (isSelected || isStart || isEnd) {
            backgroundColor = theme.text;
            textColor = theme.background;
          } else if (isInRange) {
            backgroundColor = theme.backgroundSelected;
            textColor = theme.text;
          }

          return (
            <View key={date.toISOString()} style={styles.cell}>
              <Pressable
                onPress={() => onSelectDate(date)}
                disabled={isPast}
                style={[styles.day, { backgroundColor }]}>
                <ThemedText type={isSelected || isStart || isEnd ? 'smallBold' : 'small'} style={{ color: textColor }}>
                  {date.getDate()}
                </ThemedText>
              </Pressable>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.two,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  navButton: {
    padding: Spacing.two,
  },
  weekdayRow: {
    flexDirection: 'row',
  },
  weekdayCell: {
    width: `${100 / 7}%`,
    alignItems: 'center',
    paddingVertical: Spacing.one,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  cell: {
    width: `${100 / 7}%`,
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  day: {
    width: '78%',
    height: '78%',
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
