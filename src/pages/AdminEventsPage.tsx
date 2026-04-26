import { useState } from 'react';
import { Plus } from 'lucide-react';
import EventManagement from '../components/admin/EventManagement';
import AdminEventForm from '../components/admin/AdminEventForm';

export default function AdminEventsPage() {
  const [showForm, setShowForm] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  if (showForm) {
    return <AdminEventForm onCancel={() => setShowForm(false)} onSaved={() => { setShowForm(false); setRefreshKey(k => k + 1); }} />;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Арга хэмжээ</h1>
        <button onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700">
          <Plus className="w-4 h-4" /> Арга хэмжээ нэмэх
        </button>
      </div>
      <EventManagement key={refreshKey} />
    </div>
  );
}
