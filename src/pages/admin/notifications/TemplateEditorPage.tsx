// EP-06 P1-1: admin template editor — /admin/notifications/templates/:id

import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  ArrowLeft, Loader2, Save, Send, Eye, AlertTriangle, History,
  Plus, Trash2, CheckCircle2, RotateCcw,
} from 'lucide-react';
import { marked } from 'marked';
import Mustache from 'mustache';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../hooks/useAuth';
import { logAudit } from '../../../lib/audit';
import type {
  Tables, NotificationCategory, NotificationTemplateVariable,
} from '../../../types/database.types';

type Template = Tables<'notification_templates'>;

const CATEGORIES: NotificationCategory[] = ['transactional', 'event_lifecycle', 'weather', 'social', 'marketing', 'system'];

function deriveText(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
}

function detectMissingVars(body: string, variables: NotificationTemplateVariable[]): string[] {
  const declared = new Set(variables.map((v) => v.name));
  const matches = new Set<string>();
  const re = /\{\{\s*(?:#|\/|&|>)?\s*([a-zA-Z_][a-zA-Z0-9_.]*)\s*\}\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(body))) {
    const name = m[1].split('.')[0];
    if (!declared.has(name)) matches.add(name);
  }
  return Array.from(matches);
}

function exampleVarsFromSchema(variables: NotificationTemplateVariable[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const v of variables) {
    if (v.example !== undefined && v.example !== null) {
      out[v.name] = v.example;
    } else {
      switch (v.type) {
        case 'string': out[v.name] = `[${v.name}]`; break;
        case 'number': out[v.name] = 0; break;
        case 'url':    out[v.name] = `https://example.com/${v.name}`; break;
        case 'date':   out[v.name] = new Date().toISOString(); break;
        case 'boolean': out[v.name] = true; break;
        default: out[v.name] = `[${v.name}]`;
      }
    }
  }
  return out;
}

export default function TemplateEditorPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [tpl, setTpl] = useState<Template | null>(null);
  const [siblings, setSiblings] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);

  // Editable form state
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [plaintext, setPlaintext] = useState('');
  const [category, setCategory] = useState<NotificationCategory>('event_lifecycle');
  const [vars, setVars] = useState<NotificationTemplateVariable[]>([]);
  const [description, setDescription] = useState('');

  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [testSending, setTestSending] = useState(false);

  useEffect(() => {
    if (!id) return;
    let active = true;
    (async () => {
      const { data, error } = await supabase
        .from('notification_templates').select('*').eq('id', id).maybeSingle();
      if (!active) return;
      if (error || !data) {
        toast.error('Template олдсонгүй');
        return;
      }
      const t = data as Template;
      setTpl(t);
      setSubject(t.subject_md ?? '');
      setBody(t.body_md ?? '');
      setPlaintext(t.plaintext_md ?? '');
      setCategory(t.category);
      setVars(Array.isArray(t.variables) ? t.variables : []);
      setDescription(t.description ?? '');

      // Sibling versions for history
      const { data: sib } = await supabase
        .from('notification_templates')
        .select('*')
        .eq('key', t.key)
        .eq('locale', t.locale)
        .eq('channel', t.channel)
        .order('version', { ascending: false });
      if (active) setSiblings((sib ?? []) as Template[]);

      setLoading(false);
    })();
    return () => { active = false; };
  }, [id]);

  // Live preview
  const previewHtml = useMemo(() => {
    try {
      const sample = exampleVarsFromSchema(vars);
      const renderedSubject = subject ? Mustache.render(subject, sample) : '';
      const renderedBody = Mustache.render(body || '', sample);
      const html = marked.parse(renderedBody) as string;
      return { subject: renderedSubject, html };
    } catch (e) {
      return { subject: '', html: `<p style="color:red">Preview error: ${(e as Error).message}</p>` };
    }
  }, [subject, body, vars]);

  const missingVars = useMemo(() => detectMissingVars(body, vars), [body, vars]);

  const subjectTooLong = subject.length > 150;

  const isAdminCanary = !!user; // RLS gates write access; UI just disables when no user

  const save = async ({ publish }: { publish: boolean } = { publish: false }) => {
    if (!tpl) return;
    if (subjectTooLong) {
      toast.error('Subject 150-аас урт байна');
      return;
    }
    if (publish) setPublishing(true); else setSaving(true);

    try {
      // Saving creates a NEW version with is_active=false (history-preserving).
      const newVersion = (siblings[0]?.version ?? tpl.version) + 1;
      const { data: inserted, error } = await supabase
        .from('notification_templates')
        .insert({
          key: tpl.key,
          locale: tpl.locale,
          channel: tpl.channel,
          category,
          version: newVersion,
          is_active: false,
          subject_md: subject || null,
          body_md: body,
          plaintext_md: plaintext || null,
          variables: vars,
          description: description || null,
          created_by: user?.id ?? null,
        })
        .select()
        .single();
      if (error) {
        toast.error(`Хадгалах алдаа: ${error.message}`);
        return;
      }
      const newRow = inserted as Template;
      await logAudit('template.created', newRow.id, {
        key: newRow.key, locale: newRow.locale, channel: newRow.channel, version: newVersion,
      });

      if (publish) {
        // Publish atomically: deactivate previous active, activate this row.
        await supabase
          .from('notification_templates')
          .update({ is_active: false })
          .eq('key', tpl.key)
          .eq('locale', tpl.locale)
          .eq('channel', tpl.channel)
          .eq('is_active', true);
        await supabase
          .from('notification_templates')
          .update({ is_active: true })
          .eq('id', newRow.id);
        await logAudit('template.published', newRow.id, { version: newVersion });
        toast.success(`v${newVersion} нийтлэгдлээ`);
      } else {
        await logAudit('template.updated', newRow.id, { version: newVersion });
        toast.success(`v${newVersion} ноорог хадгалагдлаа`);
      }
      navigate(`/admin/notifications/templates/${newRow.id}`);
    } finally {
      setSaving(false);
      setPublishing(false);
    }
  };

  const rollbackTo = async (target: Template) => {
    if (!tpl) return;
    if (!confirm(`v${target.version}-руу буцаах уу? Энэ хувилбар идэвхтэй болно.`)) return;
    await supabase
      .from('notification_templates')
      .update({ is_active: false })
      .eq('key', tpl.key)
      .eq('locale', tpl.locale)
      .eq('channel', tpl.channel)
      .eq('is_active', true);
    await supabase
      .from('notification_templates')
      .update({ is_active: true })
      .eq('id', target.id);
    await logAudit('template.rolled_back', target.id, { from: tpl.version, to: target.version });
    toast.success(`v${target.version}-руу буцлаа`);
    navigate(`/admin/notifications/templates/${target.id}`);
  };

  const sendTest = async () => {
    if (!tpl) return;
    setTestSending(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { toast.error('Session байхгүй'); return; }
      const r = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/test-send-template`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            template_key: tpl.key,
            locale: tpl.locale,
            channel: tpl.channel,
            variables: exampleVarsFromSchema(vars),
          }),
        },
      );
      if (!r.ok) {
        toast.error(`Test send алдаа: ${(await r.text()).slice(0, 120)}`);
        return;
      }
      toast.success('Test и-мэйл өөрийн хаяг руу илгээгдлээ');
    } finally {
      setTestSending(false);
    }
  };

  if (loading || !tpl) {
    return <div className="flex items-center justify-center py-20 text-gray-400"><Loader2 className="w-6 h-6 animate-spin" /></div>;
  }

  return (
    <div>
      <Link to="/admin/notifications/templates" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4">
        <ArrowLeft className="w-4 h-4" /> Templates
      </Link>

      <div className="flex items-start justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900 font-mono">{tpl.key}</h1>
          <div className="text-xs text-gray-500 mt-1">
            {tpl.locale.toUpperCase()} · {tpl.channel} · v{tpl.version}
            {tpl.is_active && <span className="ml-2 text-green-700 font-semibold">● Идэвхтэй</span>}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={sendTest}
            disabled={testSending || tpl.channel === 'web_push'}
            className="inline-flex items-center gap-1.5 px-3 py-2 border border-gray-200 text-sm font-medium text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50"
          >
            {testSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            Тест илгээх
          </button>
          <button
            onClick={() => save({ publish: false })}
            disabled={saving || publishing || !isAdminCanary}
            className="inline-flex items-center gap-1.5 px-3 py-2 border border-gray-200 text-sm font-medium text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Шинэ хувилбар хадгалах
          </button>
          <button
            onClick={() => save({ publish: true })}
            disabled={saving || publishing || !isAdminCanary || subjectTooLong}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 disabled:opacity-50"
          >
            {publishing ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
            Нийтлэх
          </button>
        </div>
      </div>

      <div className="grid lg:grid-cols-[1fr_380px] gap-6">
        {/* Left: editor + preview */}
        <div className="space-y-4">
          {/* Metadata */}
          <div className="bg-white border border-gray-100 rounded-xl p-4 grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Ангилал</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as NotificationCategory)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
              >
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Тайлбар (admin-д харагдана)</label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Жишээ: RSVP confirmed transactional email"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
              />
            </div>
          </div>

          {/* Subject */}
          {tpl.channel !== 'in_app' && (
            <div className="bg-white border border-gray-100 rounded-xl p-4">
              <label className="block text-xs font-medium text-gray-500 mb-1">
                Subject {subjectTooLong && <span className="text-red-600">— 150-аас урт</span>}
              </label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm font-mono"
              />
              <p className="text-[10px] text-gray-400 mt-1">{subject.length}/150</p>
            </div>
          )}
          {tpl.channel === 'in_app' && (
            <div className="bg-white border border-gray-100 rounded-xl p-4">
              <label className="block text-xs font-medium text-gray-500 mb-1">Title</label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
              />
            </div>
          )}

          {/* Body */}
          <div className="bg-white border border-gray-100 rounded-xl p-4">
            <label className="block text-xs font-medium text-gray-500 mb-1">Body (Markdown + Mustache vars)</label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={14}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm font-mono"
              placeholder="## {{event_title}}&#10;&#10;Hello {{member_name}}..."
            />
            {missingVars.length > 0 && (
              <div className="mt-2 flex items-start gap-2 text-xs bg-amber-50 border border-amber-100 rounded-md px-3 py-2">
                <AlertTriangle className="w-3.5 h-3.5 mt-0.5 text-amber-600 flex-shrink-0" />
                <div className="text-amber-900">
                  Body-д ашиглагдсан бөгөөд Variables-д тодорхойлогдоогүй: <span className="font-mono">{missingVars.join(', ')}</span>
                </div>
              </div>
            )}
          </div>

          {/* Plaintext fallback (auto-derived if blank) */}
          {tpl.channel === 'email' && (
            <div className="bg-white border border-gray-100 rounded-xl p-4">
              <label className="block text-xs font-medium text-gray-500 mb-1">
                Plain-text fallback <span className="text-gray-400">(хоосон бол body-аас autogenerate)</span>
              </label>
              <textarea
                value={plaintext}
                onChange={(e) => setPlaintext(e.target.value)}
                rows={4}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm font-mono"
              />
            </div>
          )}

          {/* Live preview */}
          <div className="bg-white border border-gray-100 rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-semibold text-gray-700 flex items-center gap-1.5">
                <Eye className="w-3.5 h-3.5" /> Урьдчилан харах (sample variables)
              </h3>
              <span className="text-[10px] text-gray-400">{tpl.locale.toUpperCase()} · {tpl.channel}</span>
            </div>
            {previewHtml.subject && (
              <div className="text-xs text-gray-500 mb-2 pb-2 border-b border-gray-100">
                Subject: <strong className="text-gray-900">{previewHtml.subject}</strong>
              </div>
            )}
            <iframe
              title="preview"
              sandbox=""
              srcDoc={`<!doctype html><html><head><meta charset="utf-8"><style>body{font-family:system-ui;margin:16px;color:#111;line-height:1.55} a{color:#16a34a}</style></head><body>${previewHtml.html}</body></html>`}
              className="w-full h-72 border border-gray-100 rounded-lg bg-white"
            />
            <p className="text-[10px] text-gray-400 mt-2">
              Plaintext: {deriveText(previewHtml.html).slice(0, 200) || '(хоосон)'}
            </p>
          </div>
        </div>

        {/* Right: variables + history */}
        <div className="space-y-4">
          <div className="bg-white border border-gray-100 rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-semibold text-gray-700">Variables</h3>
              <button
                onClick={() => setVars([...vars, { name: '', type: 'string' }])}
                className="inline-flex items-center gap-1 px-2 py-1 text-[11px] text-primary-700 bg-primary-50 hover:bg-primary-100 rounded-md"
              >
                <Plus className="w-3 h-3" /> Нэмэх
              </button>
            </div>
            <div className="space-y-2">
              {vars.length === 0 && <p className="text-[11px] text-gray-400">Variable байхгүй. Body-д {`{{name}}`} ашиглавал энд тодорхойлоорой.</p>}
              {vars.map((v, i) => (
                <div key={i} className="flex items-center gap-1.5">
                  <input
                    type="text"
                    value={v.name}
                    onChange={(e) => {
                      const next = [...vars]; next[i] = { ...v, name: e.target.value }; setVars(next);
                    }}
                    placeholder="name"
                    className="flex-1 px-2 py-1 border border-gray-200 rounded text-xs font-mono"
                  />
                  <select
                    value={v.type}
                    onChange={(e) => {
                      const next = [...vars]; next[i] = { ...v, type: e.target.value as NotificationTemplateVariable['type'] }; setVars(next);
                    }}
                    className="px-1.5 py-1 border border-gray-200 rounded text-xs"
                  >
                    <option value="string">str</option>
                    <option value="number">num</option>
                    <option value="url">url</option>
                    <option value="date">date</option>
                    <option value="boolean">bool</option>
                  </select>
                  <input
                    type="checkbox"
                    checked={!!v.required}
                    onChange={(e) => {
                      const next = [...vars]; next[i] = { ...v, required: e.target.checked }; setVars(next);
                    }}
                    title="Шаардлагатай"
                    className="w-3 h-3"
                  />
                  <input
                    type="text"
                    value={String(v.example ?? '')}
                    onChange={(e) => {
                      const next = [...vars]; next[i] = { ...v, example: e.target.value }; setVars(next);
                    }}
                    placeholder="жишээ"
                    className="w-20 px-2 py-1 border border-gray-200 rounded text-xs"
                  />
                  <button onClick={() => setVars(vars.filter((_, j) => j !== i))} className="p-1 text-red-400 hover:text-red-600">
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Version history */}
          <div className="bg-white border border-gray-100 rounded-xl p-4">
            <h3 className="text-xs font-semibold text-gray-700 flex items-center gap-1.5 mb-2">
              <History className="w-3.5 h-3.5" /> Хувилбарын түүх
            </h3>
            <div className="space-y-1">
              {siblings.map((s) => (
                <div
                  key={s.id}
                  className={`flex items-center gap-2 px-2 py-1.5 rounded text-xs ${s.id === tpl.id ? 'bg-primary-50' : 'hover:bg-gray-50'}`}
                >
                  <span className="font-medium w-10">v{s.version}</span>
                  <span className="text-gray-400 flex-1">
                    {new Date(s.created_at).toLocaleDateString('mn-MN')}
                  </span>
                  {s.is_active && <span className="text-green-700 text-[10px] font-semibold">● ИДЭВХТЭЙ</span>}
                  {s.id !== tpl.id && (
                    <Link to={`/admin/notifications/templates/${s.id}`} className="text-primary-600 hover:underline">
                      нээх
                    </Link>
                  )}
                  {!s.is_active && s.id !== tpl.id && (
                    <button onClick={() => rollbackTo(s)} className="text-gray-400 hover:text-gray-700" title="Идэвхжүүлэх">
                      <RotateCcw className="w-3 h-3" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
