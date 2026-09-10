import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';

type ErrorStateProps = {
  message: string;
  onRetry: () => void;
  isRetrying?: boolean;
};

export function ErrorState({ message, onRetry, isRetrying }: ErrorStateProps) {
  return (
    <View style={styles.container}>
      <ThemedText style={styles.errorText}>{message}</ThemedText>
      <Pressable
        onPress={onRetry}
        disabled={isRetrying}
        style={({ pressed }) => [styles.retryButton, pressed && styles.pressed, isRetrying && styles.disabled]}>
        {isRetrying ? (
          <ActivityIndicator size="small" color="#ffffff" />
        ) : (
          <ThemedText style={styles.retryButtonText}>Try Again</ThemedText>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    gap: Spacing.three,
  },
  errorText: {
    color: '#D92D20',
    textAlign: 'center',
  },
  retryButton: {
    paddingHorizontal: Spacing.four,
    height: 44,
    minWidth: 120,
    borderRadius: Spacing.three,
    backgroundColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  retryButtonText: {
    color: '#ffffff',
    fontWeight: '600',
  },
  pressed: {
    opacity: 0.85,
  },
  disabled: {
    opacity: 0.7,
  },
});
