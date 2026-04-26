import { useEffect, useState, useCallback } from 'react';
import { Check, X, Search, Loader2, ChevronLeft, ChevronRight, User } from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../../lib/supabase';
import { logAudit, AuditActions } from '../../lib/audit';

const PAGE_SIZE = 50;

interface RequestRow {
  id: string;
  user_id: string;
  status: 'pending' | 'approved' | 'rejected';
  motivation: string | null;
  reason: string | null;
  decided_at: string | null;
  created_at: string;
  user?: { full_name: string; avatar_url: string | null };
}

type StatusFilter = 'all' | 'pending' | 'approved' | 'rejected';

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-700',
  approved: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
};
const STATUS_LABELS: Record<string, string> = {
  pending: 'Хүлээгдэж буй', approved: 'Зөвшөөрсөн', rejected: 'Татгалзсан',
};

async function callNotify(userId: string, decision: 'approved' | 'rejected', reason?: string) {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/notify-membership-decision`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ user_id: userId, decision, reason }),
    });
  } catch (err) {
    console.error('[notify]', err);
  }
}

export default function MembershipRequests() {
  const [rows, setRows] = useState<RequestRow[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('pending');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Reject modal state
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectingUserId, setRejectingUserId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [rejecting, setRejecting] = useState(false);

  const [bulkBusy, setBulkBusy] = useState(false);

  useEffect(() => { setPage(0); setSelected(new Set()); }, [statusFilter, search]);

  const fetchRequests = useCallback(async () => {
    setLoading(true);

    let q = supabase
      .from('membership_requests')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

    if (statusFilter !== 'all') q = q.eq('status', statusFilter);

    const { data, count, error } = await q;
    if (error) { toast.error('Ачаалахад алдаа гарлаа'); setLoading(false); return; }

    let list = (data ?? []) as RequestRow[];

    // Fetch user profiles for names
    const userIds = [...new Set(list.map((r) => r.user_id))];
    if (userIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url')
        .in('id', userIds);
      const map = new Map((profiles ?? []).map((p) => [p.id, p]));
      list = list.map((r) => ({ ...r, user: map.get(r.user_id) ? { full_name: map.get(r.user_id)!.full_name, avatar_url: map.get(r.user_id)!.avatar_url } : undefined }));
    }

    // Client-side search by name
    if (search.trim()) {
      const s = search.toLowerCase();
      list = list.filter((r) => r.user?.full_name?.toLowerCase().includes(s));
    }

    setRows(list);
    setTotalCount(count ?? 0);
    setLoading(false);
  }, [page, statusFilter, search]);

  useEffect(() => {
    const t = setTimeout(fetchRequests, search ? 300 : 0);
    return () => clearTimeout(t);
  }, [fetchRequests, search]);

  const handleApprove = async (req: RequestRow) => {
    const { error } = await (supabase.rpc as unknown as (n: string, p: Record<string, unknown>) => Promise<{ error: Error | null }>)('approve_membership_request', { request_id: req.id });
    if (error) {
      toast.error(error.message || 'Зөвшөөрөхөд алдаа');
      return;
    }
    toast.success('Зөвшөөрсөн');
    await callNotify(req.user_id, 'approved');
    await logAudit(AuditActions.MEMBERSHIP_APPROVED, req.user_id);
    fetchRequests();
  };

  const openReject = (req: RequestRow) => {
    setRejectingId(req.id);
    setRejectingUserId(req.user_id);
    setRejectReason('');
  };

  const submitReject = async () => {
    if (!rejectingId || !rejectingUserId) return;
    setRejecting(true);
    const { error } = await (supabase.rpc as unknown as (n: string, p: Record<string, unknown>) => Promise<{ error: Error | null }>)('reject_membership_request', {
      request_id: rejectingId,
      rejection_reason: rejectReason.trim() || null,
    });
    if (error) {
      toast.error(error.message || 'Татгалзахад алдаа');
      setRejecting(false);
      return;
    }
    toast.success('Татгалзсан');
    await callNotify(rejectingUserId, 'rejected', rejectReason.trim() || undefined);
    await logAudit(AuditActions.MEMBERSHIP_REJECTED, rejectingUserId, { reason: rejectReason.trim() || null });
    setRejectingId(null);
    setRejectingUserId(null);
    setRejectReason('');
    setRejecting(false);
    fetchRequests();
  };

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    const pending = rows.filter((r) => r.status === 'pending');
    if (selected.size === pending.length) setSelected(new Set());
    else setSelected(new Set(pending.map((r) => r.id)));
  };

  const bulkAction = async (decision: 'approved' | 'rejected') => {
    if (selected.size === 0) return;
    setBulkBusy(true);

    const targets = rows.filter((r) => selected.has(r.id) && r.status === 'pending');
    const results = await Promise.allSettled(
      targets.map(async (req) => {
        const { error } = decision === 'approved'
          ? await (supabase.rpc as unknown as (n: string, p: Record<string, unknown>) => Promise<{ error: Error | null }>)('approve_membership_request', { request_id: req.id })
          : await (supabase.rpc as unknown as (n: string, p: Record<string, unknown>) => Promise<{ error: Error | null }>)('reject_membership_request', { request_id: req.id, rejection_reason: null });
        if (error) throw error;
        await callNotify(req.user_id, decision);
        await logAudit(decision === 'approved' ? AuditActions.MEMBERSHIP_APPROVED : AuditActions.MEMBERSHIP_REJECTED, req.user_id);
        return req.id;
      }),
    );

    const ok = results.filter((r) => r.status === 'fulfilled').length;
    const fail = results.length - ok;
    if (fail === 0) toast.success(`${ok} хүсэлт амжилттай`);
    else toast.error(`${ok} амжилттай, ${fail} алдаатай`);

    setSelected(new Set());
    setBulkBusy(false);
    fetchRequests();
  };

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const pendingCount = rows.filter((r) => r.status === 'pending').length;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Гишүүнчлэлийн хүсэлтүүд</h1>
        <p className="text-gray-500 text-sm mt-1">Нийт {totalCount} хүсэлт</p>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input type="text" placeholder="Нэрээр хайх..." value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500" />
        </div>
        <div className="flex gap-2">
          {(['pending', 'approved', 'rejected', 'all'] as StatusFilter[]).map((s) => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${statusFilter === s ? 'bg-primary-100 text-primary-700 ring-1 ring-primary-300' : 'bg-gray-50 text-gray-600 hover:bg-gray-100'}`}>
              {s === 'all' ? 'Бүгд' : STATUS_LABELS[s]}
            </button>
          ))}
        </div>
      </div>

      {/* Bulk actions */}
      {selected.size > 0 && (
        <div className="flex items-center gap-3 mb-4 p-3 bg-primary-50 border border-primary-200 rounded-lg">
          <span className="text-sm font-medium text-primary-800">{selected.size} сонгосон</span>
          <div className="flex gap-2 ml-auto">
            <button onClick={() => bulkAction('approved')} disabled={bulkBusy}
              className="flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white text-xs font-medium rounded-lg hover:bg-green-700 disabled:opacity-50">
              <Check className="w-4 h-4" /> Бүгдийг зөвшөөрөх
            </button>
            <button onClick={() => bulkAction('rejected')} disabled={bulkBusy}
              className="flex items-center gap-1 px-3 py-1.5 bg-red-600 text-white text-xs font-medium rounded-lg hover:bg-red-700 disabled:opacity-50">
              <X className="w-4 h-4" /> Бүгдийг татгалзах
            </button>
            <button onClick={() => setSelected(new Set())} className="px-3 py-1.5 text-xs text-gray-600 hover:text-gray-900">
              Цуцлах
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              {pendingCount > 0 && (
                <th className="text-left px-4 py-3 w-10">
                  <input type="checkbox"
                    checked={selected.size > 0 && selected.size === pendingCount}
                    onChange={selectAll}
                    className="w-4 h-4 text-primary-600 rounded" />
                </th>
              )}
              <th className="text-left px-4 py-3 font-medium text-gray-500">Хэрэглэгч</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Шалтгаан</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Огноо</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Төлөв</th>
              <th className="text-right px-4 py-3 font-medium text-gray-500">Үйлдэл</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="border-b border-gray-50">
                  <td colSpan={6} className="px-4 py-4"><div className="h-6 bg-gray-100 rounded animate-pulse" /></td>
                </tr>
              ))
            ) : rows.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-12 text-center text-gray-400">Хүсэлт олдсонгүй</td></tr>
            ) : (
              rows.map((req) => (
                <tr key={req.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                  {pendingCount > 0 && (
                    <td className="px-4 py-3">
                      {req.status === 'pending' && (
                        <input type="checkbox" checked={selected.has(req.id)} onChange={() => toggleSelect(req.id)} className="w-4 h-4 text-primary-600 rounded" />
                      )}
                    </td>
                  )}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center overflow-hidden">
                        {req.user?.avatar_url ? (
                          <img src={req.user.avatar_url} alt="" className="w-8 h-8 rounded-full object-cover" />
                        ) : (
                          <User className="w-4 h-4 text-gray-400" />
                        )}
                      </div>
                      <div className="font-medium text-gray-900">{req.user?.full_name ?? 'Хэрэглэгч'}</div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-600 max-w-xs truncate" title={req.motivation ?? ''}>
                    {req.motivation || <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-4 py-3 text-gray-400 text-xs">
                    {new Date(req.created_at).toLocaleDateString('mn-MN')}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-md text-xs font-medium ${STATUS_COLORS[req.status]}`}>
                      {STATUS_LABELS[req.status]}
                    </span>
                    {req.reason && <div className="text-xs text-gray-400 mt-1" title={req.reason}>"{req.reason.slice(0, 30)}..."</div>}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {req.status === 'pending' && (
                      <div className="flex items-center justify-end gap-2">
                        <button onClick={() => handleApprove(req)} title="Зөвшөөрөх"
                          className="p-1.5 bg-green-50 text-green-600 rounded-lg hover:bg-green-100">
                          <Check className="w-4 h-4" />
                        </button>
                        <button onClick={() => openReject(req)} title="Татгалзах"
                          className="p-1.5 bg-red-50 text-red-600 rounded-lg hover:bg-red-100">
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
            <div className="text-xs text-gray-500">
              {page * PAGE_SIZE + 1}-{Math.min((page + 1) * PAGE_SIZE, totalCount)} / {totalCount}
            </div>
            <div className="flex items-center gap-1">
              <button onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0}
                className="p-1.5 text-gray-500 hover:bg-gray-100 rounded-lg disabled:opacity-30">
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="px-3 text-xs text-gray-600">{page + 1} / {totalPages}</span>
              <button onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}
                className="p-1.5 text-gray-500 hover:bg-gray-100 rounded-lg disabled:opacity-30">
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Reject modal */}
      {rejectingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Хүсэлт татгалзах</h3>
            <p className="text-sm text-gray-500 mb-4">Татгалзсан шалтгаанаа бичиж болно (заавал биш). Хэрэглэгчид имэйлээр илгээгдэнэ.</p>
            <textarea
              rows={4}
              value={rejectReason}
              maxLength={500}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Шалтгаан..."
              className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 resize-none mb-4"
            />
            <div className="flex gap-3">
              <button onClick={() => { setRejectingId(null); setRejectingUserId(null); }}
                className="flex-1 py-2.5 border border-gray-200 text-sm font-medium text-gray-700 rounded-lg hover:bg-gray-50">
                Цуцлах
              </button>
              <button onClick={submitReject} disabled={rejecting}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 disabled:opacity-50">
                {rejecting ? <Loader2 className="w-4 h-4 animate-spin" /> : <X className="w-4 h-4" />}
                Татгалзах
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
