import { useState } from 'react';
import { Plus } from 'lucide-react';
import RouteManagement from '../components/admin/RouteManagement';
import AdminRouteForm from '../components/admin/AdminRouteForm';

type Mode = { type: 'list' } | { type: 'create' } | { type: 'edit'; id: string };

export default function AdminRoutesPage() {
  const [mode, setMode] = useState<Mode>({ type: 'list' });
  const [refreshKey, setRefreshKey] = useState(0);

  if (mode.type === 'create' || mode.type === 'edit') {
    return (
      <AdminRouteForm
        routeId={mode.type === 'edit' ? mode.id : undefined}
        onCancel={() => setMode({ type: 'list' })}
        onSaved={() => { setMode({ type: 'list' }); setRefreshKey((k) => k + 1); }}
      />
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Маршрутууд</h1>
        <button
          onClick={() => setMode({ type: 'create' })}
          className="flex items-center gap-2 px-4 py-2.5 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700"
        >
          <Plus className="w-4 h-4" /> Маршрут нэмэх
        </button>
      </div>
      <RouteManagement
        key={refreshKey}
        onEdit={(id) => setMode({ type: 'edit', id })}
      />
    </div>
  );
}
