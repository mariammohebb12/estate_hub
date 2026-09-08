import { useLocalSearchParams, useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useEffect, useState, type ReactNode } from 'react';
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

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/providers/auth-provider';
import {
  createListing,
  deleteListing,
  getListingById,
  PROPERTY_TYPES,
  updateListing,
  type ListingFormValues,
  type PropertyType,
} from '@/services/listings';

const LISTING_TYPES = ['buy', 'rent'] as const;

function parseTagInput(value: string) {
  return value
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function parseNumberInput(value: string) {
  if (!value.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export default function ListingFormScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const isEditing = Boolean(id);
  const router = useRouter();
  const theme = useTheme();
  const { session } = useAuth();
  const userId = session?.user.id;

  const [isLoading, setIsLoading] = useState(isEditing);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [listingType, setListingType] = useState<'buy' | 'rent'>('buy');
  const [price, setPrice] = useState('');
  const [bedrooms, setBedrooms] = useState('');
  const [bathrooms, setBathrooms] = useState('');
  const [propertyType, setPropertyType] = useState<PropertyType | null>(null);
  const [locationText, setLocationText] = useState('');
  const [areaSqm, setAreaSqm] = useState('');
  const [amenities, setAmenities] = useState('');
  const [styleTags, setStyleTags] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setIsLoading(true);
    getListingById(id).then(({ data, error }) => {
      if (cancelled) return;
      if (error || !data) {
        setLoadError(error?.message ?? 'Listing not found.');
        setIsLoading(false);
        return;
      }
      setTitle(data.title);
      setDescription(data.description ?? '');
      setListingType(data.listing_type);
      setPrice(String(data.price));
      setBedrooms(data.bedrooms != null ? String(data.bedrooms) : '');
      setBathrooms(data.bathrooms != null ? String(data.bathrooms) : '');
      setPropertyType((data.property_type as PropertyType | null) ?? null);
      setLocationText(data.location_text ?? '');
      setAreaSqm(data.area_sqm != null ? String(data.area_sqm) : '');
      setAmenities((data.amenities ?? []).join(', '));
      setStyleTags((data.style_tags ?? []).join(', '));
      setIsLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [id]);

  const handleSubmit = async () => {
    if (!userId) return;
    setFormError(null);

    const trimmedTitle = title.trim();
    const parsedPrice = parseNumberInput(price);

    if (!trimmedTitle) {
      setFormError('Title is required.');
      return;
    }
    if (parsedPrice == null || parsedPrice < 0) {
      setFormError('Enter a valid price.');
      return;
    }

    const values: ListingFormValues = {
      title: trimmedTitle,
      description: description.trim(),
      listing_type: listingType,
      price: parsedPrice,
      bedrooms: bedrooms.trim() ? parseNumberInput(bedrooms) : null,
      bathrooms: bathrooms.trim() ? parseNumberInput(bathrooms) : null,
      property_type: propertyType,
      location_text: locationText.trim(),
      area_sqm: areaSqm.trim() ? parseNumberInput(areaSqm) : null,
      amenities: parseTagInput(amenities),
      style_tags: parseTagInput(styleTags),
    };

    setIsSubmitting(true);
    const { error } = isEditing ? await updateListing(id!, values) : await createListing(userId, values);
    setIsSubmitting(false);

    if (error) {
      setFormError(error.message);
      return;
    }

    router.back();
  };

  const handleDelete = () => {
    if (!id) return;
    Alert.alert('Delete listing?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setIsDeleting(true);
          const { error } = await deleteListing(id);
          setIsDeleting(false);
          if (error) {
            setFormError(error.message);
            return;
          }
          router.back();
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
          <ThemedText type="smallBold">{isEditing ? 'Edit Listing' : 'New Listing'}</ThemedText>
          <View style={{ width: 22 }} />
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          {loadError ? (
            <ThemedText style={styles.errorText}>{loadError}</ThemedText>
          ) : (
            <>
              <Field label="Title">
                <TextInput
                  value={title}
                  onChangeText={setTitle}
                  placeholder="Modern 2 bedroom villa"
                  placeholderTextColor={theme.textSecondary}
                  style={[styles.input, { color: theme.text, borderColor: theme.backgroundSelected }]}
                />
              </Field>

              <Field label="Description">
                <TextInput
                  value={description}
                  onChangeText={setDescription}
                  placeholder="Describe the property..."
                  placeholderTextColor={theme.textSecondary}
                  multiline
                  numberOfLines={4}
                  style={[
                    styles.input,
                    styles.textArea,
                    { color: theme.text, borderColor: theme.backgroundSelected },
                  ]}
                />
              </Field>

              <Field label="Listing type">
                <View style={[styles.segmentedRow, { backgroundColor: theme.backgroundElement }]}>
                  {LISTING_TYPES.map((value) => {
                    const selected = listingType === value;
                    return (
                      <Pressable
                        key={value}
                        onPress={() => setListingType(value)}
                        style={[styles.segment, selected && { backgroundColor: theme.text }]}>
                        <ThemedText type="small" style={{ color: selected ? theme.background : theme.text }}>
                          {value === 'buy' ? 'Buy' : 'Rent'}
                        </ThemedText>
                      </Pressable>
                    );
                  })}
                </View>
              </Field>

              <Field label="Property type">
                <View style={styles.pillRow}>
                  {PROPERTY_TYPES.map((value) => {
                    const selected = propertyType === value;
                    return (
                      <Pressable
                        key={value}
                        onPress={() => setPropertyType(selected ? null : value)}
                        style={[
                          styles.pill,
                          { backgroundColor: selected ? theme.text : theme.backgroundElement },
                        ]}>
                        <ThemedText type="small" style={{ color: selected ? theme.background : theme.text }}>
                          {value[0].toUpperCase() + value.slice(1)}
                        </ThemedText>
                      </Pressable>
                    );
                  })}
                </View>
              </Field>

              <View style={styles.row}>
                <Field label="Price" style={styles.flex1}>
                  <TextInput
                    value={price}
                    onChangeText={setPrice}
                    placeholder="250000"
                    placeholderTextColor={theme.textSecondary}
                    keyboardType="numeric"
                    style={[styles.input, { color: theme.text, borderColor: theme.backgroundSelected }]}
                  />
                </Field>
                <Field label="Area (m²)" style={styles.flex1}>
                  <TextInput
                    value={areaSqm}
                    onChangeText={setAreaSqm}
                    placeholder="120"
                    placeholderTextColor={theme.textSecondary}
                    keyboardType="numeric"
                    style={[styles.input, { color: theme.text, borderColor: theme.backgroundSelected }]}
                  />
                </Field>
              </View>

              <View style={styles.row}>
                <Field label="Bedrooms" style={styles.flex1}>
                  <TextInput
                    value={bedrooms}
                    onChangeText={setBedrooms}
                    placeholder="2"
                    placeholderTextColor={theme.textSecondary}
                    keyboardType="numeric"
                    style={[styles.input, { color: theme.text, borderColor: theme.backgroundSelected }]}
                  />
                </Field>
                <Field label="Bathrooms" style={styles.flex1}>
                  <TextInput
                    value={bathrooms}
                    onChangeText={setBathrooms}
                    placeholder="1"
                    placeholderTextColor={theme.textSecondary}
                    keyboardType="numeric"
                    style={[styles.input, { color: theme.text, borderColor: theme.backgroundSelected }]}
                  />
                </Field>
              </View>

              <Field label="Location">
                <TextInput
                  value={locationText}
                  onChangeText={setLocationText}
                  placeholder="Miami Beach, FL"
                  placeholderTextColor={theme.textSecondary}
                  style={[styles.input, { color: theme.text, borderColor: theme.backgroundSelected }]}
                />
              </Field>

              <Field label="Amenities (comma-separated)">
                <TextInput
                  value={amenities}
                  onChangeText={setAmenities}
                  placeholder="Pool, Garage, Garden"
                  placeholderTextColor={theme.textSecondary}
                  style={[styles.input, { color: theme.text, borderColor: theme.backgroundSelected }]}
                />
              </Field>

              <Field label="Style tags (comma-separated)">
                <TextInput
                  value={styleTags}
                  onChangeText={setStyleTags}
                  placeholder="Modern, Beachfront"
                  placeholderTextColor={theme.textSecondary}
                  style={[styles.input, { color: theme.text, borderColor: theme.backgroundSelected }]}
                />
              </Field>

              {formError ? <ThemedText style={styles.errorText}>{formError}</ThemedText> : null}

              <Pressable
                onPress={handleSubmit}
                disabled={isSubmitting}
                style={({ pressed }) => [
                  styles.primaryButton,
                  pressed && styles.pressed,
                  isSubmitting && styles.disabled,
                ]}>
                {isSubmitting ? (
                  <ActivityIndicator color="#ffffff" />
                ) : (
                  <ThemedText style={styles.primaryButtonText}>
                    {isEditing ? 'Save Changes' : 'Create Listing'}
                  </ThemedText>
                )}
              </Pressable>

              {isEditing ? (
                <Pressable
                  onPress={handleDelete}
                  disabled={isDeleting}
                  style={({ pressed }) => [styles.deleteButton, pressed && styles.pressed]}>
                  {isDeleting ? (
                    <ActivityIndicator color="#D92D20" />
                  ) : (
                    <ThemedText style={styles.deleteButtonText}>Delete Listing</ThemedText>
                  )}
                </Pressable>
              ) : null}
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
    gap: Spacing.three,
  },
  field: {
    gap: Spacing.one,
  },
  row: {
    flexDirection: 'row',
    gap: Spacing.three,
  },
  flex1: {
    flex: 1,
  },
  input: {
    height: 46,
    borderRadius: Spacing.three,
    borderWidth: 1,
    paddingHorizontal: Spacing.three,
    fontSize: 15,
  },
  textArea: {
    height: 100,
    paddingTop: Spacing.two,
    textAlignVertical: 'top',
  },
  segmentedRow: {
    flexDirection: 'row',
    borderRadius: Spacing.five,
    padding: Spacing.half,
  },
  segment: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: Spacing.two,
    borderRadius: Spacing.five,
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
    marginTop: Spacing.two,
  },
  primaryButtonText: {
    color: '#ffffff',
    fontWeight: '600',
  },
  deleteButton: {
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteButtonText: {
    color: '#D92D20',
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
