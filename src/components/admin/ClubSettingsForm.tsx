import { useEffect, useState } from 'react';
import { Loader2, Save, Globe, Mail, Phone, Image as ImageIcon, Upload, X, Link2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../../lib/supabase';
import { logAudit } from '../../lib/audit';

const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/svg+xml', 'image/webp'];
const MAX_SIZE = 2 * 1024 * 1024;

interface Settings {
  name: string;
  description: string;
  logo_path: string | null;
  contact_email: string;
  contact_phone: string;
  facebook_url: string;
  instagram_url: string;
  website_url: string;
  rejection_cooldown_days: number;
}

export default function ClubSettingsForm() {
  const [s, setS] = useState<Settings>({
    name: '', description: '', logo_path: null,
    contact_email: '', contact_phone: '',
    facebook_url: '', instagram_url: '', website_url: '',
    rejection_cooldown_days: 30,
  });
  const [original, setOriginal] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);

  useEffect(() => {
    supabase.from('club_settings').select('*').eq('id', 1).single()
      .then(({ data }) => {
        if (data) {
          const init: Settings = {
            name: data.name ?? '',
            description: data.description ?? '',
            logo_path: data.logo_path,
            contact_email: data.contact_email ?? '',
            contact_phone: data.contact_phone ?? '',
            facebook_url: data.facebook_url ?? '',
            instagram_url: data.instagram_url ?? '',
            website_url: data.website_url ?? '',
            rejection_cooldown_days: data.rejection_cooldown_days ?? 30,
          };
          setS(init);
          setOriginal(init);
        }
        setLoading(false);
      });
  }, []);

  const logoUrl = s.logo_path
    ? supabase.storage.from('club-assets').getPublicUrl(s.logo_path).data.publicUrl
    : null;

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_SIZE) { toast.error('Файлын хэмжээ 2MB-аас бага байх ёстой'); return; }
    if (!ALLOWED_TYPES.includes(file.type)) { toast.error('Зөвхөн PNG, JPG, SVG, WebP формат хүлээн авна'); return; }

    setUploadingLogo(true);
    try {
      const ext = file.type.split('/')[1].replace('jpeg', 'jpg').replace('svg+xml', 'svg');
      const path = `logo/${crypto.randomUUID()}.${ext}`;

      const { error: uploadErr } = await supabase.storage
        .from('club-assets')
        .upload(path, file, { contentType: file.type, upsert: false });
      if (uploadErr) throw uploadErr;

      // Old logo цэвэрлэх
      if (s.logo_path) {
        await supabase.storage.from('club-assets').remove([s.logo_path]);
      }

      const { error: updateErr } = await supabase
        .from('club_settings')
        .update({ logo_path: path, updated_at: new Date().toISOString() })
        .eq('id', 1);
      if (updateErr) throw updateErr;

      setS({ ...s, logo_path: path });
      toast.success('Лого шинэчлэгдлээ');
      await logAudit('club.logo_changed', undefined, { path });
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setUploadingLogo(false);
      if (e.target) e.target.value = '';
    }
  };

  const removeLogo = async () => {
    if (!s.logo_path) return;
    await supabase.storage.from('club-assets').remove([s.logo_path]);
    await supabase.from('club_settings').update({ logo_path: null }).eq('id', 1);
    setS({ ...s, logo_path: null });
    toast.success('Лого устгагдлаа');
    await logAudit('club.logo_changed', undefined, { removed: true });
  };

  const handleSave = async () => {
    if (!s.name.trim()) { toast.error('Нэр шаардлагатай'); return; }
    if (s.description.length > 2000) { toast.error('Тайлбар 2000 тэмдэгтээс хэтэрсэн'); return; }

    setSaving(true);
    const updates = {
      name: s.name.trim(),
      description: s.description,
      contact_email: s.contact_email || null,
      contact_phone: s.contact_phone || null,
      facebook_url: s.facebook_url || null,
      instagram_url: s.instagram_url || null,
      website_url: s.website_url || null,
      rejection_cooldown_days: s.rejection_cooldown_days,
      updated_at: new Date().toISOString(),
    };
    const { error } = await supabase.from('club_settings').update(updates).eq('id', 1);
    if (error) {
      toast.error('Хадгалахад алдаа гарлаа');
      setSaving(false);
      return;
    }

    // Diff for audit
    const changed: string[] = [];
    if (original) {
      const u = updates as unknown as Record<string, unknown>;
      const o = original as unknown as Record<string, unknown>;
      Object.keys(u).forEach((k) => {
        if (k === 'updated_at') return;
        if (u[k] !== o[k]) changed.push(k);
      });
    }
    await logAudit('club.updated', undefined, { changed_fields: changed });

    setOriginal(s);
    toast.success('Тохиргоо хадгалагдлаа');
    setSaving(false);
  };

  if (loading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 text-primary-600 animate-spin" /></div>;
  }

  return (
    <div className="max-w-3xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Клубын тохиргоо</h1>
        <p className="text-gray-500 text-sm mt-1">Клубын ерөнхий мэдээлэл болон тохиргоо</p>
      </div>

      {/* Logo */}
      <div className="bg-white border border-gray-100 rounded-xl p-6 mb-6">
        <div className="flex items-center gap-2 mb-4">
          <ImageIcon className="w-5 h-5 text-primary-600" />
          <h2 className="text-lg font-semibold text-gray-900">Лого</h2>
        </div>
        <div className="flex items-center gap-6">
          <div className="w-24 h-24 bg-gray-50 border border-gray-200 rounded-xl flex items-center justify-center overflow-hidden flex-shrink-0">
            {logoUrl ? (
              <img src={logoUrl} alt="Club logo" className="w-full h-full object-contain" />
            ) : (
              <ImageIcon className="w-8 h-8 text-gray-300" />
            )}
          </div>
          <div className="flex-1">
            <label className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 cursor-pointer transition-colors">
              {uploadingLogo ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              Лого солих
              <input type="file" accept="image/png,image/jpeg,image/svg+xml,image/webp" onChange={handleLogoUpload} className="hidden" />
            </label>
            {s.logo_path && (
              <button onClick={removeLogo} className="ml-2 inline-flex items-center gap-1 px-4 py-2 border border-gray-200 text-sm text-gray-600 rounded-lg hover:bg-gray-50">
                <X className="w-4 h-4" /> Устгах
              </button>
            )}
            <p className="text-xs text-gray-400 mt-2">PNG, JPG, SVG, WebP. Хамгийн их 2MB.</p>
          </div>
        </div>
      </div>

      {/* General info */}
      <div className="bg-white border border-gray-100 rounded-xl p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Ерөнхий мэдээлэл</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Клубын нэр *</label>
            <input type="text" value={s.name} onChange={(e) => setS({ ...s, name: e.target.value })}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Тайлбар <span className="text-xs text-gray-400">({s.description.length}/2000)</span>
            </label>
            <textarea rows={4} value={s.description} maxLength={2000}
              onChange={(e) => setS({ ...s, description: e.target.value })}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 resize-none" />
          </div>
        </div>
      </div>

      {/* Contact */}
      <div className="bg-white border border-gray-100 rounded-xl p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Холбоо барих</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5"><Mail className="w-4 h-4 inline mr-1" /> И-мэйл</label>
            <input type="email" value={s.contact_email} onChange={(e) => setS({ ...s, contact_email: e.target.value })}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5"><Phone className="w-4 h-4 inline mr-1" /> Утас</label>
            <input type="text" value={s.contact_phone} onChange={(e) => setS({ ...s, contact_phone: e.target.value })}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5"><Globe className="w-4 h-4 inline mr-1" /> Вебсайт</label>
            <input type="url" value={s.website_url} placeholder="https://..." onChange={(e) => setS({ ...s, website_url: e.target.value })}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5"><Link2 className="w-4 h-4 inline mr-1" /> Facebook</label>
              <input type="url" value={s.facebook_url} placeholder="https://facebook.com/..." onChange={(e) => setS({ ...s, facebook_url: e.target.value })}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5"><Link2 className="w-4 h-4 inline mr-1" /> Instagram</label>
              <input type="url" value={s.instagram_url} placeholder="https://instagram.com/..." onChange={(e) => setS({ ...s, instagram_url: e.target.value })}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500" />
            </div>
          </div>
        </div>
      </div>

      {/* Membership policy */}
      <div className="bg-white border border-gray-100 rounded-xl p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Гишүүнчлэлийн бодлого</h2>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Татгалзсаны дараах хүлээх хугацаа (өдөр)</label>
          <input type="number" min={1} max={365} value={s.rejection_cooldown_days}
            onChange={(e) => setS({ ...s, rejection_cooldown_days: Number(e.target.value) || 30 })}
            className="w-32 px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500" />
          <p className="text-xs text-gray-400 mt-1">Татгалзсан хэрэглэгч хэдэн өдрийн дараа дахин хүсэлт явуулж болох вэ</p>
        </div>
      </div>

      <div className="flex justify-end">
        <button onClick={handleSave} disabled={saving}
          className="flex items-center gap-2 px-6 py-2.5 bg-primary-600 text-white font-medium rounded-lg hover:bg-primary-700 disabled:opacity-50">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Хадгалах
        </button>
      </div>
    </div>
  );
}
