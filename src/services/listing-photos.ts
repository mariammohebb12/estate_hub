import { supabase } from '@/services/supabase';

export type ListingPhoto = {
  id: string;
  listing_id: string;
  photo_url: string;
  sort_order: number;
};

const STORAGE_BUCKET = 'listing-photos';

function storagePathFromPhotoUrl(photoUrl: string): string {
  const marker = `/${STORAGE_BUCKET}/`;
  const index = photoUrl.indexOf(marker);
  return index === -1 ? photoUrl : photoUrl.slice(index + marker.length);
}

export async function getListingPhotos(listingId: string) {
  const { data, error } = await supabase
    .from('listing_photos')
    .select('id, listing_id, photo_url, sort_order')
    .eq('listing_id', listingId)
    .order('sort_order', { ascending: true });

  return { data: (data as ListingPhoto[] | null) ?? [], error };
}

export async function uploadListingPhoto(listingId: string, localUri: string, sortOrder: number) {
  const extMatch = /\.([a-zA-Z0-9]+)$/.exec(localUri.split('?')[0]);
  const ext = extMatch?.[1]?.toLowerCase() ?? 'jpg';
  const path = `${listingId}/photo-${Date.now()}-${sortOrder}.${ext}`;

  const response = await fetch(localUri);
  const arrayBuffer = await response.arrayBuffer();

  const { error: uploadError } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(path, arrayBuffer, { contentType: `image/${ext === 'jpg' ? 'jpeg' : ext}`, upsert: true });

  if (uploadError) {
    return { data: null, error: uploadError };
  }

  const { data: publicUrlData } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(path);

  const { data, error: insertError } = await supabase
    .from('listing_photos')
    .insert({ listing_id: listingId, photo_url: publicUrlData.publicUrl, sort_order: sortOrder })
    .select('id, listing_id, photo_url, sort_order')
    .single();

  if (insertError) {
    return { data: null, error: insertError };
  }

  return { data: data as ListingPhoto, error: null };
}

export async function deleteListingPhoto(photo: Pick<ListingPhoto, 'id' | 'photo_url'>) {
  const storagePath = storagePathFromPhotoUrl(photo.photo_url);
  const { error: storageError } = await supabase.storage.from(STORAGE_BUCKET).remove([storagePath]);
  if (storageError) {
    return { error: storageError };
  }

  const { error } = await supabase.from('listing_photos').delete().eq('id', photo.id);
  return { error };
}
