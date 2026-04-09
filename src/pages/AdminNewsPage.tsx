import { useState } from 'react';
import { Plus } from 'lucide-react';
import NewsManagement from '../components/admin/NewsManagement';
import AdminNewsForm from '../components/admin/AdminNewsForm';

export default function AdminNewsPage() {
  const [showForm, setShowForm] = useState(false);

  if (showForm) {
    return <AdminNewsForm onCancel={() => setShowForm(false)} onSaved={() => setShowForm(false)} />;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Мэдээ & Нийтлэл</h1>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 transition-colors"
        >
          <Plus className="w-4 h-4" /> Мэдээ нэмэх
        </button>
      </div>
      <NewsManagement />
    </div>
  );
}
