import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { AvailabilitySlotForm } from '@/components/availability-slot-form';
import { ErrorState } from '@/components/error-state';
import { LocationPickerModal, type LocationPickerResult } from '@/components/location-picker-modal';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/providers/auth-provider';
import { enhanceListingText, type EnhanceTextField } from '@/services/ai-enhance';
import { clearFutureAvailability, createSlots, hasAvailabilitySlots, type NewSlot } from '@/services/bookings';
import { deleteListingPhoto, getListingPhotos, uploadListingPhoto, type ListingPhoto } from '@/services/listing-photos';
import {
  createListing,
  deleteListing,
  getListingById,
  LISTING_STATUSES,
  PROPERTY_TYPES,
  updateListing,
  updateListingStatus,
  type ListingFormValues,
  type ListingStatus,
  type PropertyType,
} from '@/services/listings';
import { getFriendlyErrorMessage } from '@/utils/error-message';

const LISTING_TYPES = ['buy', 'rent'] as const;

const AMENITY_OPTIONS = [
  'WiFi',
  'Parking',
  'Pool',
  'Garden',
  'AC',
  'Balcony',
  'Furnished',
  'Storage',
  'Elevator',
  'Security',
  'Gym',
  'Pet Friendly',
  'Other',
] as const;

const STYLE_TAG_OPTIONS = [
  'Modern',
  'Cozy',
  'Luxury',
  'Minimalist',
  'Beachfront',
  'Family-friendly',
  'Urban',
  'Traditional',
  'Other',
] as const;

const STATUS_LABELS: Record<ListingStatus, string> = {
  available: 'Available',
  under_offer: 'Under Offer',
  sold: 'Sold',
};

// Kept in sync with the same softened palette used for listing status in my-listings-view.tsx.
const STATUS_COLORS: Record<ListingStatus, { background: string; text: string }> = {
  available: { background: '#E7F4EC', text: '#3F7A5C' },
  under_offer: { background: '#F6EFE3', text: '#96703F' },
  sold: { background: '#EAEAEE', text: '#5B5F6A' },
};

function getStatusDisplay(status: string) {
  return {
    label: STATUS_LABELS[status as ListingStatus] ?? status,
    colors: STATUS_COLORS[status as ListingStatus] ?? STATUS_COLORS.available,
  };
}

function confirmListingTypeChange() {
  return new Promise<boolean>((resolve) => {
    Alert.alert(
      'Change listing type?',
      "Changing listing type will clear existing availability slots since they don't apply to the new type. Continue?",
      [
        { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
        { text: 'Continue', style: 'destructive', onPress: () => resolve(true) },
      ],
      { cancelable: true, onDismiss: () => resolve(false) },
    );
  });
}

function splitTagValues(values: string[], options: readonly string[]) {
  const predefinedOptions = options.filter((option) => option !== 'Other');
  const selected = values.filter((value) => predefinedOptions.includes(value));
  const customValues = values.filter((value) => !predefinedOptions.includes(value));
  return {
    selected: customValues.length > 0 ? [...selected, 'Other'] : selected,
    otherText: customValues.join(', '),
  };
}

function buildTagValues(selected: string[], otherText: string) {
  const predefinedSelected = selected.filter((value) => value !== 'Other');
  if (selected.includes('Other') && otherText.trim()) {
    return [...predefinedSelected, otherText.trim()];
  }
  return predefinedSelected;
}

const pendingSlotDateFormatter = new Intl.DateTimeFormat('en-US', {
  weekday: 'short',
  month: 'short',
  day: 'numeric',
});
const pendingSlotTimeFormatter = new Intl.DateTimeFormat('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
const pendingSlotDayFormatter = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' });

function formatPendingSlot(slot: NewSlot, listingType: 'buy' | 'rent') {
  const start = new Date(slot.start_time);
  const end = new Date(slot.end_time);
  if (listingType === 'rent') {
    return `${pendingSlotDayFormatter.format(start)} - ${pendingSlotDayFormatter.format(end)}`;
  }
  return `${pendingSlotDateFormatter.format(start)}, ${pendingSlotTimeFormatter.format(start)}–${pendingSlotTimeFormatter.format(end)}`;
}

type NumberFieldResult = { value: number | null; error?: string };

function validateNumberField(value: string, { required = false }: { required?: boolean } = {}): NumberFieldResult {
  const trimmed = value.trim();
  if (!trimmed) {
    return required ? { value: null, error: 'This field is required.' } : { value: null };
  }
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return { value: null, error: 'Enter a valid number.' };
  }
  return { value: parsed };
}

type FormFieldErrors = Partial<Record<'title' | 'price' | 'bedrooms' | 'bathrooms' | 'areaSqm', string>>;

export default function ListingFormScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const isEditing = Boolean(id);
  const router = useRouter();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { session } = useAuth();
  const userId = session?.user.id;

  const [isLoading, setIsLoading] = useState(isEditing);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [status, setStatus] = useState<ListingStatus>('available');
  const [isStatusSheetVisible, setIsStatusSheetVisible] = useState(false);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [listingType, setListingType] = useState<'buy' | 'rent'>('buy');
  const [originalListingType, setOriginalListingType] = useState<'buy' | 'rent' | null>(null);
  const [price, setPrice] = useState('');
  const [bedrooms, setBedrooms] = useState('');
  const [bathrooms, setBathrooms] = useState('');
  const [propertyType, setPropertyType] = useState<PropertyType | null>(null);
  const [locationText, setLocationText] = useState('');
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [isLocationPickerVisible, setIsLocationPickerVisible] = useState(false);
  const [areaSqm, setAreaSqm] = useState('');
  const [amenitiesSelected, setAmenitiesSelected] = useState<string[]>([]);
  const [amenitiesOtherText, setAmenitiesOtherText] = useState('');
  const [styleTagsSelected, setStyleTagsSelected] = useState<string[]>([]);
  const [styleTagsOtherText, setStyleTagsOtherText] = useState('');
  const [isAmenitiesSheetVisible, setIsAmenitiesSheetVisible] = useState(false);
  const [isStyleTagsSheetVisible, setIsStyleTagsSheetVisible] = useState(false);
  const [isAvailabilitySheetVisible, setIsAvailabilitySheetVisible] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FormFieldErrors>({});

  const [enhancingField, setEnhancingField] = useState<EnhanceTextField | null>(null);
  const [enhanceError, setEnhanceError] = useState<{ field: EnhanceTextField; message: string } | null>(null);
  const [pendingSuggestion, setPendingSuggestion] = useState<{ field: EnhanceTextField; text: string } | null>(null);

  const [sellerId, setSellerId] = useState<string | null>(null);
  const [existingPhotos, setExistingPhotos] = useState<ListingPhoto[]>([]);
  const [pendingPhotos, setPendingPhotos] = useState<{ uri: string }[]>([]);
  const [removingPhotoId, setRemovingPhotoId] = useState<string | null>(null);
  const [photosError, setPhotosError] = useState<string | null>(null);

  // New-listing-only: availability slots staged locally until the listing
  // itself is created (there's no listing_id to attach them to yet). Created
  // together with the listing in the same handleSubmit call — see there.
  const [pendingSlots, setPendingSlots] = useState<(NewSlot & { id: string })[]>([]);
  const pendingSlotIdRef = useRef(0);

  useEffect(() => {
    // Buy-mode viewing slots and rent-mode date ranges aren't interchangeable
    // — drop anything staged under the previous listing type when it changes.
    setPendingSlots([]);
  }, [listingType]);

  const handleStagePendingSlots = async (newSlots: NewSlot[]) => {
    setPendingSlots((prev) => [
      ...prev,
      ...newSlots.map((slot) => ({ ...slot, id: `pending-${pendingSlotIdRef.current++}` })),
    ]);
    return { error: null };
  };

  const handleRemovePendingSlot = (slotId: string) => {
    setPendingSlots((prev) => prev.filter((slot) => slot.id !== slotId));
  };

  const loadListing = useCallback(async () => {
    if (!id) return;
    setLoadError(null);
    setIsLoading(true);
    const { data, error } = await getListingById(id);
    if (error || !data) {
      if (error) console.error('loadListing: failed to load listing', error);
      setLoadError(error ? getFriendlyErrorMessage(error) : 'Listing not found.');
      setIsLoading(false);
      return;
    }
    setSellerId(data.seller_id);
    setStatus(data.status as ListingStatus);
    setTitle(data.title);
    setDescription(data.description ?? '');
    setListingType(data.listing_type);
    setOriginalListingType(data.listing_type);
    setPrice(String(data.price));
    setBedrooms(data.bedrooms != null ? String(data.bedrooms) : '');
    setBathrooms(data.bathrooms != null ? String(data.bathrooms) : '');
    setPropertyType((data.property_type as PropertyType | null) ?? null);
    setLocationText(data.location_text ?? '');
    setLatitude(data.latitude ?? null);
    setLongitude(data.longitude ?? null);
    setAreaSqm(data.area_sqm != null ? String(data.area_sqm) : '');
    const amenitiesSplit = splitTagValues(data.amenities ?? [], AMENITY_OPTIONS);
    setAmenitiesSelected(amenitiesSplit.selected);
    setAmenitiesOtherText(amenitiesSplit.otherText);
    const styleTagsSplit = splitTagValues(data.style_tags ?? [], STYLE_TAG_OPTIONS);
    setStyleTagsSelected(styleTagsSplit.selected);
    setStyleTagsOtherText(styleTagsSplit.otherText);
    setIsLoading(false);
  }, [id]);

  useEffect(() => {
    loadListing();
  }, [loadListing]);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    getListingPhotos(id).then(({ data, error }) => {
      if (cancelled) return;
      if (!error) {
        setExistingPhotos(data);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [id]);

  const handlePickPhotos = async () => {
    setPhotosError(null);

    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setPhotosError('Photo library access is required to add photos.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      quality: 0.7,
    });

    if (result.canceled) return;
    setPendingPhotos((prev) => [...prev, ...result.assets.map((asset) => ({ uri: asset.uri }))]);
  };

  const handleRemoveExistingPhoto = async (photo: ListingPhoto) => {
    setPhotosError(null);
    setRemovingPhotoId(photo.id);
    const { error } = await deleteListingPhoto(photo);
    setRemovingPhotoId(null);

    if (error) {
      setPhotosError('Failed to remove photo.');
      return;
    }
    setExistingPhotos((prev) => prev.filter((p) => p.id !== photo.id));
  };

  const handleRemovePendingPhoto = (index: number) => {
    setPendingPhotos((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (!userId) return;
    setFormError(null);

    const trimmedTitle = title.trim();
    const priceResult = validateNumberField(price, { required: true });
    const bedroomsResult = validateNumberField(bedrooms);
    const bathroomsResult = validateNumberField(bathrooms);
    const areaResult = validateNumberField(areaSqm);

    const nextFieldErrors: FormFieldErrors = {};
    if (!trimmedTitle) nextFieldErrors.title = 'Title is required.';
    if (priceResult.error) nextFieldErrors.price = priceResult.error;
    if (bedroomsResult.error) nextFieldErrors.bedrooms = bedroomsResult.error;
    if (bathroomsResult.error) nextFieldErrors.bathrooms = bathroomsResult.error;
    if (areaResult.error) nextFieldErrors.areaSqm = areaResult.error;

    if (Object.keys(nextFieldErrors).length > 0) {
      setFieldErrors(nextFieldErrors);
      setFormError('Please fix the highlighted fields below.');
      return;
    }
    setFieldErrors({});

    if (isEditing && id && originalListingType && listingType !== originalListingType) {
      const { hasSlots, error: hasSlotsError } = await hasAvailabilitySlots(id);
      if (hasSlotsError) {
        console.error('handleSubmit: failed to check availability slots', hasSlotsError);
        setFormError(getFriendlyErrorMessage(hasSlotsError));
        return;
      }

      if (hasSlots) {
        const confirmed = await confirmListingTypeChange();
        if (!confirmed) return;

        setIsSubmitting(true);
        const { error: clearError } = await clearFutureAvailability(id);
        if (clearError) {
          console.error('handleSubmit: failed to clear future availability', clearError);
          setIsSubmitting(false);
          setFormError(getFriendlyErrorMessage(clearError));
          return;
        }
        setIsSubmitting(false);
      }
    }

    const values: ListingFormValues = {
      title: trimmedTitle,
      description: description.trim(),
      listing_type: listingType,
      price: priceResult.value!,
      bedrooms: bedroomsResult.value,
      bathrooms: bathroomsResult.value,
      property_type: propertyType,
      location_text: locationText.trim(),
      latitude,
      longitude,
      area_sqm: areaResult.value,
      amenities: buildTagValues(amenitiesSelected, amenitiesOtherText),
      style_tags: buildTagValues(styleTagsSelected, styleTagsOtherText),
    };

    setIsSubmitting(true);

    let listingId: string | null = null;
    if (isEditing) {
      const { error } = await updateListing(id!, values);
      if (error) {
        console.error('handleSubmit: failed to update listing', error);
        setIsSubmitting(false);
        setFormError(getFriendlyErrorMessage(error));
        return;
      }
      listingId = id!;
    } else {
      const { data, error } = await createListing(userId, values);
      if (error || !data) {
        console.error('handleSubmit: failed to create listing', error);
        setIsSubmitting(false);
        setFormError(error ? getFriendlyErrorMessage(error) : 'Failed to create listing.');
        return;
      }
      listingId = data.id;

      if (pendingSlots.length > 0) {
        const { error: slotsError } = await createSlots(
          listingId,
          pendingSlots.map(({ start_time, end_time }) => ({ start_time, end_time })),
        );
        if (slotsError) {
          console.error('handleSubmit: failed to create availability slots for new listing', slotsError, {
            listingId,
          });
          setIsSubmitting(false);
          setFormError('Listing saved, but availability failed to save. You can add it from Manage Availability.');
          return;
        }
      }
    }

    if (listingId && pendingPhotos.length > 0) {
      let nextSortOrder = existingPhotos.reduce((max, photo) => Math.max(max, photo.sort_order + 1), 0);
      const photosToUpload = pendingPhotos;
      for (const photo of photosToUpload) {
        console.log('handleSubmit: uploading listing photo, about to insert into listing_photos', {
          listingId,
          listingSellerId: sellerId ?? userId,
          currentUserId: userId,
        });
        const { data: uploadedPhoto, error: uploadError } = await uploadListingPhoto(listingId, photo.uri, nextSortOrder);
        if (uploadError) {
          console.error('handleSubmit: listing photo upload failed', uploadError, {
            listingId,
            listingSellerId: sellerId ?? userId,
            currentUserId: userId,
          });
          setIsSubmitting(false);
          setFormError('Listing saved, but one or more photos failed to upload. You can try adding them again.');
          return;
        }

        setExistingPhotos((prev) => [...prev, uploadedPhoto]);
        setPendingPhotos((prev) => prev.filter((p) => p.uri !== photo.uri));
        nextSortOrder += 1;
      }
    }

    setIsSubmitting(false);
    router.back();
  };

  const toggleTagSelection = (setSelected: (updater: (prev: string[]) => string[]) => void, value: string) => {
    setSelected((prev) => (prev.includes(value) ? prev.filter((item) => item !== value) : [...prev, value]));
  };

  const amenitiesValues = buildTagValues(amenitiesSelected, amenitiesOtherText);
  const styleTagsValues = buildTagValues(styleTagsSelected, styleTagsOtherText);

  const handleConfirmLocation = ({ address, latitude: pickedLat, longitude: pickedLng }: LocationPickerResult) => {
    setLocationText(address);
    setLatitude(pickedLat);
    setLongitude(pickedLng);
    setIsLocationPickerVisible(false);
  };

  const handleEnhance = async (field: EnhanceTextField) => {
    const currentText = (field === 'title' ? title : description).trim();
    if (!currentText) {
      setEnhanceError({ field, message: 'Add some text first, then enhance it.' });
      return;
    }

    setEnhanceError(null);
    setPendingSuggestion(null);
    setEnhancingField(field);
    const { data, error } = await enhanceListingText(currentText, field);
    setEnhancingField(null);

    if (error || !data) {
      setEnhanceError({ field, message: error ?? 'AI enhancement is temporarily unavailable.' });
      return;
    }

    setPendingSuggestion({ field, text: data });
  };

  const handleAcceptSuggestion = () => {
    if (!pendingSuggestion) return;
    if (pendingSuggestion.field === 'title') {
      setTitle(pendingSuggestion.text);
    } else {
      setDescription(pendingSuggestion.text);
    }
    setPendingSuggestion(null);
  };

  const handleDiscardSuggestion = () => {
    setPendingSuggestion(null);
  };

  const handleChangeStatus = async (nextStatus: ListingStatus) => {
    if (!id || nextStatus === status) {
      setIsStatusSheetVisible(false);
      return;
    }

    setIsUpdatingStatus(true);
    setStatusError(null);
    const { error, cancelledBookingsCount } = await updateListingStatus(id, nextStatus);
    setIsUpdatingStatus(false);

    if (error) {
      console.error('handleChangeStatus: failed to update status', error);
      setStatusError(getFriendlyErrorMessage(error));
      return;
    }

    setIsStatusSheetVisible(false);
    setStatus(nextStatus);
    setStatusMessage(
      cancelledBookingsCount > 0
        ? `Status updated to ${STATUS_LABELS[nextStatus]}. ${cancelledBookingsCount} upcoming booking${
            cancelledBookingsCount === 1 ? '' : 's'
          } cancelled.`
        : `Status updated to ${STATUS_LABELS[nextStatus]}.`,
    );
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
          if (existingPhotos.length > 0) {
            await Promise.all(
              existingPhotos.map((photo) =>
                deleteListingPhoto(photo).catch((err) =>
                  console.error('handleDelete: failed to remove photo from storage', photo.id, err),
                ),
              ),
            );
          }
          const { error } = await deleteListing(id);
          setIsDeleting(false);
          if (error) {
            console.error('handleDelete: failed to delete listing', error);
            setFormError(getFriendlyErrorMessage(error));
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
            <ErrorState message={loadError} onRetry={loadListing} isRetrying={isLoading} />
          ) : (
            <>
              {isEditing ? (
                <Field label="Status">
                  <Pressable
                    onPress={() => {
                      setStatusError(null);
                      setIsStatusSheetVisible(true);
                    }}
                    style={[styles.statusField, { backgroundColor: theme.backgroundElement }]}>
                    <View style={[styles.statusPill, { backgroundColor: getStatusDisplay(status).colors.background }]}>
                      <ThemedText type="small" style={{ color: getStatusDisplay(status).colors.text, fontWeight: '600' }}>
                        {getStatusDisplay(status).label}
                      </ThemedText>
                    </View>
                    <ThemedText type="small" themeColor="textSecondary">
                      Change
                    </ThemedText>
                  </Pressable>
                  {statusMessage ? (
                    <ThemedText type="small" themeColor="textSecondary">
                      {statusMessage}
                    </ThemedText>
                  ) : null}
                </Field>
              ) : null}

              <Field
                label="Title"
                error={fieldErrors.title}
                action={
                  <EnhanceButton onPress={() => handleEnhance('title')} isLoading={enhancingField === 'title'} />
                }>
                <TextInput
                  value={title}
                  onChangeText={(value) => {
                    setTitle(value);
                    if (fieldErrors.title) setFieldErrors((prev) => ({ ...prev, title: undefined }));
                  }}
                  placeholder="Modern 2 bedroom villa"
                  placeholderTextColor={theme.textSecondary}
                  style={[
                    styles.input,
                    { color: theme.text, borderColor: fieldErrors.title ? '#D92D20' : theme.backgroundSelected },
                  ]}
                />
                {enhanceError?.field === 'title' ? (
                  <ThemedText style={styles.errorText}>{enhanceError.message}</ThemedText>
                ) : null}
                {pendingSuggestion?.field === 'title' ? (
                  <EnhanceSuggestion
                    text={pendingSuggestion.text}
                    onAccept={handleAcceptSuggestion}
                    onDiscard={handleDiscardSuggestion}
                  />
                ) : null}
              </Field>

              <Field label="Photos">
                <View style={styles.photoGrid}>
                  {existingPhotos.map((photo) => (
                    <View key={photo.id} style={styles.photoTile}>
                      <Image source={{ uri: photo.photo_url }} style={styles.photoImage} />
                      <Pressable
                        onPress={() => handleRemoveExistingPhoto(photo)}
                        disabled={removingPhotoId === photo.id}
                        hitSlop={6}
                        style={styles.photoRemoveButton}>
                        {removingPhotoId === photo.id ? (
                          <ActivityIndicator size="small" color="#ffffff" />
                        ) : (
                          <SymbolView name={{ ios: 'xmark', android: 'close', web: 'close' }} tintColor="#ffffff" size={12} />
                        )}
                      </Pressable>
                    </View>
                  ))}
                  {pendingPhotos.map((photo, index) => (
                    <View key={`pending-${photo.uri}-${index}`} style={styles.photoTile}>
                      <Image source={{ uri: photo.uri }} style={styles.photoImage} />
                      <Pressable
                        onPress={() => handleRemovePendingPhoto(index)}
                        hitSlop={6}
                        style={styles.photoRemoveButton}>
                        <SymbolView name={{ ios: 'xmark', android: 'close', web: 'close' }} tintColor="#ffffff" size={12} />
                      </Pressable>
                    </View>
                  ))}
                  <Pressable
                    onPress={handlePickPhotos}
                    style={[styles.photoTile, styles.photoAddTile, { borderColor: theme.backgroundSelected }]}>
                    <SymbolView
                      name={{ ios: 'plus', android: 'add', web: 'add' }}
                      tintColor={theme.textSecondary}
                      size={22}
                    />
                  </Pressable>
                </View>
                {photosError ? <ThemedText style={styles.errorText}>{photosError}</ThemedText> : null}
              </Field>

              <Field
                label="Description"
                action={
                  <EnhanceButton
                    onPress={() => handleEnhance('description')}
                    isLoading={enhancingField === 'description'}
                  />
                }>
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
                {enhanceError?.field === 'description' ? (
                  <ThemedText style={styles.errorText}>{enhanceError.message}</ThemedText>
                ) : null}
                {pendingSuggestion?.field === 'description' ? (
                  <EnhanceSuggestion
                    text={pendingSuggestion.text}
                    onAccept={handleAcceptSuggestion}
                    onDiscard={handleDiscardSuggestion}
                  />
                ) : null}
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
                <Field label="Price" style={styles.flex1} error={fieldErrors.price}>
                  <TextInput
                    value={price}
                    onChangeText={(value) => {
                      setPrice(value);
                      if (fieldErrors.price) setFieldErrors((prev) => ({ ...prev, price: undefined }));
                    }}
                    placeholder="250000"
                    placeholderTextColor={theme.textSecondary}
                    keyboardType="numeric"
                    style={[
                      styles.input,
                      { color: theme.text, borderColor: fieldErrors.price ? '#D92D20' : theme.backgroundSelected },
                    ]}
                  />
                </Field>
                <Field label="Area (m²)" style={styles.flex1} error={fieldErrors.areaSqm}>
                  <TextInput
                    value={areaSqm}
                    onChangeText={(value) => {
                      setAreaSqm(value);
                      if (fieldErrors.areaSqm) setFieldErrors((prev) => ({ ...prev, areaSqm: undefined }));
                    }}
                    placeholder="120"
                    placeholderTextColor={theme.textSecondary}
                    keyboardType="numeric"
                    style={[
                      styles.input,
                      { color: theme.text, borderColor: fieldErrors.areaSqm ? '#D92D20' : theme.backgroundSelected },
                    ]}
                  />
                </Field>
              </View>

              <View style={styles.row}>
                <Field label="Bedrooms" style={styles.flex1} error={fieldErrors.bedrooms}>
                  <TextInput
                    value={bedrooms}
                    onChangeText={(value) => {
                      setBedrooms(value);
                      if (fieldErrors.bedrooms) setFieldErrors((prev) => ({ ...prev, bedrooms: undefined }));
                    }}
                    placeholder="2"
                    placeholderTextColor={theme.textSecondary}
                    keyboardType="numeric"
                    style={[
                      styles.input,
                      { color: theme.text, borderColor: fieldErrors.bedrooms ? '#D92D20' : theme.backgroundSelected },
                    ]}
                  />
                </Field>
                <Field label="Bathrooms" style={styles.flex1} error={fieldErrors.bathrooms}>
                  <TextInput
                    value={bathrooms}
                    onChangeText={(value) => {
                      setBathrooms(value);
                      if (fieldErrors.bathrooms) setFieldErrors((prev) => ({ ...prev, bathrooms: undefined }));
                    }}
                    placeholder="1"
                    placeholderTextColor={theme.textSecondary}
                    keyboardType="numeric"
                    style={[
                      styles.input,
                      { color: theme.text, borderColor: fieldErrors.bathrooms ? '#D92D20' : theme.backgroundSelected },
                    ]}
                  />
                </Field>
              </View>

              <Field label="Location">
                {locationText ? (
                  <View style={[styles.locationPreview, { backgroundColor: theme.backgroundElement }]}>
                    <SymbolView
                      name={{ ios: 'mappin.circle.fill', android: 'location_on', web: 'location_on' }}
                      tintColor={theme.textSecondary}
                      size={18}
                    />
                    <ThemedText type="small" style={styles.locationPreviewText} numberOfLines={2}>
                      {locationText}
                    </ThemedText>
                    <Pressable onPress={() => setIsLocationPickerVisible(true)} hitSlop={8}>
                      <ThemedText type="small" style={styles.locationRepickText}>
                        Change
                      </ThemedText>
                    </Pressable>
                  </View>
                ) : (
                  <Pressable
                    onPress={() => setIsLocationPickerVisible(true)}
                    style={[styles.locationPickButton, { backgroundColor: theme.backgroundElement }]}>
                    <SymbolView
                      name={{ ios: 'map.fill', android: 'map', web: 'map' }}
                      tintColor={theme.text}
                      size={16}
                    />
                    <ThemedText type="small" style={styles.locationPickButtonText}>
                      Pick Location on Map
                    </ThemedText>
                  </Pressable>
                )}
              </Field>

              <Field label="Amenities">
                {amenitiesValues.length > 0 ? (
                  <View style={[styles.tagPreview, { backgroundColor: theme.backgroundElement }]}>
                    <View style={styles.tagPreviewChips}>
                      {amenitiesValues.map((value) => (
                        <View key={value} style={[styles.compactChip, { backgroundColor: theme.backgroundSelected }]}>
                          <ThemedText type="small" numberOfLines={1}>
                            {value}
                          </ThemedText>
                        </View>
                      ))}
                    </View>
                    <View style={styles.tagPreviewFooter}>
                      <Pressable onPress={() => setIsAmenitiesSheetVisible(true)} hitSlop={8}>
                        <ThemedText type="small" style={styles.locationRepickText}>
                          Edit
                        </ThemedText>
                      </Pressable>
                    </View>
                  </View>
                ) : (
                  <Pressable
                    onPress={() => setIsAmenitiesSheetVisible(true)}
                    style={[styles.locationPickButton, { backgroundColor: theme.backgroundElement }]}>
                    <SymbolView name={{ ios: 'plus', android: 'add', web: 'add' }} tintColor={theme.text} size={16} />
                    <ThemedText type="small" style={styles.locationPickButtonText}>
                      Add Amenities
                    </ThemedText>
                  </Pressable>
                )}
              </Field>

              <Field label="Style tags">
                {styleTagsValues.length > 0 ? (
                  <View style={[styles.tagPreview, { backgroundColor: theme.backgroundElement }]}>
                    <View style={styles.tagPreviewChips}>
                      {styleTagsValues.map((value) => (
                        <View key={value} style={[styles.compactChip, { backgroundColor: theme.backgroundSelected }]}>
                          <ThemedText type="small" numberOfLines={1}>
                            {value}
                          </ThemedText>
                        </View>
                      ))}
                    </View>
                    <View style={styles.tagPreviewFooter}>
                      <Pressable onPress={() => setIsStyleTagsSheetVisible(true)} hitSlop={8}>
                        <ThemedText type="small" style={styles.locationRepickText}>
                          Edit
                        </ThemedText>
                      </Pressable>
                    </View>
                  </View>
                ) : (
                  <Pressable
                    onPress={() => setIsStyleTagsSheetVisible(true)}
                    style={[styles.locationPickButton, { backgroundColor: theme.backgroundElement }]}>
                    <SymbolView name={{ ios: 'plus', android: 'add', web: 'add' }} tintColor={theme.text} size={16} />
                    <ThemedText type="small" style={styles.locationPickButtonText}>
                      Add Style Tags
                    </ThemedText>
                  </Pressable>
                )}
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

              <Pressable
                onPress={() => {
                  if (isEditing) {
                    router.push({ pathname: '/manage-availability', params: { id: id! } });
                  } else {
                    setIsAvailabilitySheetVisible(true);
                  }
                }}
                style={({ pressed }) => [
                  styles.secondaryButton,
                  { borderColor: theme.backgroundSelected },
                  pressed && styles.pressed,
                ]}>
                <ThemedText>Manage Availability</ThemedText>
              </Pressable>
              {!isEditing ? (
                <ThemedText type="small" themeColor="textSecondary" style={styles.availabilityHint}>
                  Optional — add availability now, or skip and set it up later after the listing is created.
                </ThemedText>
              ) : null}

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

      <Modal
        visible={isStatusSheetVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setIsStatusSheetVisible(false)}>
        <Pressable style={styles.backdrop} onPress={() => setIsStatusSheetVisible(false)} />
        <View style={styles.sheetContainer} pointerEvents="box-none">
          <ThemedView
            style={[styles.sheet, { backgroundColor: theme.background, paddingBottom: insets.bottom + Spacing.four }]}>
            <View style={styles.sheetHeader}>
              <ThemedText type="smallBold">Change status</ThemedText>
              <Pressable onPress={() => setIsStatusSheetVisible(false)} hitSlop={8}>
                <View style={[styles.closeButton, { backgroundColor: theme.backgroundElement }]}>
                  <SymbolView name={{ ios: 'xmark', android: 'close', web: 'close' }} tintColor={theme.text} size={16} />
                </View>
              </Pressable>
            </View>

            {statusError ? <ThemedText style={styles.errorText}>{statusError}</ThemedText> : null}

            {LISTING_STATUSES.map((option) => {
              const selected = option === status;
              return (
                <Pressable
                  key={option}
                  onPress={() => handleChangeStatus(option)}
                  disabled={isUpdatingStatus}
                  style={[styles.statusOptionRow, { backgroundColor: theme.backgroundElement }]}>
                  <ThemedText type="small">{STATUS_LABELS[option]}</ThemedText>
                  {selected ? (
                    <SymbolView
                      name={{ ios: 'checkmark', android: 'check', web: 'check' }}
                      tintColor={theme.text}
                      size={18}
                    />
                  ) : null}
                </Pressable>
              );
            })}

            {isUpdatingStatus ? <ActivityIndicator style={styles.statusSpacing} /> : null}
          </ThemedView>
        </View>
      </Modal>

      <LocationPickerModal
        visible={isLocationPickerVisible}
        onClose={() => setIsLocationPickerVisible(false)}
        onConfirm={handleConfirmLocation}
        initialLatitude={latitude}
        initialLongitude={longitude}
        initialAddress={locationText || null}
      />

      <TagPickerSheet
        visible={isAmenitiesSheetVisible}
        title="Amenities"
        options={AMENITY_OPTIONS}
        selected={amenitiesSelected}
        otherText={amenitiesOtherText}
        onToggle={(value) => toggleTagSelection(setAmenitiesSelected, value)}
        onChangeOtherText={setAmenitiesOtherText}
        onClose={() => setIsAmenitiesSheetVisible(false)}
      />

      <TagPickerSheet
        visible={isStyleTagsSheetVisible}
        title="Style tags"
        options={STYLE_TAG_OPTIONS}
        selected={styleTagsSelected}
        otherText={styleTagsOtherText}
        onToggle={(value) => toggleTagSelection(setStyleTagsSelected, value)}
        onChangeOtherText={setStyleTagsOtherText}
        onClose={() => setIsStyleTagsSheetVisible(false)}
      />

      {/*
        New-listing-only: mirrors the edit flow's dedicated Manage Availability
        screen (same header/card/list layout, same AvailabilitySlotForm), but
        as a full-screen Modal instead of a route push — there's no listing_id
        yet to navigate a route to, so slots stay staged in pendingSlots until
        handleSubmit creates the listing and attaches them right after.
      */}
      <Modal
        visible={isAvailabilitySheetVisible}
        animationType="slide"
        onRequestClose={() => setIsAvailabilitySheetVisible(false)}
        presentationStyle="fullScreen">
        <ThemedView style={styles.container}>
          {/*
            This Modal is nested inside listing-form, which the router already
            presents with presentation: 'modal' — a modal-within-modal. In
            that case react-native-safe-area-context's SafeAreaView can't be
            trusted to re-measure insets correctly for the inner Modal's own
            native root, so instead of another nested SafeAreaView here, use
            the insets already measured in the outer (non-modal-nested) scope
            above and apply the top inset explicitly.
          */}
          <View style={[styles.safeArea, { paddingTop: insets.top }]}>
            <View style={styles.header}>
              <Pressable onPress={() => setIsAvailabilitySheetVisible(false)} hitSlop={8}>
                <SymbolView name={{ ios: 'xmark', android: 'close', web: 'close' }} tintColor={theme.text} size={22} />
              </Pressable>
              <ThemedText type="smallBold">Manage Availability</ThemedText>
              <View style={{ width: 22 }} />
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
              <ThemedText themeColor="textSecondary" style={styles.availabilitySheetSubtitle}>
                {title.trim() || 'New listing'} · {listingType === 'rent' ? 'Rental dates' : 'Viewing slots'}
              </ThemedText>

              <ThemedView style={[styles.card, { backgroundColor: theme.backgroundElement }]}>
                <ThemedText type="smallBold">
                  {listingType === 'rent' ? 'Add a rental period' : 'Add viewing slots'}
                </ThemedText>
                <AvailabilitySlotForm listingType={listingType} onSubmitSlots={handleStagePendingSlots} />
              </ThemedView>

              <View style={styles.field}>
                <ThemedText type="smallBold">
                  {listingType === 'rent' ? 'Staged rental periods' : 'Staged viewing slots'}
                </ThemedText>
                {pendingSlots.length === 0 ? (
                  <ThemedText themeColor="textSecondary" style={styles.slotsSpacing}>
                    No availability added yet.
                  </ThemedText>
                ) : (
                  <View style={[styles.slotsList, styles.slotsSpacing]}>
                    {pendingSlots.map((slot) => (
                      <View key={slot.id} style={[styles.slotRow, { backgroundColor: theme.backgroundElement }]}>
                        <ThemedText type="small">{formatPendingSlot(slot, listingType)}</ThemedText>
                        <Pressable onPress={() => handleRemovePendingSlot(slot.id)} hitSlop={8}>
                          <SymbolView
                            name={{ ios: 'trash', android: 'delete', web: 'delete' }}
                            tintColor="#D92D20"
                            size={18}
                          />
                        </Pressable>
                      </View>
                    ))}
                  </View>
                )}
              </View>

              <Pressable
                onPress={() => setIsAvailabilitySheetVisible(false)}
                style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}>
                <ThemedText style={styles.primaryButtonText}>Done</ThemedText>
              </Pressable>
            </ScrollView>
          </View>
        </ThemedView>
      </Modal>
    </ThemedView>
  );
}

function Field({
  label,
  children,
  style,
  action,
  error,
}: {
  label: string;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  action?: ReactNode;
  error?: string;
}) {
  return (
    <View style={[styles.field, style]}>
      <View style={styles.fieldLabelRow}>
        <ThemedText type="small" themeColor="textSecondary">
          {label}
        </ThemedText>
        {action}
      </View>
      {children}
      {error ? <ThemedText style={styles.errorText}>{error}</ThemedText> : null}
    </View>
  );
}

function EnhanceButton({ onPress, isLoading }: { onPress: () => void; isLoading: boolean }) {
  const theme = useTheme();
  return (
    <Pressable onPress={onPress} disabled={isLoading} hitSlop={6} style={styles.enhanceButton}>
      {isLoading ? (
        <ActivityIndicator size="small" color={theme.textSecondary} />
      ) : (
        <>
          <SymbolView
            name={{ ios: 'sparkles', android: 'auto_awesome', web: 'auto_awesome' }}
            tintColor={theme.text}
            size={13}
          />
          <ThemedText type="small" style={styles.enhanceButtonText}>
            Enhance with AI
          </ThemedText>
        </>
      )}
    </Pressable>
  );
}

function EnhanceSuggestion({
  text,
  onAccept,
  onDiscard,
}: {
  text: string;
  onAccept: () => void;
  onDiscard: () => void;
}) {
  const theme = useTheme();
  return (
    <View
      style={[styles.suggestionBox, { backgroundColor: theme.backgroundElement, borderColor: theme.backgroundSelected }]}>
      <ThemedText type="small">{text}</ThemedText>
      <View style={styles.suggestionActions}>
        <Pressable onPress={onDiscard} style={styles.suggestionButton}>
          <ThemedText type="small" themeColor="textSecondary">
            Discard
          </ThemedText>
        </Pressable>
        <Pressable onPress={onAccept} style={[styles.suggestionButton, { backgroundColor: theme.text }]}>
          <ThemedText type="small" style={{ color: theme.background, fontWeight: '600' }}>
            Use this
          </ThemedText>
        </Pressable>
      </View>
    </View>
  );
}

function TagPickerSheet({
  visible,
  title,
  options,
  selected,
  otherText,
  onToggle,
  onChangeOtherText,
  onClose,
}: {
  visible: boolean;
  title: string;
  options: readonly string[];
  selected: string[];
  otherText: string;
  onToggle: (value: string) => void;
  onChangeOtherText: (value: string) => void;
  onClose: () => void;
}) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={styles.tagSheetContainer} pointerEvents="box-none">
        <ThemedView
          style={[
            styles.sheet,
            styles.tagSheet,
            { backgroundColor: theme.background, paddingBottom: insets.bottom + Spacing.four },
          ]}>
          <View style={styles.sheetHeader}>
            <ThemedText type="smallBold">{title}</ThemedText>
            <Pressable onPress={onClose} hitSlop={8}>
              <View style={[styles.closeButton, { backgroundColor: theme.backgroundElement }]}>
                <SymbolView name={{ ios: 'xmark', android: 'close', web: 'close' }} tintColor={theme.text} size={16} />
              </View>
            </Pressable>
          </View>

          <ScrollView
            style={styles.sheetScroll}
            contentContainerStyle={styles.sheetScrollContent}
            keyboardShouldPersistTaps="handled">
            <View style={styles.pillRow}>
              {options.map((value) => {
                const isSelected = selected.includes(value);
                return (
                  <Pressable
                    key={value}
                    onPress={() => onToggle(value)}
                    style={[styles.pill, { backgroundColor: isSelected ? theme.text : theme.backgroundElement }]}>
                    <ThemedText type="small" style={{ color: isSelected ? theme.background : theme.text }}>
                      {value}
                    </ThemedText>
                  </Pressable>
                );
              })}
            </View>
            {selected.includes('Other') ? (
              <TextInput
                value={otherText}
                onChangeText={onChangeOtherText}
                placeholder="Enter custom value"
                placeholderTextColor={theme.textSecondary}
                style={[styles.input, { color: theme.text, borderColor: theme.backgroundSelected }]}
              />
            ) : null}
          </ScrollView>

          <Pressable onPress={onClose} style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}>
            <ThemedText style={styles.primaryButtonText}>Done</ThemedText>
          </Pressable>
        </ThemedView>
      </View>
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
  card: {
    borderRadius: Spacing.four,
    padding: Spacing.four,
    gap: Spacing.three,
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
  fieldLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  locationPickButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    height: 48,
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.three,
  },
  locationPickButtonText: {
    fontWeight: '600',
  },
  locationPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    padding: Spacing.three,
    borderRadius: Spacing.three,
  },
  locationPreviewText: {
    flex: 1,
  },
  locationRepickText: {
    fontWeight: '600',
  },
  enhanceButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.half,
    minHeight: 20,
  },
  enhanceButtonText: {
    fontWeight: '600',
  },
  suggestionBox: {
    borderWidth: 1,
    borderRadius: Spacing.three,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  suggestionActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: Spacing.two,
  },
  suggestionButton: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
    borderRadius: Spacing.five,
  },
  statusField: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
  },
  statusPill: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.half,
    borderRadius: Spacing.five,
  },
  statusSpacing: {
    marginTop: Spacing.one,
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  sheetContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
  },
  sheet: {
    borderTopLeftRadius: Spacing.five,
    borderTopRightRadius: Spacing.five,
    padding: Spacing.four,
    gap: Spacing.two,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.one,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusOptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
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
  tagPreview: {
    gap: Spacing.two,
    padding: Spacing.three,
    borderRadius: Spacing.three,
  },
  tagPreviewChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  tagPreviewFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  compactChip: {
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.half,
    borderRadius: Spacing.five,
  },
  tagSheetContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'flex-end',
  },
  tagSheet: {
    maxHeight: '75%',
    overflow: 'hidden',
  },
  sheetScroll: {
    flexGrow: 1,
    flexShrink: 1,
    minHeight: 0,
  },
  sheetScrollContent: {
    gap: Spacing.three,
    paddingBottom: Spacing.two,
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
  secondaryButton: {
    height: 48,
    borderRadius: Spacing.three,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  availabilityHint: {
    marginTop: -Spacing.two,
  },
  availabilitySheetSubtitle: {
    marginTop: -Spacing.two,
  },
  photoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  photoTile: {
    width: 80,
    height: 80,
    borderRadius: Spacing.three,
    overflow: 'hidden',
  },
  photoImage: {
    width: '100%',
    height: '100%',
  },
  photoAddTile: {
    borderWidth: 1,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoRemoveButton: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
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
