import type { Tables } from '../../types/database.types';
import EventCard from './EventCard';
import { Calendar } from 'lucide-react';

type Event = Tables<'events'>;

interface EventListProps {
  events: Event[];
  loading: boolean;
}

export default function EventList({ events, loading }: EventListProps) {
  if (loading) {
    return (
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="bg-gray-100 rounded-2xl h-72 animate-pulse" />
        ))}
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="text-center py-20">
        <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-3" />
        <h3 className="text-lg font-medium text-gray-900 mb-1">Арга хэмжээ олдсонгүй</h3>
        <p className="text-gray-500 text-sm">Удахгүй шинэ арга хэмжээ зарлагдана</p>
      </div>
    );
  }

  return (
    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
      {events.map((event) => (
        <EventCard key={event.id} event={event} />
      ))}
    </div>
  );
}
