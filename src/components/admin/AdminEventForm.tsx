import { useState } from 'react';
import { ArrowLeft, Loader2, Calendar } from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import { ImageUpload } from '../common';
import type { Tables, EventStatus } from '../../types/database.types';

type Event = Tables<'events'>;

interface AdminEventFormProps {
  event?: Event | null;
  onCancel: () => void;
  onSaved: () => void;
}

export default function AdminEventForm({ event, onCancel, onSaved }: AdminEventFormProps) {
  const { user } = useAuth();
  const isEdit = !!event;

  const [title, setTitle] = useState(event?.title ?? '');
  const [description, setDescription] = useState(event?.description ?? '');
  const [eventDate, setEventDate] = useState(event?.event_date ? event.event_date.slice(0, 16) : '');
  const [endDate, setEndDate] = useState(event?.end_date ? event.end_date.slice(0, 16) : '');
  const [meetingAddress, setMeetingAddress] = useState(event?.meeting_address ?? '');
  const [maxParticipants, setMaxParticipants] = useState(event?.max_participants ?? '');
  const [status, setStatus] = useState<EventStatus>(event?.status ?? 'upcoming');
  const [images, setImages] = useState<string[]>(event?.images ?? []);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !eventDate) {
      toast.error('Гарчиг болон огноо оруулна уу');
      return;
    }
    setSubmitting(true);

    const data = {
      title: title.trim(),
      description: description.trim() || null,
      event_date: new Date(eventDate).toISOString(),
      end_date: endDate ? new Date(endDate).toISOString() : null,
      meeting_address: meetingAddress.trim() || null,
      max_participants: maxParticipants ? Number(maxParticipants) : null,
      status,
      images,
      created_by: event?.created_by ?? user?.id ?? null,
    };

    const { error } = isEdit
      ? await supabase.from('events').update(data).eq('id', event.id)
      : await supabase.from('events').insert(data);

    if (error) {
      toast.error(isEdit ? 'Засахад алдаа гарлаа' : 'Нэмэхэд алдаа гарлаа');
    } else {
      toast.success(isEdit ? 'Арга хэмжээ шинэчлэгдлээ' : 'Арга хэмжээ нэмэгдлээ');
      onSaved();
    }
    setSubmitting(false);
  };

  const STATUSES: { value: EventStatus; label: string }[] = [
    { value: 'upcoming', label: 'Удахгүй' },
    { value: 'ongoing', label: 'Явагдаж буй' },
    { value: 'completed', label: 'Дууссан' },
    { value: 'cancelled', label: 'Цуцлагдсан' },
  ];

  return (
    <div className="max-w-2xl">
      <button onClick={onCancel} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-6">
        <ArrowLeft className="w-4 h-4" /> Буцах
      </button>
      <div className="bg-white border border-gray-100 rounded-2xl p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-primary-100 rounded-xl flex items-center justify-center">
            <Calendar className="w-5 h-5 text-primary-600" />
          </div>
          <h2 className="text-xl font-bold text-gray-900">{isEdit ? 'Арга хэмжээ засах' : 'Шинэ арга хэмжээ'}</h2>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Гарчиг *</label>
            <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Арга хэмжээний нэр" className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Тайлбар</label>
            <textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Дэлгэрэнгүй тайлбар..." className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 resize-none" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Эхлэх огноо *</label>
              <input type="datetime-local" value={eventDate} onChange={(e) => setEventDate(e.target.value)} className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Дуусах огноо</label>
              <input type="datetime-local" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Цуглах газар</label>
              <input type="text" value={meetingAddress} onChange={(e) => setMeetingAddress(e.target.value)} placeholder="Зайсан толгой" className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Хамгийн их оролцогч</label>
              <input type="number" value={maxParticipants} onChange={(e) => setMaxParticipants(e.target.value)} placeholder="50" className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Төлөв</label>
            <div className="flex flex-wrap gap-2">
              {STATUSES.map((s) => (
                <button key={s.value} type="button" onClick={() => setStatus(s.value)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${status === s.value ? 'bg-primary-100 text-primary-700 ring-1 ring-primary-300' : 'bg-gray-50 text-gray-600 hover:bg-gray-100'}`}>
                  {s.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Зурагнууд</label>
            <ImageUpload bucket="routes" folder="events" multiple onUpload={() => {}} onMultiUpload={setImages} existingUrls={images} />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onCancel} className="flex-1 py-2.5 text-center border border-gray-200 text-sm font-medium text-gray-700 rounded-lg hover:bg-gray-50">Цуцлах</button>
            <button type="submit" disabled={submitting} className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 disabled:opacity-50 transition-colors">
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              {isEdit ? 'Хадгалах' : 'Нэмэх'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
