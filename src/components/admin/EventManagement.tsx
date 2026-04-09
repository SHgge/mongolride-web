import { useEffect, useState } from 'react';
import { Edit2, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../../lib/supabase';
import type { Tables, EventStatus } from '../../types/database.types';

type Event = Tables<'events'>;

const STATUS_COLORS: Record<string, string> = {
  upcoming: 'bg-blue-100 text-blue-700',
  ongoing: 'bg-green-100 text-green-700',
  completed: 'bg-gray-100 text-gray-600',
  cancelled: 'bg-red-100 text-red-700',
};

const STATUS_LABELS: Record<string, string> = {
  upcoming: 'Удахгүй', ongoing: 'Явагдаж буй', completed: 'Дууссан', cancelled: 'Цуцлагдсан',
};

export default function EventManagement() {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingStatus, setEditingStatus] = useState<string | null>(null);

  useEffect(() => {
    supabase.from('events').select('*').order('event_date', { ascending: false })
      .then(({ data }) => { setEvents(data ?? []); setLoading(false); });
  }, []);

  const updateStatus = async (id: string, status: EventStatus) => {
    const { error } = await supabase.from('events').update({ status }).eq('id', id);
    if (!error) {
      setEvents((prev) => prev.map((e) => (e.id === id ? { ...e, status } : e)));
    }
    setEditingStatus(null);
  };

  const deleteEvent = async (id: string) => {
    if (!confirm('Энэ арга хэмжээг устгах уу?')) return;
    const { error } = await supabase.from('events').delete().eq('id', id);
    if (!error) {
      setEvents((prev) => prev.filter((e) => e.id !== id));
      toast.success('Арга хэмжээ устгагдлаа');
    } else {
      toast.error('Устгахад алдаа гарлаа');
    }
  };

  return (
    <div>
      <p className="text-gray-500 text-sm mb-4">{events.length} арга хэмжээ</p>

      <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              <th className="text-left px-4 py-3 font-medium text-gray-500">Арга хэмжээ</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Огноо</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Оролцогчид</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Төлөв</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="border-b border-gray-50">
                  <td colSpan={4} className="px-4 py-4"><div className="h-6 bg-gray-100 rounded animate-pulse" /></td>
                </tr>
              ))
            ) : events.length === 0 ? (
              <tr><td colSpan={4} className="px-4 py-12 text-center text-gray-400">Арга хэмжээ байхгүй</td></tr>
            ) : (
              events.map((event) => (
                <tr key={event.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900">{event.title}</div>
                    {event.meeting_address && <div className="text-xs text-gray-400">{event.meeting_address}</div>}
                  </td>
                  <td className="px-4 py-3 text-gray-600 text-xs">
                    {new Date(event.event_date).toLocaleDateString('mn-MN')}
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-gray-900 font-medium">{event.current_participants}</span>
                    {event.max_participants && <span className="text-gray-400">/{event.max_participants}</span>}
                  </td>
                  <td className="px-4 py-3">
                    <div className="relative">
                      <button onClick={() => setEditingStatus(editingStatus === event.id ? null : event.id)}
                        className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium cursor-pointer hover:opacity-80 ${STATUS_COLORS[event.status]}`}>
                        {STATUS_LABELS[event.status]} <Edit2 className="w-3 h-3" />
                      </button>
                      {editingStatus === event.id && (
                        <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg py-1 z-10 min-w-[140px]">
                          {(['upcoming', 'ongoing', 'completed', 'cancelled'] as EventStatus[]).map((s) => (
                            <button key={s} onClick={() => updateStatus(event.id, s)}
                              className={`block w-full text-left px-3 py-2 text-xs hover:bg-gray-50 ${STATUS_COLORS[s]} bg-transparent`}>
                              {STATUS_LABELS[s]}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    <button onClick={() => deleteEvent(event.id)} className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg ml-1" title="Устгах">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
