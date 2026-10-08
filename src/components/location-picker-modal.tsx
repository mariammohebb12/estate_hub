import * as Location from 'expo-location';
import { SymbolView } from 'expo-symbols';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
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
const SEARCH_BAR_HEIGHT = 48;
const SUGGESTIONS_DEBOUNCE_MS = 400;
const MIN_SUGGESTIONS_QUERY_LENGTH = 3;

type LatLng = { latitude: number; longitude: number };

type PlaceSuggestion = { id: string; label: string; coordinate: LatLng };

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

async function searchPlaces(query: string, limit: number): Promise<{ results: PlaceSuggestion[]; error: string | null }> {
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&q=${encodeURIComponent(query)}&limit=${limit}`;
    const response = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!response.ok) {
      return { results: [], error: "Couldn't search for that place." };
    }
    const data = await response.json();
    if (!Array.isArray(data)) {
      return { results: [], error: null };
    }
    const results: PlaceSuggestion[] = data
      .map((item): PlaceSuggestion | null => {
        const latitude = Number.parseFloat(item?.lat);
        const longitude = Number.parseFloat(item?.lon);
        const label = typeof item?.display_name === 'string' ? item.display_name : null;
        if (!label || Number.isNaN(latitude) || Number.isNaN(longitude)) return null;
        const id = item?.place_id != null ? String(item.place_id) : `${latitude},${longitude}`;
        return { id, label, coordinate: { latitude, longitude } };
      })
      .filter((item): item is PlaceSuggestion => item !== null);
    return { results, error: null };
  } catch (error) {
    console.error('searchPlaces: request failed', error);
    return { results: [], error: getFriendlyErrorMessage(error) };
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
  const suggestionsRequestIdRef = useRef(0);
  const justSelectedRef = useRef(false);

  const [marker, setMarker] = useState<LatLng | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [resolvedAddress, setResolvedAddress] = useState<string | null>(null);
  const [isResolvingAddress, setIsResolvingAddress] = useState(false);
  const [addressError, setAddressError] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [isSuggestionsLoading, setIsSuggestionsLoading] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  useEffect(() => {
    if (!visible) return;

    setPermissionDenied(false);
    setAddressError(null);
    setSearchQuery('');
    setSearchError(null);
    setSuggestions([]);
    setIsSuggestionsLoading(false);
    setIsDropdownOpen(false);

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

  useEffect(() => {
    const query = searchQuery.trim();

    if (justSelectedRef.current) {
      justSelectedRef.current = false;
      return;
    }

    if (query.length < MIN_SUGGESTIONS_QUERY_LENGTH) {
      setSuggestions([]);
      setIsSuggestionsLoading(false);
      return;
    }

    setIsSuggestionsLoading(true);
    const timeoutId = setTimeout(async () => {
      const requestId = ++suggestionsRequestIdRef.current;
      const { results, error } = await searchPlaces(query, 5);
      if (suggestionsRequestIdRef.current !== requestId) return;
      setIsSuggestionsLoading(false);
      setSuggestions(error ? [] : results);
    }, SUGGESTIONS_DEBOUNCE_MS);

    return () => clearTimeout(timeoutId);
  }, [searchQuery]);

  const applySelection = (coordinate: LatLng, label: string) => {
    justSelectedRef.current = true;
    setIsDropdownOpen(false);
    setSuggestions([]);
    setSearchQuery(label);

    mapRef.current?.animateToRegion(
      {
        latitude: coordinate.latitude,
        longitude: coordinate.longitude,
        latitudeDelta: PIN_REGION_DELTA,
        longitudeDelta: PIN_REGION_DELTA,
      },
      300,
    );
    setMarkerAndResolve(coordinate);
  };

  const handleChangeSearchQuery = (text: string) => {
    setSearchQuery(text);
    setSearchError(null);
    setIsDropdownOpen(true);
  };

  const handleSelectSuggestion = (suggestion: PlaceSuggestion) => {
    setSearchError(null);
    applySelection(suggestion.coordinate, suggestion.label);
  };

  const handleSearch = async () => {
    const query = searchQuery.trim();
    if (!query) return;

    setIsDropdownOpen(false);
    setIsSearching(true);
    setSearchError(null);

    const { results, error } = await searchPlaces(query, 1);
    setIsSearching(false);

    const top = results[0];
    if (error || !top) {
      setSearchError(error ?? 'No matching location found. Try a different search.');
      return;
    }

    applySelection(top.coordinate, top.label);
  };

  const handleClearSearch = () => {
    setSearchQuery('');
    setSearchError(null);
    setSuggestions([]);
    setIsDropdownOpen(false);
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

            <View style={styles.searchOverlay}>
              <View style={[styles.searchBar, { backgroundColor: theme.background }]}>
                <SymbolView
                  name={{ ios: 'magnifyingglass', android: 'search', web: 'search' }}
                  tintColor={theme.textSecondary}
                  size={18}
                />
                <TextInput
                  placeholder="Search for a place or address"
                  placeholderTextColor={theme.textSecondary}
                  value={searchQuery}
                  onChangeText={handleChangeSearchQuery}
                  onSubmitEditing={handleSearch}
                  returnKeyType="search"
                  editable={!isSearching}
                  style={[styles.searchInput, { color: theme.text }]}
                />
                {isSearching || isSuggestionsLoading ? (
                  <ActivityIndicator size="small" color={theme.textSecondary} />
                ) : searchQuery ? (
                  <Pressable onPress={handleClearSearch} hitSlop={8}>
                    <SymbolView
                      name={{ ios: 'xmark.circle.fill', android: 'close', web: 'close' }}
                      tintColor={theme.textSecondary}
                      size={18}
                    />
                  </Pressable>
                ) : null}
              </View>

              {isDropdownOpen && searchQuery.trim().length >= MIN_SUGGESTIONS_QUERY_LENGTH ? (
                <View style={[styles.suggestionsCard, { backgroundColor: theme.background }]}>
                  {isSuggestionsLoading ? (
                    <View style={styles.suggestionsStatusRow}>
                      <ActivityIndicator size="small" color={theme.textSecondary} />
                      <ThemedText type="small" themeColor="textSecondary">
                        Searching…
                      </ThemedText>
                    </View>
                  ) : suggestions.length > 0 ? (
                    <ScrollView
                      keyboardShouldPersistTaps="always"
                      style={styles.suggestionsList}
                      nestedScrollEnabled>
                      {suggestions.map((suggestion, index) => (
                        <Pressable
                          key={suggestion.id}
                          onPress={() => handleSelectSuggestion(suggestion)}
                          style={[
                            styles.suggestionRow,
                            index !== suggestions.length - 1 && {
                              borderBottomWidth: StyleSheet.hairlineWidth,
                              borderBottomColor: theme.backgroundElement,
                            },
                          ]}>
                          <SymbolView
                            name={{ ios: 'mappin.and.ellipse', android: 'location_on', web: 'location_on' }}
                            tintColor={theme.textSecondary}
                            size={16}
                          />
                          <ThemedText type="small" style={styles.suggestionLabel} numberOfLines={2}>
                            {suggestion.label}
                          </ThemedText>
                        </Pressable>
                      ))}
                    </ScrollView>
                  ) : (
                    <View style={styles.suggestionsStatusRow}>
                      <ThemedText type="small" themeColor="textSecondary">
                        No matching places found.
                      </ThemedText>
                    </View>
                  )}
                </View>
              ) : null}

              {searchError ? (
                <View style={[styles.searchErrorBar, { backgroundColor: theme.background }]}>
                  <ThemedText type="small" style={styles.searchErrorText}>
                    {searchError}
                  </ThemedText>
                </View>
              ) : null}
            </View>

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
  searchOverlay: {
    position: 'absolute',
    top: Spacing.three,
    left: Spacing.three,
    right: Spacing.three,
    gap: Spacing.two,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    height: SEARCH_BAR_HEIGHT,
    borderRadius: Spacing.five,
    paddingHorizontal: Spacing.three,
    shadowColor: '#000000',
    shadowOpacity: 0.15,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    height: '100%',
  },
  suggestionsCard: {
    borderRadius: Spacing.three,
    overflow: 'hidden',
    maxHeight: 260,
    shadowColor: '#000000',
    shadowOpacity: 0.15,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  suggestionsList: {
    flexGrow: 0,
  },
  suggestionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
  },
  suggestionLabel: {
    flex: 1,
  },
  suggestionsStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
  },
  searchErrorBar: {
    borderRadius: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    shadowColor: '#000000',
    shadowOpacity: 0.1,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  searchErrorText: {
    color: '#D92D20',
  },
  recenterButton: {
    position: 'absolute',
    top: Spacing.three + SEARCH_BAR_HEIGHT + Spacing.two,
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
