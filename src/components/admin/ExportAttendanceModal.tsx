// EP-09 P1-4: Export attendance modal.
// Calls export-event-attendance Edge Function and triggers a CSV download.

import { useState } from 'react';
import { createPortal } from 'react-dom';
import toast from 'react-hot-toast';
import { Download, Loader2, X, FileText } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface Props {
  eventId: string;
  eventTitle: string;
  onClose: () => void;
}

const FIELDS: Array<{ key: string; label: string; defaultOn: boolean }> = [
  { key: 'name',             label: 'Нэр',                  defaultOn: true },
  { key: 'email',            label: 'И-мэйл',               defaultOn: true },
  { key: 'role',             label: 'Эрх (member/admin)',   defaultOn: true },
  { key: 'rsvp_status',      label: 'RSVP төлөв',           defaultOn: true },
  { key: 'checked_in_at',    label: 'Check-in цаг',         defaultOn: true },
  { key: 'method',           label: 'Уншуулсан хэлбэр',     defaultOn: true },
  { key: 'late',             label: 'Хоцорсон уу',          defaultOn: true },
  { key: 'override',         label: 'Override',              defaultOn: false },
  { key: 'guests',           label: 'Зочны тоо',             defaultOn: false },
  { key: 'emergency',        label: 'Яаралтай холбоо',      defaultOn: true },
  { key: 'notes',            label: 'Тэмдэглэл',            defaultOn: false },
];

export default function ExportAttendanceModal({ eventId, eventTitle, onClose }: Props) {
  const [format] = useState<'csv'>('csv');
  const [selected, setSelected] = useState<Set<string>>(
    new Set(FIELDS.filter((f) => f.defaultOn).map((f) => f.key)),
  );
  const [submitting, setSubmitting] = useState(false);

  const toggle = (key: string) => {
    const next = new Set(selected);
    if (next.has(key)) next.delete(key); else next.add(key);
    setSelected(next);
  };

  const download = async () => {
    setSubmitting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { toast.error('Session байхгүй'); return; }
      const r = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/export-event-attendance`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            event_id: eventId,
            format,
            fields: Array.from(selected),
          }),
        },
      );
      if (!r.ok) {
        toast.error(`Export алдаа: ${r.status} ${(await r.text()).slice(0, 100)}`);
        return;
      }
      const blob = await r.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `attendance-${eventTitle.replace(/\s+/g, '-')}.csv`;
      a.click();
      URL.revokeObjectURL(a.href);
      toast.success('Татаж эхэлсэн');
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] bg-black/50 flex items-center justify-center p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl w-full max-w-md my-auto shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between p-6 border-b border-gray-100">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Оролцоо татах</h2>
            <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{eventTitle}</p>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Формат</label>
            <div className="inline-flex items-center gap-1.5 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm">
              <FileText className="w-4 h-4 text-gray-500" />
              CSV (Excel-MN тохиромжтой UTF-8 BOM)
            </div>
            <p className="text-[10px] text-gray-400 mt-1">XLSX V1.1-д бэлэн болно</p>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-2">Багана сонгох</label>
            <div className="grid grid-cols-2 gap-1.5 max-h-56 overflow-y-auto pr-1">
              {FIELDS.map((f) => (
                <label key={f.key} className="flex items-center gap-2 cursor-pointer text-sm">
                  <input
                    type="checkbox"
                    checked={selected.has(f.key)}
                    onChange={() => toggle(f.key)}
                    className="w-4 h-4 text-primary-600 rounded"
                  />
                  <span className="text-gray-700">{f.label}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 border border-gray-200 text-sm font-medium text-gray-600 rounded-lg hover:bg-gray-50"
            >
              Цуцлах
            </button>
            <button
              type="button"
              onClick={download}
              disabled={submitting || selected.size === 0}
              className="flex-1 inline-flex items-center justify-center gap-1.5 py-2.5 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 disabled:opacity-50"
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              Татах
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
