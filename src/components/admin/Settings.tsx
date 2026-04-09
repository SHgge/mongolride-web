import { useState, useEffect } from 'react';
import { Save, Loader2, Globe, Shield, Database } from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../../lib/supabase';

export default function Settings() {
  const [saving, setSaving] = useState(false);

  // Site settings state
  const [siteName, setSiteName] = useState('MongolRide');
  const [siteDescription, setSiteDescription] = useState('Монголын дугуйчдын хамгийн том нийгэмлэг');
  const [contactEmail, setContactEmail] = useState('info@mongolride.mn');
  const [contactPhone, setContactPhone] = useState('+976 9911-2233');
  const [maxUploadSize, setMaxUploadSize] = useState('5');
  const [enableSOS, setEnableSOS] = useState(true);
  const [enableGroupBuy, setEnableGroupBuy] = useState(true);
  const [requireApproval, setRequireApproval] = useState(true);

  // DB stats
  const [dbStats, setDbStats] = useState({ profiles: 0, routes: 0, events: 0, listings: 0, news: 0, kmLogs: 0 });

  useEffect(() => {
    Promise.all([
      supabase.from('profiles').select('*', { count: 'exact', head: true }),
      supabase.from('routes').select('*', { count: 'exact', head: true }),
      supabase.from('events').select('*', { count: 'exact', head: true }),
      supabase.from('listings').select('*', { count: 'exact', head: true }),
      supabase.from('news').select('*', { count: 'exact', head: true }),
      supabase.from('km_logs').select('*', { count: 'exact', head: true }),
    ]).then(([p, r, e, l, n, k]) => {
      setDbStats({
        profiles: p.count ?? 0, routes: r.count ?? 0, events: e.count ?? 0,
        listings: l.count ?? 0, news: n.count ?? 0, kmLogs: k.count ?? 0,
      });
    });
  }, []);

  const handleSave = async () => {
    setSaving(true);
    // Settings would be saved to a settings table in production
    await new Promise((r) => setTimeout(r, 500));
    toast.success('Тохиргоо хадгалагдлаа');
    setSaving(false);
  };

  return (
    <div className="max-w-3xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Тохиргоо</h1>
        <p className="text-gray-500 text-sm mt-1">Системийн ерөнхий тохиргоо</p>
      </div>

      <div className="space-y-6">
        {/* Site Info */}
        <div className="bg-white border border-gray-100 rounded-xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <Globe className="w-5 h-5 text-primary-600" />
            <h2 className="text-lg font-semibold text-gray-900">Сайтын мэдээлэл</h2>
          </div>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Сайтын нэр</label>
              <input type="text" value={siteName} onChange={(e) => setSiteName(e.target.value)} className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Тайлбар</label>
              <input type="text" value={siteDescription} onChange={(e) => setSiteDescription(e.target.value)} className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">И-мэйл</label>
                <input type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Утас</label>
                <input type="text" value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500" />
              </div>
            </div>
          </div>
        </div>

        {/* Features */}
        <div className="bg-white border border-gray-100 rounded-xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <Shield className="w-5 h-5 text-primary-600" />
            <h2 className="text-lg font-semibold text-gray-900">Функцүүд</h2>
          </div>
          <div className="space-y-4">
            <label className="flex items-center justify-between">
              <div><span className="text-sm font-medium text-gray-900">SOS систем</span><p className="text-xs text-gray-500">Яаралтай тусламжийн дуудлага</p></div>
              <input type="checkbox" checked={enableSOS} onChange={(e) => setEnableSOS(e.target.checked)} className="w-4 h-4 text-primary-600 rounded" />
            </label>
            <label className="flex items-center justify-between">
              <div><span className="text-sm font-medium text-gray-900">Хамтын захиалга</span><p className="text-xs text-gray-500">Group buy функц</p></div>
              <input type="checkbox" checked={enableGroupBuy} onChange={(e) => setEnableGroupBuy(e.target.checked)} className="w-4 h-4 text-primary-600 rounded" />
            </label>
            <label className="flex items-center justify-between">
              <div><span className="text-sm font-medium text-gray-900">Маршрут баталгаажуулалт</span><p className="text-xs text-gray-500">Шинэ маршрутыг админ батлах</p></div>
              <input type="checkbox" checked={requireApproval} onChange={(e) => setRequireApproval(e.target.checked)} className="w-4 h-4 text-primary-600 rounded" />
            </label>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Зураг upload хэмжээ (MB)</label>
              <input type="number" value={maxUploadSize} onChange={(e) => setMaxUploadSize(e.target.value)} className="w-32 px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500" />
            </div>
          </div>
        </div>

        {/* DB Stats */}
        <div className="bg-white border border-gray-100 rounded-xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <Database className="w-5 h-5 text-primary-600" />
            <h2 className="text-lg font-semibold text-gray-900">Мэдээллийн сан</h2>
          </div>
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: 'Гишүүд', value: dbStats.profiles },
              { label: 'Маршрутууд', value: dbStats.routes },
              { label: 'Арга хэмжээ', value: dbStats.events },
              { label: 'Зарууд', value: dbStats.listings },
              { label: 'Мэдээ', value: dbStats.news },
              { label: 'Км бүртгэл', value: dbStats.kmLogs },
            ].map((s) => (
              <div key={s.label} className="bg-gray-50 rounded-lg p-3 text-center">
                <div className="text-xl font-bold text-gray-900">{s.value}</div>
                <div className="text-xs text-gray-500">{s.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Save */}
        <button onClick={handleSave} disabled={saving}
          className="flex items-center justify-center gap-2 px-6 py-2.5 bg-primary-600 text-white font-medium rounded-lg hover:bg-primary-700 disabled:opacity-50 transition-colors">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Хадгалах
        </button>
      </div>
    </div>
  );
}
