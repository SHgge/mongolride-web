import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Calendar, MapPin, Users, Clock, ArrowLeft, UserPlus, UserMinus, CheckCircle2 } from 'lucide-react';
import { supabase, supabasePublic } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import type { Tables } from '../types/database.types';
import CountdownTimer from '../components/events/CountdownTimer';
import { Loader } from '../components/common';

type Event = Tables<'events'>;

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  upcoming: { label: 'Удахгүй', color: 'bg-blue-100 text-blue-700' },
  ongoing: { label: 'Явагдаж байна', color: 'bg-green-100 text-green-700' },
  completed: { label: 'Дууссан', color: 'bg-gray-100 text-gray-600' },
  cancelled: { label: 'Цуцлагдсан', color: 'bg-red-100 text-red-600' },
};

export default function EventDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user, isAuthenticated } = useAuth();
  const [event, setEvent] = useState<Event | null>(null);
  const [loading, setLoading] = useState(true);
  const [isRegistered, setIsRegistered] = useState(false);
  const [registering, setRegistering] = useState(false);

  // Event авах
  useEffect(() => {
    if (!id) return;
    supabasePublic
      .from('events')
      .select('*')
      .eq('id', id)
      .single()
      .then(({ data }) => {
        setEvent(data);
        setLoading(false);
      });
  }, [id]);

  // Бүртгэл шалгах
  useEffect(() => {
    if (!id || !user) return;
    supabase
      .from('event_participants')
      .select('id')
      .eq('event_id', id)
      .eq('user_id', user.id)
      .then(({ data }) => {
        setIsRegistered((data?.length ?? 0) > 0);
      });
  }, [id, user]);

  // Бүртгүүлэх
  const handleJoin = async () => {
    if (!id || !user || !event) return;
    setRegistering(true);

    const { error } = await supabase
      .from('event_participants')
      .insert({ event_id: id, user_id: user.id });

    if (!error) {
      setIsRegistered(true);
      toast.success('Амжилттай бүртгүүллээ!');
      setEvent({ ...event, current_participants: event.current_participants + 1 });
    }
    setRegistering(false);
  };

  // Бүртгэл цуцлах
  const handleLeave = async () => {
    if (!id || !user || !event) return;
    setRegistering(true);

    const { error } = await supabase
      .from('event_participants')
      .delete()
      .eq('event_id', id)
      .eq('user_id', user.id);

    if (!error) {
      setIsRegistered(false);
      toast.success('Бүртгэл цуцлагдлаа');
      setEvent({ ...event, current_participants: Math.max(0, event.current_participants - 1) });
    }
    setRegistering(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader size="lg" />
      </div>
    );
  }

  if (!event) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-20 text-center">
        <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-3" />
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Арга хэмжээ олдсонгүй</h2>
        <Link to="/events" className="text-primary-600 hover:text-primary-700 font-medium">Бүх арга хэмжээ</Link>
      </div>
    );
  }

  const status = STATUS_LABELS[event.status] ?? STATUS_LABELS.upcoming;
  const eventDate = new Date(event.event_date);
  const isUpcoming = event.status === 'upcoming' && eventDate > new Date();
  const isFull = event.max_participants ? event.current_participants >= event.max_participants : false;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
      <Link to="/events" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-6">
        <ArrowLeft className="w-4 h-4" /> Бүх арга хэмжээ
      </Link>

      {/* Hero */}
      <div className="bg-gradient-to-br from-primary-600 to-primary-500 rounded-2xl p-8 mb-8 text-white relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute -top-10 -right-10 w-60 h-60 bg-white rounded-full" />
        </div>
        <div className="relative">
          <span className={`inline-block px-3 py-1 rounded-lg text-xs font-medium mb-4 ${status.color}`}>
            {status.label}
          </span>
          <h1 className="text-3xl md:text-4xl font-bold mb-3">{event.title}</h1>
          <div className="flex flex-wrap items-center gap-4 text-white/80 text-sm">
            <span className="flex items-center gap-1.5">
              <Calendar className="w-4 h-4" />
              {eventDate.toLocaleDateString('mn-MN', { year: 'numeric', month: 'long', day: 'numeric' })}
            </span>
            <span className="flex items-center gap-1.5">
              <Clock className="w-4 h-4" />
              {eventDate.toLocaleTimeString('mn-MN', { hour: '2-digit', minute: '2-digit' })}
            </span>
            {event.meeting_address && (
              <span className="flex items-center gap-1.5">
                <MapPin className="w-4 h-4" /> {event.meeting_address}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-8">
        {/* Left: Details */}
        <div className="md:col-span-2 space-y-6">
          <div className="bg-white border border-gray-100 rounded-xl p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-3">Тайлбар</h2>
            <p className="text-gray-600 leading-relaxed">{event.description || 'Тайлбар байхгүй.'}</p>
          </div>

          {isUpcoming && (
            <div className="bg-white border border-gray-100 rounded-xl p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-3">Эхлэхэд</h2>
              <CountdownTimer targetDate={event.event_date} />
            </div>
          )}
        </div>

        {/* Right: Sidebar */}
        <div className="space-y-4">
          {/* Participants */}
          <div className="bg-white border border-gray-100 rounded-xl p-5">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Оролцогчид</h3>
            <div className="flex items-center gap-3 mb-3">
              <Users className="w-5 h-5 text-primary-600" />
              <span className="text-2xl font-bold text-gray-900">{event.current_participants}</span>
              {event.max_participants && (
                <span className="text-gray-400">/ {event.max_participants}</span>
              )}
            </div>
            {event.max_participants && (
              <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden mb-3">
                <div
                  className="h-full bg-primary-500 rounded-full transition-all"
                  style={{ width: `${Math.min(100, (event.current_participants / event.max_participants) * 100)}%` }}
                />
              </div>
            )}

            {/* Register / Leave button */}
            {isAuthenticated && isUpcoming && (
              isRegistered ? (
                <div>
                  <div className="flex items-center gap-2 text-sm text-primary-600 mb-2">
                    <CheckCircle2 className="w-4 h-4" /> Та бүртгүүлсэн
                  </div>
                  <button
                    onClick={handleLeave}
                    disabled={registering}
                    className="w-full flex items-center justify-center gap-2 py-2.5 border border-red-200 text-red-600 text-sm font-medium rounded-lg hover:bg-red-50 disabled:opacity-50 transition-colors"
                  >
                    <UserMinus className="w-4 h-4" /> Цуцлах
                  </button>
                </div>
              ) : (
                <button
                  onClick={handleJoin}
                  disabled={registering || isFull}
                  className="w-full flex items-center justify-center gap-2 py-2.5 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 disabled:opacity-50 transition-colors"
                >
                  <UserPlus className="w-4 h-4" />
                  {isFull ? 'Бүртгэл дүүрсэн' : 'Бүртгүүлэх'}
                </button>
              )
            )}
            {!isAuthenticated && isUpcoming && (
              <Link
                to="/login"
                className="block w-full text-center py-2.5 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 transition-colors"
              >
                Нэвтэрч бүртгүүлэх
              </Link>
            )}
          </div>

          {/* Event info */}
          <div className="bg-white border border-gray-100 rounded-xl p-5 space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Огноо</span>
              <span className="text-gray-900 font-medium">{eventDate.toLocaleDateString('mn-MN')}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Цаг</span>
              <span className="text-gray-900 font-medium">{eventDate.toLocaleTimeString('mn-MN', { hour: '2-digit', minute: '2-digit' })}</span>
            </div>
            {event.meeting_address && (
              <div className="flex justify-between">
                <span className="text-gray-500">Байршил</span>
                <span className="text-gray-900 font-medium text-right max-w-[160px]">{event.meeting_address}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-gray-500">Төлөв</span>
              <span className={`px-2 py-0.5 rounded-md text-xs font-medium ${status.color}`}>{status.label}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
