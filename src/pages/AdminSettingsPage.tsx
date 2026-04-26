import { useState } from 'react';
import ClubSettingsForm from '../components/admin/ClubSettingsForm';
import Settings from '../components/admin/Settings';

export default function AdminSettingsPage() {
  const [tab, setTab] = useState<'club' | 'system'>('club');
  return (
    <div>
      <div className="flex gap-2 mb-6 border-b border-gray-100">
        <button onClick={() => setTab('club')}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${tab === 'club' ? 'border-primary-600 text-primary-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
          Клуб
        </button>
        <button onClick={() => setTab('system')}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${tab === 'system' ? 'border-primary-600 text-primary-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
          Систем
        </button>
      </div>
      {tab === 'club' ? <ClubSettingsForm /> : <Settings />}
    </div>
  );
}
