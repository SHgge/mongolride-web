import { useEffect, useState } from 'react';

import { supabasePublic as supabase } from '../lib/supabase';
import type { Tables } from '../types/database.types';
import EventList from '../components/events/EventList';

type Event = Tables<'events'>;
type StatusFilter = 'all' | 'upcoming' | 'ongoing' | 'completed';

const TABS: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: 'Бүгд' },
  { value: 'upcoming', label: 'Удахгүй' },
  { value: 'ongoing', label: 'Явагдаж буй' },
  { value: 'completed', label: 'Дууссан' },
];

export default function EventsPage() {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  useEffect(() => {
    const query = supabase
      .from('events')
      .select('*')
      .order('event_date', { ascending: true });

    if (statusFilter !== 'all') {
      query.eq('status', statusFilter);
    }

    query.then(({ data, error }) => {
      if (error) console.error('Events fetch error:', error.message);
      setEvents(data ?? []);
      setLoading(false);
    });
  }, [statusFilter]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Арга хэмжээ</h1>
          <p className="text-gray-500 mt-1">{events.length} арга хэмжээ</p>
        </div>
      </div>

      {/* Status tabs */}
      <div className="flex gap-2 mb-8 overflow-x-auto pb-2">
        {TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => { setLoading(true); setStatusFilter(tab.value); }}
            className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
              statusFilter === tab.value
                ? 'bg-primary-100 text-primary-700'
                : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <EventList events={events} loading={loading} />
    </div>
  );
}
