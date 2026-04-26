import { Link } from 'react-router-dom';
import { MapPin, Users, Bike, Mountain } from 'lucide-react';
import type { Tables } from '../../types/database.types';

type Event = Tables<'events'>;

const DISCIPLINE_LABELS: Record<string, string> = {
  road: 'Зам', mtb: 'Уулын', gravel: 'Хайрга', urban: 'Хотын',
  commute: 'Ажилд', bikepacking: 'Аялал', training: 'Сургалт', other: 'Бусад',
};
const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-600', published: 'bg-blue-100 text-blue-700',
  cancelled: 'bg-red-100 text-red-700', completed: 'bg-green-100 text-green-700',
};
const STATUS_LABELS: Record<string, string> = {
  draft: 'Ноорог', published: 'Удахгүй', cancelled: 'Цуцлагдсан', completed: 'Дууссан',
};

function formatDate(d: string) {
  const dt = new Date(d);
  const months = ['1-р сар','2-р сар','3-р сар','4-р сар','5-р сар','6-р сар','7-р сар','8-р сар','9-р сар','10-р сар','11-р сар','12-р сар'];
  return { day: dt.getDate(), month: months[dt.getMonth()], time: dt.toLocaleTimeString('mn-MN', { hour: '2-digit', minute: '2-digit' }) };
}

export default function EventCard({ event, coverUrl }: { event: Event; coverUrl?: string | null }) {
  const { day, month, time } = formatDate(event.meet_at);
  const isUpcoming = event.status === 'published' && new Date(event.meet_at) > new Date();

  return (
    <Link to={`/events/${event.id}`} className="group bg-white rounded-2xl border border-gray-100 overflow-hidden hover:shadow-lg hover:border-gray-200 transition-all">
      <div className="h-36 bg-gradient-to-br from-primary-600 to-primary-500 relative">
        {coverUrl && <img src={coverUrl} alt="" className="absolute inset-0 w-full h-full object-cover" />}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
        <div className="absolute top-3 right-3">
          <span className={`px-2 py-0.5 rounded-md text-xs font-medium ${STATUS_COLORS[event.status]}`}>
            {STATUS_LABELS[event.status]}
          </span>
        </div>
        <div className="absolute bottom-3 left-3 flex items-end gap-3">
          <div className="bg-white rounded-xl px-3 py-1.5 text-center shadow">
            <div className="text-xl font-bold text-gray-900 leading-none">{day}</div>
            <div className="text-[10px] text-gray-500 mt-0.5">{month}</div>
          </div>
          <div className="text-white pb-0.5">
            <h3 className="font-semibold text-base leading-tight line-clamp-1">{event.title}</h3>
            <span className="text-xs text-white/80">{time}</span>
          </div>
        </div>
      </div>
      <div className="p-4">
        <div className="flex flex-wrap gap-1.5 mb-2">
          <span className="text-xs bg-primary-50 text-primary-700 px-2 py-0.5 rounded-md font-medium">
            <Bike className="w-3 h-3 inline mr-1" /> {DISCIPLINE_LABELS[event.discipline] ?? event.discipline}
          </span>
          {event.distance_km && (
            <span className="text-xs bg-gray-50 text-gray-600 px-2 py-0.5 rounded-md">
              <MapPin className="w-3 h-3 inline mr-1" /> {event.distance_km}км
            </span>
          )}
          {event.elevation_gain_m && event.elevation_gain_m > 0 && (
            <span className="text-xs bg-gray-50 text-gray-600 px-2 py-0.5 rounded-md">
              <Mountain className="w-3 h-3 inline mr-1" /> {event.elevation_gain_m}м
            </span>
          )}
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="flex items-center gap-1 text-gray-500 truncate max-w-[180px]">
            <MapPin className="w-3.5 h-3.5" /> {event.meet_location_name}
          </span>
          {event.capacity && (
            <span className="flex items-center gap-1 text-gray-400 text-xs">
              <Users className="w-3.5 h-3.5" /> {event.capacity}
            </span>
          )}
        </div>
        {!isUpcoming && event.status === 'completed' && (
          <div className="mt-2 text-xs text-gray-400">Дууссан</div>
        )}
      </div>
    </Link>
  );
}
