import { useEffect, useState } from 'react';
import { eventService } from '../services/event.service';
import type { Event } from '../types/event.types';

export function useEvents(page = 1) {
  const [events, setEvents] = useState<Event[]>([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    eventService.getEvents(page).then(({ data, count }) => {
      setEvents(data ?? []);
      setCount(count ?? 0);
      setLoading(false);
    });
  }, [page]);

  return { events, count, loading };
}
