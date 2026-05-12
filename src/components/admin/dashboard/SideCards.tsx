// EP-07 P1-3: At-risk members + Notification health side cards.

import { Loader2, ShieldAlert, Mail, AlertTriangle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAtRisk, useNotificationHealth, logDrilldown } from '../../../hooks/analytics/queries';

const RELIABILITY_LABEL: Record<string, { text: string; cls: string }> = {
  reliable:        { text: 'Найдвартай',  cls: 'bg-green-100 text-green-700' },
  mostly_reliable: { text: 'Дунд',         cls: 'bg-yellow-100 text-yellow-700' },
  unreliable:      { text: 'Найдваргүй',  cls: 'bg-red-100 text-red-700' },
  unknown:         { text: '—',            cls: 'bg-gray-100 text-gray-500' },
};

const REASON_LABEL: Record<string, string> = {
  unreliable:     'Найдваргүй',
  never_attended: 'Хэзээ ч ирээгүй',
  inactive_60d:   '60+ хоног идэвхгүй',
  other:          'Бусад',
};

export function AtRiskList() {
  const { data, isLoading, error } = useAtRisk(30);

  return (
    <div className="bg-white border border-gray-100 rounded-xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <ShieldAlert className="w-4 h-4 text-amber-600" />
        <h3 className="font-semibold text-gray-900 text-sm">Эрсдэлтэй гишүүд</h3>
      </div>
      {isLoading ? (
        <div className="h-32 flex items-center justify-center text-gray-400"><Loader2 className="w-5 h-5 animate-spin" /></div>
      ) : error ? (
        <div className="text-sm text-red-600">{(error as Error).message}</div>
      ) : (data ?? []).length === 0 ? (
        <p className="text-sm text-gray-400 py-4">Эрсдэлтэй гишүүн алга — сайхан ажил.</p>
      ) : (
        <ul className="divide-y divide-gray-50 max-h-80 overflow-y-auto">
          {(data ?? []).map((m) => {
            const meta = RELIABILITY_LABEL[m.reliability_label] ?? RELIABILITY_LABEL.unknown;
            return (
              <li key={m.user_id} className="py-2 flex items-center gap-3 text-sm">
                <Link
                  to={`/admin/members?user=${m.user_id}`}
                  onClick={() => logDrilldown('at_risk_member', m.user_id, { reason: m.reason })}
                  className="flex-1 min-w-0 hover:text-primary-600"
                >
                  <div className="font-medium text-gray-900 truncate">{m.full_name}</div>
                  <div className="text-[10px] text-gray-400">
                    {REASON_LABEL[m.reason] ?? m.reason}
                    {m.last_event_at && (
                      <span className="ml-2">сүүл: {new Date(m.last_event_at).toLocaleDateString('mn-MN')}</span>
                    )}
                  </div>
                </Link>
                <span className="text-[10px] text-gray-400 tabular-nums">
                  {m.attended_90d}/<span className="text-red-500">{m.no_show_90d}</span>
                </span>
                <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${meta.cls}`}>
                  {meta.text}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export function NotificationHealthCard() {
  const { data, isLoading } = useNotificationHealth();

  const dead = data?.dead_open ?? 0;
  const isAlerting = dead > 0;

  return (
    <div className={`bg-white border rounded-xl p-4 ${isAlerting ? 'border-red-300' : 'border-gray-100'}`}>
      <div className="flex items-center gap-2 mb-3">
        <Mail className={`w-4 h-4 ${isAlerting ? 'text-red-600' : 'text-primary-600'}`} />
        <h3 className="font-semibold text-gray-900 text-sm">Notification байдал</h3>
        {isAlerting && (
          <span className="ml-auto inline-flex items-center gap-1 text-[10px] text-red-700 bg-red-50 px-1.5 py-0.5 rounded">
            <AlertTriangle className="w-3 h-3" /> Анхаарал
          </span>
        )}
      </div>
      {isLoading ? (
        <div className="h-32 flex items-center justify-center text-gray-400"><Loader2 className="w-5 h-5 animate-spin" /></div>
      ) : (
        <div className="grid grid-cols-2 gap-3 text-sm">
          <Stat label="Өнөөдөр илгээсэн"   value={data?.sent_today ?? 0} />
          <Stat label="Өчигдөр илгээсэн"   value={data?.sent_yesterday ?? 0} />
          <Stat label="Өнөөдрийн алдаа"    value={data?.failed_today ?? 0} color={data && data.failed_today > 0 ? 'text-amber-600' : undefined} />
          <Stat label="Dead-letter (нийт)" value={dead} color={isAlerting ? 'text-red-600' : undefined} />
          <Stat label="Bounced хаяг"       value={data?.bounced_emails ?? 0} color={data && data.bounced_emails > 0 ? 'text-amber-600' : undefined} />
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wide text-gray-400">{label}</div>
      <div className={`text-xl font-bold tabular-nums ${color ?? 'text-gray-900'}`}>{value}</div>
    </div>
  );
}
