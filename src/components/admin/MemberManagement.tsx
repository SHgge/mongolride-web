import { useEffect, useState } from 'react';
import { Search, User, ChevronDown, Check, Edit2, UserX, UserCheck } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import toast from 'react-hot-toast';
import type { Tables, UserRole } from '../../types/database.types';
import { RANK_LABELS, RANK_COLORS, type UserRank } from '../../types/user.types';

type Profile = Tables<'profiles'>;

const ROLE_LABELS: Record<UserRole, { label: string; color: string }> = {
  guest: { label: 'Зочин', color: 'bg-gray-100 text-gray-600' },
  member: { label: 'Гишүүн', color: 'bg-blue-100 text-blue-700' },
  admin: { label: 'Админ', color: 'bg-red-100 text-red-700' },
};

export default function MemberManagement() {
  const [members, setMembers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [editingRole, setEditingRole] = useState<string | null>(null);
  const [editMember, setEditMember] = useState<Profile | null>(null);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editBio, setEditBio] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setMembers(data ?? []);
        setLoading(false);
      });
  }, []);

  const handleRoleChange = async (userId: string, newRole: UserRole) => {
    const { error } = await supabase.from('profiles').update({ role: newRole }).eq('id', userId);
    if (!error) {
      setMembers((prev) => prev.map((m) => (m.id === userId ? { ...m, role: newRole } : m)));
    }
    setEditingRole(null);
  };

  const openEdit = (member: Profile) => {
    setEditMember(member);
    setEditName(member.full_name);
    setEditPhone(member.phone ?? '');
    setEditBio(member.bio ?? '');
  };

  const saveEdit = async () => {
    if (!editMember) return;
    setSaving(true);
    const { error } = await supabase.from('profiles').update({
      full_name: editName,
      phone: editPhone || null,
      bio: editBio || null,
    }).eq('id', editMember.id);
    if (!error) {
      setMembers((prev) => prev.map((m) => m.id === editMember.id ? { ...m, full_name: editName, phone: editPhone || null, bio: editBio || null } : m));
      toast.success('Гишүүний мэдээлэл шинэчлэгдлээ');
      setEditMember(null);
    } else {
      toast.error('Шинэчлэхэд алдаа гарлаа');
    }
    setSaving(false);
  };

  const toggleActive = async (userId: string, currentActive: boolean) => {
    const { error } = await supabase.from('profiles').update({ is_active: !currentActive }).eq('id', userId);
    if (!error) {
      setMembers((prev) => prev.map((m) => m.id === userId ? { ...m, is_active: !currentActive } : m));
      toast.success(!currentActive ? 'Гишүүн идэвхжүүлсэн' : 'Гишүүн идэвхгүй болголоо');
    }
  };

  const filtered = members.filter((m) =>
    m.full_name.toLowerCase().includes(search.toLowerCase()) ||
    (m.phone?.includes(search) ?? false)
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Гишүүд</h1>
          <p className="text-gray-500 text-sm mt-1">{members.length} гишүүн</p>
        </div>
      </div>

      {/* Search */}
      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
        <input
          type="text"
          placeholder="Нэр, утасны дугаараар хайх..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
        />
      </div>

      {/* Table */}
      <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-4 py-3 font-medium text-gray-500">Гишүүн</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Зэрэглэл</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Эрх</th>
                <th className="text-right px-4 py-3 font-medium text-gray-500">Нийт км</th>
                <th className="text-right px-4 py-3 font-medium text-gray-500">Унаа</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Огноо</th>
                <th className="text-right px-4 py-3 font-medium text-gray-500">Үйлдэл</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-b border-gray-50">
                    <td colSpan={7} className="px-4 py-4"><div className="h-6 bg-gray-100 rounded animate-pulse" /></td>
                  </tr>
                ))
              ) : filtered.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-12 text-center text-gray-400">Гишүүн олдсонгүй</td></tr>
              ) : (
                filtered.map((member) => {
                  const roleInfo = ROLE_LABELS[member.role] ?? ROLE_LABELS.member;
                  const rankColor = RANK_COLORS[member.rank as UserRank] ?? '#9ca3af';
                  const rankLabel = RANK_LABELS[member.rank as UserRank] ?? member.rank;

                  return (
                    <tr key={member.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center overflow-hidden">
                            {member.avatar_url ? (
                              <img src={member.avatar_url} alt="" className="w-8 h-8 rounded-full object-cover" />
                            ) : (
                              <User className="w-4 h-4 text-gray-400" />
                            )}
                          </div>
                          <div>
                            <div className="font-medium text-gray-900">{member.full_name}</div>
                            {member.phone && <div className="text-xs text-gray-400">{member.phone}</div>}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium text-white" style={{ backgroundColor: rankColor }}>
                          {rankLabel}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="relative">
                          <button
                            onClick={() => setEditingRole(editingRole === member.id ? null : member.id)}
                            className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium ${roleInfo.color} cursor-pointer hover:opacity-80`}
                          >
                            {roleInfo.label} <ChevronDown className="w-3 h-3" />
                          </button>
                          {editingRole === member.id && (
                            <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg py-1 z-10 min-w-[120px]">
                              {(['guest', 'member', 'admin'] as UserRole[]).map((r) => (
                                <button
                                  key={r}
                                  onClick={() => handleRoleChange(member.id, r)}
                                  className="flex items-center justify-between w-full px-3 py-2 text-xs hover:bg-gray-50"
                                >
                                  <span className={`px-1.5 py-0.5 rounded ${ROLE_LABELS[r].color}`}>{ROLE_LABELS[r].label}</span>
                                  {member.role === r && <Check className="w-3.5 h-3.5 text-primary-600" />}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-gray-900">{Number(member.total_km).toLocaleString()}</td>
                      <td className="px-4 py-3 text-right text-gray-500">{member.total_rides}</td>
                      <td className="px-4 py-3 text-gray-400 text-xs">{new Date(member.created_at).toLocaleDateString('mn-MN')}</td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => openEdit(member)} className="p-1.5 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg" title="Засах">
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button onClick={() => toggleActive(member.id, member.is_active)}
                            className={`p-1.5 rounded-lg ${member.is_active ? 'text-orange-400 hover:text-orange-600 hover:bg-orange-50' : 'text-green-400 hover:text-green-600 hover:bg-green-50'}`}
                            title={member.is_active ? 'Идэвхгүй болгох' : 'Идэвхжүүлэх'}>
                            {member.is_active ? <UserX className="w-4 h-4" /> : <UserCheck className="w-4 h-4" />}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit modal */}
      {editMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Гишүүн засах</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Нэр</label>
                <input type="text" value={editName} onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Утас</label>
                <input type="text" value={editPhone} onChange={(e) => setEditPhone(e.target.value)}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Био</label>
                <textarea rows={3} value={editBio} onChange={(e) => setEditBio(e.target.value)}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 resize-none" />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setEditMember(null)} className="flex-1 py-2.5 border border-gray-200 text-sm font-medium text-gray-700 rounded-lg hover:bg-gray-50">Цуцлах</button>
              <button onClick={saveEdit} disabled={saving}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 disabled:opacity-50">
                {saving ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : null}
                Хадгалах
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
