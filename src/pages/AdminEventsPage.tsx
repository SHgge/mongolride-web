import { useState } from 'react';
import { Plus } from 'lucide-react';
import EventManagement from '../components/admin/EventManagement';
import AdminEventForm from '../components/admin/AdminEventForm';

type Mode = { type: 'list' } | { type: 'create' } | { type: 'edit'; id: string };

export default function AdminEventsPage() {
  const [mode, setMode] = useState<Mode>({ type: 'list' });
  const [refreshKey, setRefreshKey] = useState(0);

  if (mode.type === 'create' || mode.type === 'edit') {
    return (
      <AdminEventForm
        eventId={mode.type === 'edit' ? mode.id : undefined}
        onCancel={() => setMode({ type: 'list' })}
        onSaved={() => { setMode({ type: 'list' }); setRefreshKey(k => k + 1); }}
      />
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Арга хэмжээ</h1>
        <button onClick={() => setMode({ type: 'create' })}
          className="flex items-center gap-2 px-4 py-2.5 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700">
          <Plus className="w-4 h-4" /> Арга хэмжээ нэмэх
        </button>
      </div>
      <EventManagement
        key={refreshKey}
        onEdit={(id) => setMode({ type: 'edit', id })}
      />
    </div>
  );
}
