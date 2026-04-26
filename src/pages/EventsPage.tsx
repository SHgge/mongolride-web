import { useEffect, useState } from 'react';
import { supabasePublic as supabase } from '../lib/supabase';
import type { Tables } from '../types/database.types';
import EventList from '../components/events/EventList';

type Event = Tables<'events'>;
type StatusFilter = 'all' | 'published' | 'completed';
type DisciplineFilter = 'all' | 'road' | 'mtb' | 'gravel' | 'urban' | 'commute' | 'training';

const STATUS_TABS: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: 'Бүгд' },
  { value: 'published', label: 'Удахгүй' },
  { value: 'completed', label: 'Дууссан' },
];

const DISCIPLINE_TABS: { value: DisciplineFilter; label: string }[] = [
  { value: 'all', label: 'Бүх төрөл' },
  { value: 'road', label: 'Зам' },
  { value: 'mtb', label: 'Уулын' },
  { value: 'gravel', label: 'Хайрга' },
  { value: 'urban', label: 'Хотын' },
  { value: 'commute', label: 'Ажилд' },
  { value: 'training', label: 'Сургалт' },
];

export default function EventsPage() {
  const [events, setEvents] = useState<Event[]>([]);
  const [coverUrls, setCoverUrls] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('published');
  const [disciplineFilter, setDisciplineFilter] = useState<DisciplineFilter>('all');

  useEffect(() => {
    setLoading(true);
    let q = supabase.from('events').select('*').order('meet_at', { ascending: true });
    if (statusFilter !== 'all') q = q.eq('status', statusFilter);
    if (disciplineFilter !== 'all') q = q.eq('discipline', disciplineFilter);

    q.then(({ data }) => {
      const list = data ?? [];
      setEvents(list);
      // Build cover URL map
      const map: Record<string, string> = {};
      list.forEach((e) => {
        if (e.cover_photo_path) {
          map[e.id] = supabase.storage.from('event-assets').getPublicUrl(e.cover_photo_path).data.publicUrl;
        }
      });
      setCoverUrls(map);
      setLoading(false);
    });
  }, [statusFilter, disciplineFilter]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Арга хэмжээ</h1>
        <p className="text-gray-500 mt-1">{events.length} арга хэмжээ</p>
      </div>

      {/* Status filter */}
      <div className="flex gap-2 mb-3 overflow-x-auto pb-1">
        {STATUS_TABS.map((t) => (
          <button key={t.value} onClick={() => setStatusFilter(t.value)}
            className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
              statusFilter === t.value ? 'bg-primary-100 text-primary-700' : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Discipline filter */}
      <div className="flex gap-2 mb-8 overflow-x-auto pb-2">
        {DISCIPLINE_TABS.map((t) => (
          <button key={t.value} onClick={() => setDisciplineFilter(t.value)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
              disciplineFilter === t.value ? 'bg-primary-100 text-primary-700 ring-1 ring-primary-300' : 'bg-gray-50 text-gray-500 hover:bg-gray-100'
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      <EventList events={events} loading={loading} coverUrls={coverUrls} />
    </div>
  );
}
