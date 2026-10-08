import { LinearGradient } from 'expo-linear-gradient';
import { Link, useRouter } from 'expo-router';
import { ImageBackground, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Spacing } from '@/constants/theme';

export default function WelcomeScreen() {
  const router = useRouter();

  return (
    <ImageBackground
      source={require('@/assets/images/welcome-hero.jpg')}
      style={styles.background}
      resizeMode="cover">
      <LinearGradient
        style={StyleSheet.absoluteFill}
        colors={['rgba(0,0,0,0.45)', 'rgba(0,0,0,0.1)', 'rgba(0,0,0,0.6)']}
        locations={[0, 0.4, 1]}
      />
      <SafeAreaView style={styles.safeArea} edges={['bottom']}>
        <View style={styles.content}>
          <View style={styles.textBlock}>
            <Text style={styles.headline}>Your Next Move, Simplified</Text>
            <Text style={styles.subtitle}>
              Buying, renting, and listing — all in one place, made simple.
            </Text>
          </View>

          <View style={styles.actions}>
            <Pressable
              onPress={() => router.push('/signup')}
              style={({ pressed }) => [styles.ctaButton, pressed && styles.pressed]}>
              <Text style={styles.ctaButtonText}>Get Started</Text>
            </Pressable>

            <Link href="/login" style={styles.loginLink}>
              <Text style={styles.loginLinkText}>
                Already have an account? <Text style={styles.loginLinkTextBold}>Log in</Text>
              </Text>
            </Link>
          </View>
        </View>
      </SafeAreaView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  background: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  content: {
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.four,
    gap: Spacing.five,
  },
  textBlock: {
    gap: Spacing.two,
  },
  headline: {
    color: '#ffffff',
    fontSize: 40,
    lineHeight: 46,
    fontWeight: '700',
  },
  subtitle: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '500',
  },
  actions: {
    gap: Spacing.three,
  },
  ctaButton: {
    height: 56,
    borderRadius: 999,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaButtonText: {
    color: '#000000',
    fontSize: 16,
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.85,
  },
  loginLink: {
    alignSelf: 'center',
  },
  loginLinkText: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 14,
    lineHeight: 20,
  },
  loginLinkTextBold: {
    color: '#ffffff',
    fontWeight: '700',
  },
});
