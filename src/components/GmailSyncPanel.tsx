import React, { useEffect, useMemo, useState } from 'react';
import { AlertCircle, Check, Mail, Plus, RefreshCw, ShieldCheck, Trash2 } from 'lucide-react';
import type { Transaction } from '../types/index.ts';
import {
  GMAIL_CONFIG,
  isGmailConfigured,
  requestAuthCode,
  listGmailAccounts,
  addGmailAccount,
  removeGmailAccount,
  syncGmailAccounts,
  candidateToTransaction,
  GmailAccount,
  GmailCandidate,
  GmailSyncError,
} from '../lib/gmail.ts';

interface GmailSyncPanelProps {
  getIdToken: () => Promise<string>;
  transactions: Transaction[];
  onImport: (txs: Transaction[]) => void;
}

type Busy = 'load' | 'add' | 'remove' | 'sync';
type Notice = { kind: 'ok' | 'error'; text: string } | null;

export const GmailSyncPanel: React.FC<GmailSyncPanelProps> = ({ getIdToken, transactions, onImport }) => {
  const configured = isGmailConfigured();
  const [accounts, setAccounts] = useState<GmailAccount[]>([]);
  const [busy, setBusy] = useState<Busy | null>(null);
  const [notice, setNotice] = useState<Notice>(null);
  const [candidates, setCandidates] = useState<GmailCandidate[]>([]);
  const [errors, setErrors] = useState<GmailSyncError[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [searched, setSearched] = useState(false);

  // Avisos que ya se importaron: se identifican por el id del correo
  const importedIds = useMemo(
    () =>
      new Set(
        transactions
          .map((t) => t.bankSyncMeta?.gmailMessageId)
          .filter((id): id is string => Boolean(id))
      ),
    [transactions]
  );

  const pending = candidates.filter((c) => !importedIds.has(c.messageId));
  const full = accounts.length >= GMAIL_CONFIG.maxAccounts;

  const run = async (kind: Busy, task: (token: string) => Promise<void>) => {
    setBusy(kind);
    setNotice(null);
    try {
      const token = await getIdToken();
      await task(token);
    } catch (e) {
      setNotice({ kind: 'error', text: e instanceof Error ? e.message : 'Error inesperado.' });
    } finally {
      setBusy(null);
    }
  };

  useEffect(() => {
    if (!configured) return;
    void run('load', async (token) => {
      const res = await listGmailAccounts(token);
      if (res.ok) setAccounts(res.data.accounts);
      else setNotice({ kind: 'error', text: res.error });
    });
    // Solo al abrir la seccion
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleAdd = () =>
    run('add', async (token) => {
      const { code, redirectUri } = await requestAuthCode();
      const res = await addGmailAccount(code, redirectUri, token);
      if (!res.ok) {
        setNotice({ kind: 'error', text: res.error });
        return;
      }
      setNotice({
        kind: 'ok',
        text: res.data.created
          ? `Cuenta ${res.data.account.email} conectada.`
          : `${res.data.account.email} ya estaba conectada.`,
      });
      const list = await listGmailAccounts(token);
      if (list.ok) setAccounts(list.data.accounts);
    });

  const handleRemove = (acc: GmailAccount) => {
    if (!window.confirm(`¿Quitar ${acc.email}? Dejará de leer sus avisos.`)) return;
    void run('remove', async (token) => {
      const res = await removeGmailAccount(acc.id, token);
      if (!res.ok) {
        setNotice({ kind: 'error', text: res.error });
        return;
      }
      setCandidates((prev) => prev.filter((c) => c.accountId !== acc.id));
      setErrors((prev) => prev.filter((e) => e.accountId !== acc.id));
      const list = await listGmailAccounts(token);
      if (list.ok) setAccounts(list.data.accounts);
    });
  };

  const handleSync = () =>
    run('sync', async (token) => {
      const res = await syncGmailAccounts(token);
      if (!res.ok) {
        setNotice({ kind: 'error', text: res.error });
        return;
      }
      const fresh = res.data.candidates.filter((c) => !importedIds.has(c.messageId));
      setSearched(true);
      setCandidates(res.data.candidates);
      setErrors(res.data.errors);
      setSelected(new Set()); // nada marcado: el usuario elige cuales importar
      setNotice({
        kind: 'ok',
        text:
          fresh.length > 0
            ? `${fresh.length} aviso(s) de salida de dinero por revisar.`
            : 'No hay avisos nuevos de salida de dinero.',
      });
    });

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const handleImport = () => {
    const chosen = pending.filter((c) => selected.has(c.messageId));
    if (chosen.length === 0) return;
    onImport(chosen.map(candidateToTransaction));
    setCandidates((prev) => prev.filter((c) => !selected.has(c.messageId)));
    setSelected(new Set());
    setNotice({ kind: 'ok', text: `${chosen.length} movimiento(s) importado(s).` });
  };

  if (!configured) {
    return (
      <div className="flex items-start gap-3 p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs">
        <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
        <p>
          La sincronización con Gmail todavía no está activa. Falta configurar el servidor
          (<code>VITE_GMAIL_BACKEND_URL</code>) y el ID de Google (<code>VITE_GOOGLE_CLIENT_ID</code>).
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted">
        Lee los avisos de salida de dinero de Yape y BCP. Nada se importa sin tu confirmación.
        Puedes conectar hasta {GMAIL_CONFIG.maxAccounts} cuentas de Gmail.
      </p>

      {/* Cuentas conectadas */}
      <div className="space-y-2">
        {accounts.length === 0 && busy !== 'load' && (
          <p className="text-sm text-muted">No hay cuentas conectadas.</p>
        )}
        {accounts.map((acc) => (
          <div
            key={acc.id}
            className="flex items-center justify-between gap-2 p-3 rounded-xl border border-line bg-zinc-50"
          >
            <div className="flex items-center gap-2 min-w-0">
              <Mail className="w-4 h-4 text-rose-500 flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-sm font-medium text-main truncate">{acc.email}</p>
                <p className="text-[10px] text-muted">
                  {acc.lastSyncAt
                    ? `Última búsqueda: ${new Date(acc.lastSyncAt).toLocaleString('es')}`
                    : 'Aún no se ha buscado'}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => handleRemove(acc)}
              disabled={busy !== null}
              aria-label={`Quitar ${acc.email}`}
              className="p-2 rounded-lg text-rose-500 hover:bg-rose-50 disabled:opacity-40"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>

      {/* Acciones */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <button
          type="button"
          onClick={handleAdd}
          disabled={busy !== null || full}
          className="flex items-center justify-center gap-2 py-2.5 rounded-xl border border-dashed border-blue-300 text-blue-600 text-sm font-medium hover:bg-blue-50 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Plus className="w-4 h-4" />
          {full ? `Límite de ${GMAIL_CONFIG.maxAccounts} cuentas` : `Agregar cuenta (${accounts.length}/${GMAIL_CONFIG.maxAccounts})`}
        </button>
        <button
          type="button"
          onClick={handleSync}
          disabled={busy !== null || accounts.length === 0}
          className="flex items-center justify-center gap-2 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <RefreshCw className={`w-4 h-4 ${busy === 'sync' ? 'animate-spin' : ''}`} />
          Buscar avisos
        </button>
      </div>

      {notice && (
        <div
          className={`p-3 rounded-xl text-xs border ${
            notice.kind === 'ok'
              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
              : 'bg-rose-50 text-rose-600 border-rose-200'
          }`}
        >
          {notice.text}
        </div>
      )}

      {errors.map((e) => (
        <div key={e.accountId} className="p-3 rounded-xl text-xs bg-amber-50 text-amber-800 border border-amber-200">
          <strong>{e.email}:</strong> {e.error}
        </div>
      ))}

      {/* Avisos por revisar */}
      {searched && pending.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-muted uppercase tracking-wide">Por revisar</p>
            <button
              type="button"
              onClick={() =>
                setSelected(
                  selected.size === pending.length ? new Set() : new Set(pending.map((c) => c.messageId))
                )
              }
              className="text-xs text-blue-600 font-medium"
            >
              {selected.size === pending.length ? 'Ninguno' : 'Todos'}
            </button>
          </div>

          {pending.map((c) => {
            const on = selected.has(c.messageId);
            return (
              <button
                key={c.messageId}
                type="button"
                onClick={() => toggle(c.messageId)}
                className={`w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-colors ${
                  on ? 'border-blue-400 bg-blue-50/60' : 'border-line surface-card'
                }`}
              >
                <span
                  className={`w-5 h-5 rounded-md border flex items-center justify-center flex-shrink-0 ${
                    on ? 'bg-blue-600 border-blue-600 text-white' : 'border-zinc-300'
                  }`}
                >
                  {on && <Check className="w-3.5 h-3.5" />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-main truncate">{c.merchant}</p>
                  <p className="text-[10px] text-muted truncate">
                    {c.bankName} · {c.accountEmail} · {c.date} · {c.category}
                  </p>
                </div>
                <span className="text-sm font-bold text-main flex-shrink-0">
                  {c.currency} {c.amount.toFixed(2)}
                </span>
              </button>
            );
          })}

          <button
            type="button"
            onClick={handleImport}
            disabled={selected.size === 0 || busy !== null}
            className="w-full py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Importar {selected.size} movimiento(s)
          </button>
        </div>
      )}

      {searched && pending.length === 0 && candidates.length > 0 && (
        <p className="text-xs text-muted">Todos estos avisos ya estaban importados.</p>
      )}

      <div className="flex items-start gap-2 text-[11px] text-muted">
        <ShieldCheck className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
        <span>
          Solo se leen avisos de Yape y BCP. Los permisos de Google se guardan cifrados en el servidor,
          nunca en tu navegador.
        </span>
      </div>
    </div>
  );
};
