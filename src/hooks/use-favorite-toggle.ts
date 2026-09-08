import { useCallback, useState } from 'react';

import { addFavorite, removeFavorite } from '@/services/favorites';

export function useFavoriteToggle(userId: string | undefined) {
  const [favoritedIds, setFavoritedIds] = useState<Set<string>>(new Set());

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

      const { error } = wasFavorited
        ? await removeFavorite(userId, listingId)
        : await addFavorite(userId, listingId);

      if (error) {
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
      }
    },
    [userId, favoritedIds],
  );

  return { favoritedIds, setFavoritedIds, toggleFavorite };
}
