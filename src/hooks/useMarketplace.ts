import { useEffect, useState } from 'react';
import { marketplaceService } from '../services/marketplace.service';
import type { Listing } from '../types/marketplace.types';

export function useMarketplace(page = 1) {
  const [listings, setListings] = useState<Listing[]>([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    marketplaceService.getListings(page).then(({ data, count }) => {
      setListings(data ?? []);
      setCount(count ?? 0);
      setLoading(false);
    });
  }, [page]);

  return { listings, count, loading };
}
