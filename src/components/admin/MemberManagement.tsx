import { useEffect, useState, useCallback } from 'react';
import { Search, User, ChevronDown, Check, Edit2, UserX, UserCheck, ChevronLeft, ChevronRight } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import toast from 'react-hot-toast';
import type { Tables, UserRole } from '../../types/database.types';
import { RANK_LABELS, RANK_COLORS, type UserRank } from '../../types/user.types';
import { useAuth } from '../../hooks/useAuth';
import { logAudit, AuditActions } from '../../lib/audit';

type Profile = Tables<'profiles'>;

const PAGE_SIZE = 50;

const ROLE_LABELS: Record<UserRole, { label: string; color: string }> = {
  member: { label: 'Гишүүн', color: 'bg-blue-100 text-blue-700' },
  admin: { label: 'Админ', color: 'bg-red-100 text-red-700' },
};

type RoleFilter = 'all' | UserRole;

export default function MemberManagement() {
  const { user: currentUser } = useAuth();

  const [members, setMembers] = useState<Profile[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [totalAdmins, setTotalAdmins] = useState(0);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('all');
  const [page, setPage] = useState(0);

  const [editingRole, setEditingRole] = useState<string | null>(null);
  const [editMember, setEditMember] = useState<Profile | null>(null);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editBio, setEditBio] = useState('');
  const [saving, setSaving] = useState(false);

  // Reset to page 0 when search/filter changes
  useEffect(() => {
    setPage(0);
  }, [search, roleFilter]);

  const fetchMembers = useCallback(async () => {
    setLoading(true);

    let query = supabase
      .from('profiles')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

    if (roleFilter !== 'all') query = query.eq('role', roleFilter);
    if (search.trim()) {
      const s = search.trim();
      query = query.or(`full_name.ilike.%${s}%,phone.ilike.%${s}%`);
    }

    const { data, count, error } = await query;
    if (error) toast.error('Гишүүд ачаалахад алдаа гарлаа');

    setMembers(data ?? []);
    setTotalCount(count ?? 0);
    setLoading(false);

    // Total admin count (defense-in-depth for last admin guard)
    const { count: adminCount } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .eq('role', 'admin');
    setTotalAdmins(adminCount ?? 0);
  }, [page, roleFilter, search]);

  useEffect(() => {
    const timer = setTimeout(() => fetchMembers(), search ? 300 : 0);
    return () => clearTimeout(timer);
  }, [fetchMembers, search]);

  const handleRoleChange = async (member: Profile, newRole: UserRole) => {
    if (member.role === newRole) {
      setEditingRole(null);
      return;
    }

    const fromRole = member.role;
    const { error } = await supabase.from('profiles').update({ role: newRole }).eq('id', member.id);

    if (error) {
      // P0001 = last admin demotion (custom error from DB trigger)
      if (error.code === 'P0001' || /last admin/i.test(error.message)) {
        toast.error('Сүүлчийн админыг хасах боломжгүй. Эхлээд өөр хэрэглэгчид admin эрх олгоно уу.');
      } else {
        toast.error('Эрх солиход алдаа гарлаа');
      }
      setEditingRole(null);
      return;
    }

    // Success
    setMembers((prev) => prev.map((m) => (m.id === member.id ? { ...m, role: newRole } : m)));
    if (fromRole === 'admin' && newRole !== 'admin') setTotalAdmins((c) => c - 1);
    if (fromRole !== 'admin' && newRole === 'admin') setTotalAdmins((c) => c + 1);

    toast.success(`Эрх "${ROLE_LABELS[newRole].label}" болж шинэчлэгдлээ`);

    // Audit log
    await logAudit(AuditActions.ROLE_CHANGED, member.id, { from: fromRole, to: newRole });

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

  const toggleActive = async (member: Profile) => {
    const newActive = !member.is_active;
    const { error } = await supabase.from('profiles').update({ is_active: newActive }).eq('id', member.id);
    if (!error) {
      setMembers((prev) => prev.map((m) => m.id === member.id ? { ...m, is_active: newActive } : m));
      toast.success(newActive ? 'Гишүүн идэвхжүүлсэн' : 'Гишүүн идэвхгүй болголоо');
      await logAudit(newActive ? AuditActions.USER_ACTIVATED : AuditActions.USER_DEACTIVATED, member.id);
    } else {
      toast.error('Алдаа гарлаа');
    }
  };

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  // Last-admin guard helper: cannot demote yourself if you're the last admin
  const isLastAdminCheck = (member: Profile, targetRole: UserRole): boolean => {
    return member.role === 'admin' && targetRole !== 'admin' && totalAdmins <= 1;
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Гишүүд</h1>
          <p className="text-gray-500 text-sm mt-1">Нийт {totalCount} хэрэглэгч</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Нэр, утасны дугаараар хайх..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
          />
        </div>
        <div className="flex gap-2">
          {(['all', 'admin', 'member'] as RoleFilter[]).map((r) => (
            <button
              key={r}
              onClick={() => setRoleFilter(r)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                roleFilter === r
                  ? 'bg-primary-100 text-primary-700 ring-1 ring-primary-300'
                  : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
              }`}
            >
              {r === 'all' ? 'Бүгд' : ROLE_LABELS[r as UserRole].label}
            </button>
          ))}
        </div>
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
              ) : members.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-12 text-center text-gray-400">Гишүүн олдсонгүй</td></tr>
              ) : (
                members.map((member) => {
                  const roleInfo = ROLE_LABELS[member.role] ?? ROLE_LABELS.member;
                  const rankColor = RANK_COLORS[member.rank as UserRank] ?? '#9ca3af';
                  const rankLabel = RANK_LABELS[member.rank as UserRank] ?? member.rank;
                  const isSelf = currentUser?.id === member.id;

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
                            <div className="font-medium text-gray-900">
                              {member.full_name}
                              {isSelf && <span className="ml-2 text-xs text-primary-600">(Та)</span>}
                            </div>
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
                            <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg py-1 z-10 min-w-[140px]">
                              {(['member', 'admin'] as UserRole[]).map((r) => {
                                const disabled = isLastAdminCheck(member, r);
                                return (
                                  <button
                                    key={r}
                                    onClick={() => !disabled && handleRoleChange(member, r)}
                                    disabled={disabled}
                                    title={disabled ? 'Сүүлчийн админыг хасах боломжгүй' : ''}
                                    className={`flex items-center justify-between w-full px-3 py-2 text-xs ${disabled ? 'opacity-40 cursor-not-allowed' : 'hover:bg-gray-50'}`}
                                  >
                                    <span className={`px-1.5 py-0.5 rounded ${ROLE_LABELS[r].color}`}>{ROLE_LABELS[r].label}</span>
                                    {member.role === r && <Check className="w-3.5 h-3.5 text-primary-600" />}
                                  </button>
                                );
                              })}
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
                          <button onClick={() => toggleActive(member)}
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

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
            <div className="text-xs text-gray-500">
              {page * PAGE_SIZE + 1}-{Math.min((page + 1) * PAGE_SIZE, totalCount)} / {totalCount}
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
                className="p-1.5 text-gray-500 hover:bg-gray-100 rounded-lg disabled:opacity-30"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              {renderPageNumbers(page, totalPages, setPage)}
              <button
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
                className="p-1.5 text-gray-500 hover:bg-gray-100 rounded-lg disabled:opacity-30"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
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

function renderPageNumbers(current: number, total: number, onClick: (p: number) => void) {
  const pages: (number | 'ellipsis')[] = [];

  if (total <= 10) {
    for (let i = 0; i < total; i++) pages.push(i);
  } else {
    pages.push(0);
    if (current > 3) pages.push('ellipsis');

    const start = Math.max(1, current - 1);
    const end = Math.min(total - 2, current + 1);
    for (let i = start; i <= end; i++) pages.push(i);

    if (current < total - 4) pages.push('ellipsis');
    pages.push(total - 1);
  }

  return pages.map((p, i) =>
    p === 'ellipsis' ? (
      <span key={`e${i}`} className="px-2 text-gray-400 text-xs">…</span>
    ) : (
      <button
        key={p}
        onClick={() => onClick(p)}
        className={`min-w-[28px] px-2 py-1 rounded-md text-xs font-medium ${
          current === p ? 'bg-primary-600 text-white' : 'text-gray-600 hover:bg-gray-100'
        }`}
      >
        {p + 1}
      </button>
    ),
  );
}
