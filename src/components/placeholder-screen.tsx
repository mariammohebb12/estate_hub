import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';

type PlaceholderScreenProps = {
  title: string;
  subtitle?: string;
};

export function PlaceholderScreen({ title, subtitle }: PlaceholderScreenProps) {
  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ThemedText type="title" style={styles.title}>
          {title}
        </ThemedText>
        {subtitle ? (
          <ThemedText themeColor="textSecondary" style={styles.subtitle}>
            {subtitle}
          </ThemedText>
        ) : null}
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
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.four,
  },
  title: {
    textAlign: 'center',
  },
  subtitle: {
    textAlign: 'center',
  },
});
