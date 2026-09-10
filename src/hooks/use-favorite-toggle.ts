import { useCallback, useState } from 'react';

import { useToast } from '@/providers/toast-provider';
import { addFavorite, removeFavorite } from '@/services/favorites';
import { getFriendlyErrorMessage } from '@/utils/error-message';

export function useFavoriteToggle(userId: string | undefined) {
  const [favoritedIds, setFavoritedIds] = useState<Set<string>>(new Set());
  const { showToast } = useToast();

  const toggleFavorite = useCallback(
    async (listingId: string) => {
      if (!userId) return;
      const wasFavorited = favoritedIds.has(listingId);

      setFavoritedIds((prev) => {
        const next = new Set(prev);
        if (wasFavorited) {
          next.delete(listingId);
        } else {
          next.add(listingId);
        }
        return next;
      });

      try {
        const { error } = wasFavorited
          ? await removeFavorite(userId, listingId)
          : await addFavorite(userId, listingId);

        if (error) throw error;
      } catch (error) {
        // Catches both a returned `{error}` and a thrown/rejected network
        // failure (e.g. no connection) — either way, revert the optimistic
        // update and show a friendly message rather than the raw error text.
        console.error('toggleFavorite: failed to update favorite', error);
        setFavoritedIds((prev) => {
          const next = new Set(prev);
          if (wasFavorited) {
            next.add(listingId);
          } else {
            next.delete(listingId);
          }
          return next;
        });
        showToast(getFriendlyErrorMessage(error));
      }
    },
    [userId, favoritedIds, showToast],
  );

  return { favoritedIds, setFavoritedIds, toggleFavorite };
}
