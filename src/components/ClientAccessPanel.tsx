import { FormEvent, ReactNode, useCallback, useEffect, useState } from 'react';
import {
  Check,
  Clock,
  Loader2,
  UserX,
  RefreshCw,
  Plus,
  KeyRound,
  Pencil,
  Trash2,
} from 'lucide-react';
import {
  createClientAccessManual,
  deleteClientAccess,
  fetchClientAccessRecords,
  resetClientPassword,
  setClientAccessStatus,
  updateClientAccess,
} from '../utils/clientAccess';
import { ClientAccessRecord } from '../types';
import { formatCNPJ } from '../utils/orders';

interface Props {
  accessToken: string;
  adminEmail: string;
}

export default function ClientAccessPanel({ accessToken, adminEmail }: Props) {
  const [records, setRecords] = useState<ClientAccessRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [actionEmail, setActionEmail] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [editEmail, setEditEmail] = useState<string | null>(null);
  const [form, setForm] = useState({ email: '', nome: '', cnpj: '', extras: '' });

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchClientAccessRecords(accessToken);
      setRecords(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar acessos.');
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    load();
  }, [load]);

  const handleStatus = async (email: string, status: ClientAccessRecord['status']) => {
    setActionEmail(email);
    setSuccess(null);
    try {
      await setClientAccessStatus(accessToken, email, status, adminEmail);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao atualizar.');
    } finally {
      setActionEmail(null);
    }
  };

  const handleReset = async (email: string) => {
    setActionEmail(email);
    setSuccess(null);
    try {
      const msg = await resetClientPassword(email, adminEmail);
      setSuccess(msg);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao resetar senha.');
    } finally {
      setActionEmail(null);
    }
  };

  const handleAdd = async (e: FormEvent) => {
    e.preventDefault();
    setActionEmail('new');
    setError(null);
    try {
      await createClientAccessManual(accessToken, {
        email: form.email,
        nome: form.nome,
        cnpj: form.cnpj.replace(/\D/g, ''),
        additionalCnpjs: form.extras
          .split(/[,;]/)
          .map((s) => s.replace(/\D/g, ''))
          .filter(Boolean),
      });
      setShowAdd(false);
      setForm({ email: '', nome: '', cnpj: '', extras: '' });
      await load();
      setSuccess('Cliente adicionado.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao adicionar.');
    } finally {
      setActionEmail(null);
    }
  };

  const handleEditSave = async (e: FormEvent) => {
    e.preventDefault();
    if (!editEmail) return;
    setActionEmail(editEmail);
    try {
      await updateClientAccess(accessToken, editEmail, {
        nome: form.nome,
        cnpj: form.cnpj.replace(/\D/g, ''),
        additionalCnpjs: form.extras
          .split(/[,;]/)
          .map((s) => s.replace(/\D/g, ''))
          .filter(Boolean),
      });
      setEditEmail(null);
      await load();
      setSuccess('Registro atualizado.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao editar.');
    } finally {
      setActionEmail(null);
    }
  };

  const handleDelete = async (email: string) => {
    if (!window.confirm(`Remover acesso de ${email}?`)) return;
    setActionEmail(email);
    try {
      await deleteClientAccess(accessToken, email);
      await load();
      setSuccess('Acesso removido.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao excluir.');
    } finally {
      setActionEmail(null);
    }
  };

  const pendentes = records.filter((r) => r.status === 'PENDENTE');
  const ativos = records.filter((r) => r.status === 'ATIVO');
  const revogados = records.filter((r) => r.status === 'REVOGADO');

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          onClick={() => {
            setShowAdd(true);
            setForm({ email: '', nome: '', cnpj: '', extras: '' });
          }}
          className="inline-flex items-center gap-2 px-3 py-2 text-xs font-bold text-white bg-purple-700 rounded-lg"
        >
          <Plus className="w-3.5 h-3.5" />
          Adicionar cliente
        </button>
        <button
          onClick={load}
          disabled={loading}
          className="inline-flex items-center gap-2 px-3 py-2 text-xs font-bold text-purple-700 bg-purple-50 rounded-lg"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Atualizar
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">{error}</div>
      )}
      {success && (
        <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-xs text-green-700">{success}</div>
      )}

      {pendentes.length > 0 && (
        <Section title={`Pendentes (${pendentes.length})`} color="text-amber-700" icon={<Clock className="w-4 h-4" />}>
          {pendentes.map((r) => (
            <AccessRow
              key={r.email}
              record={r}
              busy={actionEmail === r.email}
              onApprove={() => handleStatus(r.email, 'ATIVO')}
              onRevoke={() => handleStatus(r.email, 'REVOGADO')}
              onReset={() => handleReset(r.email)}
              onEdit={() => {
                setEditEmail(r.email);
                setForm({
                  email: r.email,
                  nome: r.nome,
                  cnpj: r.cnpj,
                  extras: r.cnpjsAdicionais.join('; '),
                });
              }}
              onDelete={() => handleDelete(r.email)}
            />
          ))}
        </Section>
      )}

      <Section title={`Ativos (${ativos.length})`} color="text-green-700" icon={<Check className="w-4 h-4" />}>
        {loading && records.length === 0 ? (
          <Loader2 className="w-6 h-6 animate-spin text-slate-300 mx-auto" />
        ) : ativos.length === 0 ? (
          <p className="text-sm text-slate-400">Nenhum cliente ativo.</p>
        ) : (
          ativos.map((r) => (
            <AccessRow
              key={r.email}
              record={r}
              busy={actionEmail === r.email}
              onRevoke={() => handleStatus(r.email, 'REVOGADO')}
              onReset={() => handleReset(r.email)}
              onEdit={() => {
                setEditEmail(r.email);
                setForm({
                  email: r.email,
                  nome: r.nome,
                  cnpj: r.cnpj,
                  extras: r.cnpjsAdicionais.join('; '),
                });
              }}
              onDelete={() => handleDelete(r.email)}
            />
          ))
        )}
      </Section>

      {revogados.length > 0 && (
        <Section title={`Revogados (${revogados.length})`} color="text-red-600" icon={<UserX className="w-4 h-4" />}>
          {revogados.map((r) => (
            <AccessRow
              key={r.email}
              record={r}
              busy={actionEmail === r.email}
              onApprove={() => handleStatus(r.email, 'ATIVO')}
              onDelete={() => handleDelete(r.email)}
            />
          ))}
        </Section>
      )}

      {(showAdd || editEmail) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <form
            onSubmit={editEmail ? handleEditSave : handleAdd}
            className="bg-white w-full max-w-md rounded-2xl shadow-2xl p-6 space-y-3"
          >
            <h3 className="text-sm font-bold text-slate-800">
              {editEmail ? 'Editar cliente' : 'Adicionar cliente'}
            </h3>
            {!editEmail && (
              <input
                type="email"
                placeholder="E-mail Google"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                required
                className="w-full text-sm border rounded-lg px-3 py-2"
              />
            )}
            <input
              type="text"
              placeholder="Nome / razão social"
              value={form.nome}
              onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))}
              required
              className="w-full text-sm border rounded-lg px-3 py-2"
            />
            <input
              type="text"
              placeholder="CNPJ"
              value={form.cnpj}
              onChange={(e) => setForm((f) => ({ ...f, cnpj: e.target.value }))}
              required
              className="w-full text-sm border rounded-lg px-3 py-2 font-mono"
            />
            <input
              type="text"
              placeholder="CNPJs adicionais (; separador)"
              value={form.extras}
              onChange={(e) => setForm((f) => ({ ...f, extras: e.target.value }))}
              className="w-full text-sm border rounded-lg px-3 py-2"
            />
            <div className="flex gap-2 justify-end pt-2">
              <button
                type="button"
                onClick={() => {
                  setShowAdd(false);
                  setEditEmail(null);
                }}
                className="px-4 py-2 text-sm text-slate-600"
              >
                Cancelar
              </button>
              <button type="submit" className="px-4 py-2 text-sm font-bold text-white bg-purple-700 rounded-lg">
                Salvar
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

function Section({
  title,
  color,
  icon,
  children,
}: {
  title: string;
  color: string;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <section>
      <h2 className={`text-sm font-bold ${color} flex items-center gap-2 mb-3`}>
        {icon}
        {title}
      </h2>
      <div className="space-y-2">{children}</div>
    </section>
  );
}

function AccessRow({
  record: r,
  busy,
  onApprove,
  onRevoke,
  onReset,
  onEdit,
  onDelete,
}: {
  record: ClientAccessRecord;
  busy: boolean;
  onApprove?: () => void;
  onRevoke?: () => void;
  onReset?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
}) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-3">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-slate-800">{r.nome || r.email}</p>
        <p className="text-xs text-slate-500">{r.email}</p>
        <p className="text-xs font-mono text-slate-400 mt-0.5">
          CNPJ {formatCNPJ(r.cnpj)}
          {r.cnpjsAdicionais.length > 0 && ` + ${r.cnpjsAdicionais.length} filial(is)`}
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        {onApprove && (
          <ActionBtn onClick={onApprove} disabled={busy} className="text-green-700 bg-green-50">
            Aprovar
          </ActionBtn>
        )}
        {onRevoke && (
          <ActionBtn onClick={onRevoke} disabled={busy} className="text-red-600 bg-red-50">
            Revogar
          </ActionBtn>
        )}
        {onReset && (
          <ActionBtn onClick={onReset} disabled={busy} className="text-indigo-700 bg-indigo-50">
            <KeyRound className="w-3 h-3" /> Reset senha
          </ActionBtn>
        )}
        {onEdit && (
          <ActionBtn onClick={onEdit} disabled={busy} className="text-slate-600 bg-slate-100">
            <Pencil className="w-3 h-3" />
          </ActionBtn>
        )}
        {onDelete && (
          <ActionBtn onClick={onDelete} disabled={busy} className="text-red-600 bg-red-50">
            <Trash2 className="w-3 h-3" />
          </ActionBtn>
        )}
      </div>
    </div>
  );
}

function ActionBtn({
  children,
  onClick,
  disabled,
  className,
}: {
  children: ReactNode;
  onClick: () => void;
  disabled: boolean;
  className: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`px-3 py-1.5 text-xs font-bold rounded-lg flex items-center gap-1 disabled:opacity-50 ${className}`}
    >
      {children}
    </button>
  );
}
