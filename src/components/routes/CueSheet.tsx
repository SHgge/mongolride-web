import { useState } from 'react';
import {
  Flag, CheckCircle2, ArrowRight, ArrowLeft,
  CornerUpRight, CornerUpLeft, Repeat, Printer, ChevronDown, ChevronUp,
} from 'lucide-react';
import type { CueEntry, CueType } from '../../types/database.types';
import { useRouteHover } from '../../hooks/useRouteHover';

interface CueSheetProps {
  cues: CueEntry[];
  routeTitle: string;
}

interface CueMeta {
  label: string;
  short: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
}

const CUE_META: Record<CueType, CueMeta> = {
  start:        { label: 'Эхлэл',        short: 'Эхлэл',  icon: Flag,          color: 'text-green-600 bg-green-50' },
  end:          { label: 'Дуусах цэг',   short: 'Дуусах', icon: CheckCircle2,  color: 'text-red-600 bg-red-50' },
  left:         { label: 'Зүүн эргэх',   short: 'Зүүн',   icon: ArrowLeft,     color: 'text-blue-600 bg-blue-50' },
  right:        { label: 'Баруун эргэх', short: 'Баруун', icon: ArrowRight,    color: 'text-blue-600 bg-blue-50' },
  sharp_left:   { label: 'Огцом зүүн',   short: 'Огц.зүүн',  icon: CornerUpLeft,  color: 'text-orange-600 bg-orange-50' },
  sharp_right:  { label: 'Огцом баруун', short: 'Огц.баруун',icon: CornerUpRight, color: 'text-orange-600 bg-orange-50' },
  slight_left:  { label: 'Бага зэрэг зүүн',   short: 'Бага зүүн',   icon: ArrowLeft,  color: 'text-gray-500 bg-gray-50' },
  slight_right: { label: 'Бага зэрэг баруун', short: 'Бага баруун', icon: ArrowRight, color: 'text-gray-500 bg-gray-50' },
  u_turn:       { label: 'Эргэн буцах',  short: 'U-эргэлт', icon: Repeat,        color: 'text-purple-600 bg-purple-50' },
};

function formatDistance(m: number): string {
  if (m >= 1000) return `${(m / 1000).toFixed(1)} км`;
  return `${Math.round(m)} м`;
}

const COLLAPSED_LIMIT = 12;

export default function CueSheet({ cues, routeTitle }: CueSheetProps) {
  const [expanded, setExpanded] = useState(false);
  const { setHoveredKm } = useRouteHover();

  if (cues.length === 0) {
    return (
      <p className="text-xs text-gray-400">
        Эргэлтийн жагсаалт бэлэн биш байна. Маршрутыг GPX-ээр дахин боловсруулна уу.
      </p>
    );
  }

  const visible = expanded ? cues : cues.slice(0, COLLAPSED_LIMIT);
  const hasMore = cues.length > COLLAPSED_LIMIT;

  // Counts for the printable header summary
  const turnCount = cues.filter((c) => c.type !== 'start' && c.type !== 'end').length;

  const handlePrint = () => {
    // Toggle a print-only class on body so we can hide non-cue UI via index.css.
    // Simpler approach: open a clean print window with just the cue sheet.
    const win = window.open('', '_blank', 'width=800,height=900');
    if (!win) return;
    const rows = cues.map((c, i) => {
      const m = CUE_META[c.type];
      return `
        <tr>
          <td>${i + 1}</td>
          <td class="km">${c.km.toFixed(1)} км</td>
          <td>${m.label}</td>
          <td class="seg">${formatDistance(c.segment_distance_m)}</td>
          <td class="bearing">${c.bearing_change !== 0 ? `${c.bearing_change > 0 ? '+' : ''}${c.bearing_change}°` : ''}</td>
        </tr>`;
    }).join('');
    win.document.write(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Cue sheet — ${escapeHtml(routeTitle)}</title>
  <style>
    body { font-family: -apple-system, system-ui, sans-serif; max-width: 720px; margin: 24px auto; padding: 0 16px; color: #111827; }
    h1 { font-size: 18px; margin: 0 0 4px; }
    .subtitle { color: #6b7280; font-size: 13px; margin-bottom: 18px; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    th, td { border-bottom: 1px solid #e5e7eb; padding: 8px 10px; text-align: left; }
    th { background: #f9fafb; font-weight: 600; font-size: 11px; text-transform: uppercase; color: #6b7280; }
    td.km { font-weight: 600; white-space: nowrap; }
    td.seg, td.bearing { color: #6b7280; white-space: nowrap; }
    @media print { body { margin: 0; } }
  </style>
</head>
<body>
  <h1>${escapeHtml(routeTitle)}</h1>
  <div class="subtitle">${cues.length} цэг · ${turnCount} эргэлт · MongolRide-аас үүсгэв</div>
  <table>
    <thead>
      <tr><th>#</th><th>КМ</th><th>Үйлдэл</th><th>Урьд сегмент</th><th>Эргэлт</th></tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>
</body>
</html>`);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 300);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs text-gray-500">
          {cues.length} цэг · {turnCount} эргэлт
        </p>
        <button
          onClick={handlePrint}
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-gray-700 bg-gray-50 hover:bg-gray-100 rounded-md"
        >
          <Printer className="w-3.5 h-3.5" /> Хэвлэх
        </button>
      </div>

      <ol className="space-y-1">
        {visible.map((c, i) => {
          const m = CUE_META[c.type];
          const Icon = m.icon;
          return (
            <li
              key={i}
              onMouseEnter={() => setHoveredKm(c.km)}
              onMouseLeave={() => setHoveredKm(null)}
              className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
            >
              <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${m.color}`}>
                <Icon className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0 text-sm">
                <div className="flex items-baseline gap-2">
                  <span className="font-semibold text-gray-900 tabular-nums">{c.km.toFixed(1)} км</span>
                  <span className="text-gray-700">{m.label}</span>
                </div>
                {c.segment_distance_m > 0 && (
                  <p className="text-[11px] text-gray-400">
                    Өмнөх цэгээс {formatDistance(c.segment_distance_m)}
                    {c.bearing_change !== 0 && (
                      <span className="ml-2">{c.bearing_change > 0 ? '+' : ''}{c.bearing_change}°</span>
                    )}
                  </p>
                )}
              </div>
            </li>
          );
        })}
      </ol>

      {hasMore && (
        <button
          onClick={() => setExpanded((v) => !v)}
          className="w-full mt-3 inline-flex items-center justify-center gap-1.5 py-2 text-xs font-medium text-primary-700 bg-primary-50 hover:bg-primary-100 rounded-lg"
        >
          {expanded ? (
            <><ChevronUp className="w-3.5 h-3.5" /> Багасгах</>
          ) : (
            <><ChevronDown className="w-3.5 h-3.5" /> Бүгдийг харах ({cues.length - COLLAPSED_LIMIT} нэмэлт)</>
          )}
        </button>
      )}
    </div>
  );
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
