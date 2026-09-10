import * as Location from 'expo-location';
import { SymbolView } from 'expo-symbols';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, View } from 'react-native';
import MapView, { Marker, type MapPressEvent, type MarkerDragStartEndEvent, type Region } from 'react-native-maps';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { getFriendlyErrorMessage } from '@/utils/error-message';

const DEFAULT_REGION: Region = {
  latitude: 30.0444,
  longitude: 31.2357,
  latitudeDelta: 0.05,
  longitudeDelta: 0.05,
};

const PIN_REGION_DELTA = 0.01;

type LatLng = { latitude: number; longitude: number };

export type LocationPickerResult = { address: string; latitude: number; longitude: number };

type LocationPickerModalProps = {
  visible: boolean;
  onClose: () => void;
  onConfirm: (result: LocationPickerResult) => void;
  initialLatitude?: number | null;
  initialLongitude?: number | null;
  initialAddress?: string | null;
};

async function reverseGeocode(latitude: number, longitude: number): Promise<{ address: string | null; error: string | null }> {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=0`;
    const response = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!response.ok) {
      return { address: null, error: "Couldn't look up an address for this spot." };
    }
    const data = await response.json();
    const address = typeof data?.display_name === 'string' ? data.display_name : null;
    if (!address) {
      return { address: null, error: "Couldn't look up an address for this spot." };
    }
    return { address, error: null };
  } catch (error) {
    console.error('reverseGeocode: request failed', error);
    return { address: null, error: getFriendlyErrorMessage(error) };
  }
}

export function LocationPickerModal({
  visible,
  onClose,
  onConfirm,
  initialLatitude,
  initialLongitude,
  initialAddress,
}: LocationPickerModalProps) {
  const theme = useTheme();
  const mapRef = useRef<MapView>(null);
  const requestIdRef = useRef(0);

  const [marker, setMarker] = useState<LatLng | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [resolvedAddress, setResolvedAddress] = useState<string | null>(null);
  const [isResolvingAddress, setIsResolvingAddress] = useState(false);
  const [addressError, setAddressError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;

    setPermissionDenied(false);
    setAddressError(null);

    if (initialLatitude != null && initialLongitude != null) {
      setMarker({ latitude: initialLatitude, longitude: initialLongitude });
      setResolvedAddress(initialAddress ?? null);
      setIsResolvingAddress(false);
      return;
    }

    setMarker(null);
    setResolvedAddress(null);
    locateDevice();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const locateDevice = async () => {
    setIsLocating(true);
    setPermissionDenied(false);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setPermissionDenied(true);
        mapRef.current?.animateToRegion(DEFAULT_REGION, 300);
        return;
      }
      const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      mapRef.current?.animateToRegion(
        {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          latitudeDelta: PIN_REGION_DELTA,
          longitudeDelta: PIN_REGION_DELTA,
        },
        300,
      );
    } catch (error) {
      console.error('locateDevice: failed to get current position', error);
      mapRef.current?.animateToRegion(DEFAULT_REGION, 300);
    } finally {
      setIsLocating(false);
    }
  };

  const setMarkerAndResolve = async (coordinate: LatLng) => {
    setMarker(coordinate);
    setResolvedAddress(null);
    setAddressError(null);
    setIsResolvingAddress(true);

    const requestId = ++requestIdRef.current;
    const { address, error } = await reverseGeocode(coordinate.latitude, coordinate.longitude);
    if (requestIdRef.current !== requestId) return;

    setIsResolvingAddress(false);
    if (error) {
      setAddressError(error);
      return;
    }
    setResolvedAddress(address);
  };

  const handleMapPress = (event: MapPressEvent) => {
    setMarkerAndResolve(event.nativeEvent.coordinate);
  };

  const handleMarkerDragEnd = (event: MarkerDragStartEndEvent) => {
    setMarkerAndResolve(event.nativeEvent.coordinate);
  };

  const handleConfirm = () => {
    if (!marker) return;
    const address = resolvedAddress ?? `${marker.latitude.toFixed(5)}, ${marker.longitude.toFixed(5)}`;
    onConfirm({ address, latitude: marker.latitude, longitude: marker.longitude });
  };

  const initialRegion: Region =
    initialLatitude != null && initialLongitude != null
      ? {
          latitude: initialLatitude,
          longitude: initialLongitude,
          latitudeDelta: PIN_REGION_DELTA,
          longitudeDelta: PIN_REGION_DELTA,
        }
      : DEFAULT_REGION;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} presentationStyle="fullScreen">
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.header}>
            <ThemedText type="smallBold">Pick Location</ThemedText>
            <Pressable onPress={onClose} hitSlop={8}>
              <View style={[styles.closeButton, { backgroundColor: theme.backgroundElement }]}>
                <SymbolView name={{ ios: 'xmark', android: 'close', web: 'close' }} tintColor={theme.text} size={16} />
              </View>
            </Pressable>
          </View>

          {permissionDenied ? (
            <View style={[styles.noticeBar, { backgroundColor: theme.backgroundElement }]}>
              <ThemedText type="small" themeColor="textSecondary">
                Location permission denied — showing Cairo, Egypt by default. You can still tap the map to drop a pin.
              </ThemedText>
            </View>
          ) : null}

          <View style={styles.mapWrap}>
            <MapView ref={mapRef} style={styles.map} initialRegion={initialRegion} onPress={handleMapPress}>
              {marker ? <Marker coordinate={marker} draggable onDragEnd={handleMarkerDragEnd} /> : null}
            </MapView>

            {isLocating ? (
              <View style={[styles.recenterButton, { backgroundColor: theme.background }]}>
                <ActivityIndicator size="small" color={theme.text} />
              </View>
            ) : (
              <Pressable
                onPress={locateDevice}
                hitSlop={8}
                style={[styles.recenterButton, { backgroundColor: theme.background }]}>
                <SymbolView
                  name={{ ios: 'location.fill', android: 'my_location', web: 'my_location' }}
                  tintColor={theme.text}
                  size={18}
                />
              </Pressable>
            )}
          </View>

          <View style={[styles.footer, { backgroundColor: theme.background, borderTopColor: theme.backgroundElement }]}>
            <View style={styles.addressPreview}>
              {!marker ? (
                <ThemedText type="small" themeColor="textSecondary">
                  Tap anywhere on the map to drop a pin.
                </ThemedText>
              ) : isResolvingAddress ? (
                <View style={styles.addressRow}>
                  <ActivityIndicator size="small" color={theme.textSecondary} />
                  <ThemedText type="small" themeColor="textSecondary">
                    Looking up address…
                  </ThemedText>
                </View>
              ) : addressError ? (
                <ThemedText type="small" themeColor="textSecondary">
                  {addressError} You can still save this pin using its coordinates.
                </ThemedText>
              ) : resolvedAddress ? (
                <ThemedText type="small" numberOfLines={2}>
                  {resolvedAddress}
                </ThemedText>
              ) : null}
            </View>

            <Pressable
              onPress={handleConfirm}
              disabled={!marker || isResolvingAddress}
              style={[styles.confirmButton, (!marker || isResolvingAddress) && styles.disabled]}>
              <ThemedText style={styles.confirmButtonText}>Use This Location</ThemedText>
            </Pressable>
          </View>
        </SafeAreaView>
      </ThemedView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.three,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noticeBar: {
    marginHorizontal: Spacing.four,
    marginBottom: Spacing.three,
    padding: Spacing.three,
    borderRadius: Spacing.three,
  },
  mapWrap: {
    flex: 1,
  },
  map: {
    flex: 1,
  },
  recenterButton: {
    position: 'absolute',
    top: Spacing.three,
    right: Spacing.three,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOpacity: 0.15,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  footer: {
    borderTopWidth: StyleSheet.hairlineWidth,
    padding: Spacing.four,
    gap: Spacing.three,
  },
  addressPreview: {
    minHeight: 20,
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  confirmButton: {
    height: 52,
    borderRadius: Spacing.three,
    backgroundColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmButtonText: {
    color: '#ffffff',
    fontWeight: '600',
  },
  disabled: {
    opacity: 0.5,
  },
});
