import { useEffect, useState } from 'react';
import { routeService } from '../services/route.service';
import type { Route } from '../types/route.types';

export function useRoutes(page = 1) {
  const [routes, setRoutes] = useState<Route[]>([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    routeService.getRoutes(page).then(({ data, count }) => {
      setRoutes(data ?? []);
      setCount(count ?? 0);
      setLoading(false);
    });
  }, [page]);

  return { routes, count, loading };
}
