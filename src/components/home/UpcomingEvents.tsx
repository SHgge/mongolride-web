import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Calendar, MapPin, Users, ArrowRight, Clock } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import type { Tables } from '../../types/database.types';

type Event = Tables<'events'>;

function formatEventDate(dateStr: string) {
  const d = new Date(dateStr);
  const months = ['1-р сар','2-р сар','3-р сар','4-р сар','5-р сар','6-р сар','7-р сар','8-р сар','9-р сар','10-р сар','11-р сар','12-р сар'];
  return { day: d.getDate(), month: months[d.getMonth()], time: d.toLocaleTimeString('mn-MN', { hour: '2-digit', minute: '2-digit' }) };
}

export default function UpcomingEvents() {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from('events')
      .select('*')
      .eq('status', 'upcoming')
      .gte('event_date', new Date().toISOString())
      .order('event_date', { ascending: true })
      .limit(3)
      .then(({ data }) => {
        setEvents(data ?? []);
        setLoading(false);
      });
  }, []);

  return (
    <section className="bg-gray-50 py-16 md:py-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-end justify-between mb-10">
          <div>
            <h2 className="text-3xl font-bold text-gray-900 mb-2">Удахгүй болох арга хэмжээ</h2>
            <p className="text-gray-500">Бидэнтэй хамт дугуйлаарай</p>
          </div>
          <Link to="/events" className="hidden sm:inline-flex items-center gap-1 text-primary-600 font-medium hover:text-primary-700">
            Бүгдийг үзэх <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        {loading ? (
          <div className="grid md:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white rounded-2xl h-64 animate-pulse" />
            ))}
          </div>
        ) : events.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-2xl border border-gray-100">
            <Calendar className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p className="text-gray-400 mb-4">Одоогоор товлосон арга хэмжээ байхгүй</p>
            <Link to="/events" className="text-primary-600 font-medium hover:text-primary-700">Бүх арга хэмжээ үзэх</Link>
          </div>
        ) : (
          <div className="grid md:grid-cols-3 gap-6">
            {events.map((event) => {
              const { day, month, time } = formatEventDate(event.event_date);
              const spotsLeft = event.max_participants ? event.max_participants - event.current_participants : null;
              return (
                <Link
                  key={event.id}
                  to={`/events/${event.id}`}
                  className="group bg-white rounded-2xl border border-gray-100 p-6 hover:shadow-lg hover:border-gray-200 transition-all duration-300"
                >
                  <div className="flex items-start gap-4 mb-4">
                    <div className="flex-shrink-0 w-14 h-14 bg-primary-50 rounded-xl flex flex-col items-center justify-center">
                      <span className="text-xl font-bold text-primary-700 leading-none">{day}</span>
                      <span className="text-[10px] text-primary-500 font-medium">{month}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-lg font-semibold text-gray-900 group-hover:text-primary-600 transition-colors truncate">
                        {event.title}
                      </h3>
                      <div className="flex items-center gap-1 text-sm text-gray-400 mt-1">
                        <Clock className="w-3.5 h-3.5" /> {time}
                      </div>
                    </div>
                  </div>
                  <p className="text-sm text-gray-500 mb-4 line-clamp-2">{event.description}</p>
                  <div className="flex items-center justify-between text-sm">
                    {event.meeting_address && (
                      <span className="flex items-center gap-1 text-gray-400">
                        <MapPin className="w-4 h-4" />
                        <span className="truncate max-w-[140px]">{event.meeting_address}</span>
                      </span>
                    )}
                    <span className="flex items-center gap-1 text-gray-400 ml-auto">
                      <Users className="w-4 h-4" />
                      {event.current_participants}
                      {event.max_participants && `/${event.max_participants}`}
                    </span>
                  </div>
                  {spotsLeft !== null && spotsLeft <= 5 && spotsLeft > 0 && (
                    <div className="mt-3 text-xs font-medium text-orange-600 bg-orange-50 rounded-lg px-3 py-1.5 text-center">
                      Зөвхөн {spotsLeft} суудал үлдсэн!
                    </div>
                  )}
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
