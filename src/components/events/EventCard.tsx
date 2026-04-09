import { Link } from 'react-router-dom';
import { MapPin, Users } from 'lucide-react';
import type { Tables } from '../../types/database.types';

type Event = Tables<'events'>;

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  upcoming: { label: 'Удахгүй', color: 'bg-blue-100 text-blue-700' },
  ongoing: { label: 'Явагдаж байна', color: 'bg-green-100 text-green-700' },
  completed: { label: 'Дууссан', color: 'bg-gray-100 text-gray-600' },
  cancelled: { label: 'Цуцлагдсан', color: 'bg-red-100 text-red-600' },
};

function formatEventDate(dateStr: string) {
  const d = new Date(dateStr);
  const months = ['1-р сар','2-р сар','3-р сар','4-р сар','5-р сар','6-р сар','7-р сар','8-р сар','9-р сар','10-р сар','11-р сар','12-р сар'];
  return {
    day: d.getDate(),
    month: months[d.getMonth()],
    time: d.toLocaleTimeString('mn-MN', { hour: '2-digit', minute: '2-digit' }),
    weekday: d.toLocaleDateString('mn-MN', { weekday: 'short' }),
  };
}

export default function EventCard({ event }: { event: Event }) {
  const { day, month, time, weekday } = formatEventDate(event.event_date);
  const status = STATUS_LABELS[event.status] ?? STATUS_LABELS.upcoming;
  const spotsLeft = event.max_participants ? event.max_participants - event.current_participants : null;
  const isFull = spotsLeft !== null && spotsLeft <= 0;

  return (
    <Link
      to={`/events/${event.id}`}
      className="group bg-white rounded-2xl border border-gray-100 overflow-hidden hover:shadow-lg hover:border-gray-200 transition-all duration-300"
    >
      {/* Image / gradient header */}
      <div className="h-36 bg-gradient-to-br from-primary-600 to-primary-500 relative flex items-end p-4">
        {event.images?.[0] ? (
          <img src={event.images[0]} alt={event.title} className="absolute inset-0 w-full h-full object-cover" />
        ) : null}
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
        <div className="relative flex items-end justify-between w-full">
          <div className="flex items-center gap-3">
            <div className="bg-white rounded-xl px-3 py-2 text-center shadow-sm">
              <div className="text-xl font-bold text-gray-900 leading-none">{day}</div>
              <div className="text-[10px] text-gray-500 mt-0.5">{month}</div>
            </div>
            <div>
              <h3 className="text-white font-semibold text-lg leading-tight">{event.title}</h3>
              <span className="text-white/70 text-xs">{weekday}, {time}</span>
            </div>
          </div>
          <span className={`px-2 py-0.5 rounded-md text-xs font-medium ${status.color}`}>
            {status.label}
          </span>
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        <p className="text-sm text-gray-500 line-clamp-2 mb-3">{event.description}</p>

        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-3 text-gray-400">
            {event.meeting_address && (
              <span className="flex items-center gap-1 truncate max-w-[160px]">
                <MapPin className="w-3.5 h-3.5 flex-shrink-0" /> {event.meeting_address}
              </span>
            )}
          </div>
          <span className="flex items-center gap-1 text-gray-400">
            <Users className="w-3.5 h-3.5" />
            {event.current_participants}{event.max_participants ? `/${event.max_participants}` : ''}
          </span>
        </div>

        {isFull && (
          <div className="mt-3 text-xs font-medium text-red-600 bg-red-50 rounded-lg px-3 py-1.5 text-center">
            Бүртгэл дүүрсэн
          </div>
        )}
        {spotsLeft !== null && spotsLeft > 0 && spotsLeft <= 5 && (
          <div className="mt-3 text-xs font-medium text-orange-600 bg-orange-50 rounded-lg px-3 py-1.5 text-center">
            Зөвхөн {spotsLeft} суудал үлдсэн!
          </div>
        )}
      </div>
    </Link>
  );
}
