import { FormEvent, useMemo, useState } from 'react';
import { PedidoMapa, PortalUser } from '../types';
import {
  CONSOLIDADO_COLUMNS,
  defaultOrderDateBR,
  MAPA_DERIVED_KEYS,
  MAPA_MONEY_KEYS,
  PERIODICIDADE_OPTIONS,
  STATUS_CONTRATO_OPTIONS,
  TIPO_RECORRENCIA_OPTIONS,
  USE_MOCK_DATA,
} from '../constants/columns';
import { OBS_CLIENTE_STATUSES } from '../constants/obsCliente';
import { X, Save, Loader2 } from 'lucide-react';
import OrderDocumentUpload from './OrderDocumentUpload';
import ParcelVencimentoFields from './ParcelVencimentoFields';
import { deriveStatusPgtoFromParcels } from '../utils/parcelPayment';
import { computeOrderDerivedFields } from '../utils/orderCalculations';
import { formatBRLDisplay, formatBRLForSheet, formatPctDisplay, parseBRLnum } from '../utils/brl';

interface Props {
  pedido: PedidoMapa;
  user: PortalUser;
  accessToken: string;
  onClose: () => void;
  onSave: (pedido: PedidoMapa) => Promise<void>;
  onNfUploaded?: () => void;
}

function brToInputDate(br: string): string {
  const m = br.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return '';
  return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
}

function inputDateToBr(iso: string): string {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return iso;
  return `${m[3]}/${m[2]}/${m[1]}`;
}

const inputCls =
  'w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-transparent';

const derivedKeySet = new Set<string>(MAPA_DERIVED_KEYS);
const moneyKeySet = new Set<string>(MAPA_MONEY_KEYS);

export default function OrderEditModal({
  pedido,
  user,
  accessToken,
  onClose,
  onSave,
  onNfUploaded,
}: Props) {
  const [form, setForm] = useState<PedidoMapa>({ ...pedido });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isAssinatura = form.mapaKind === 'assinatura';

  const derived = useMemo(
    () => computeOrderDerivedFields(form),
    [form.qtd, form.custoDist, form.vendBins]
  );

  const displayForm = useMemo(
    () => ({ ...form, ...derived }),
    [form, derived]
  );

  const editableFields = useMemo(() => {
    const skipKeys = new Set<keyof PedidoMapa>([
      'parc1',
      'parc2',
      'parc3',
      'parc4',
      'nfDriveUrl',
      'boletoDriveUrl',
    ]);
    return CONSOLIDADO_COLUMNS.filter((col) => {
      if (skipKeys.has(col.key)) return false;
      if (user.role === 'admin') return true;
      if (user.role === 'financeiro') return col.financeEditable && !col.adminOnly;
      return false;
    });
  }, [user.role]);

  const canUploadDocs =
    !isAssinatura && (user.role === 'admin' || user.role === 'financeiro') && !USE_MOCK_DATA;

  const handleChange = (key: keyof PedidoMapa, value: string) => {
    setForm((f) => ({ ...f, [key]: value }));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      let payload = form;
      if (isAssinatura) {
        const venc = (form.vencimento ?? form.parc1 ?? '').trim();
        payload = {
          ...form,
          vencimento: venc,
          parc1: venc,
          statusPgto: venc ? 'A VENCER' : 'SEM DATA',
        };
      } else {
        const withDerived = { ...form, ...derived };
        payload = {
          ...withDerived,
          custoDist: withDerived.custoDist
            ? formatBRLForSheet(parseBRLnum(withDerived.custoDist))
            : '',
          vendBins: withDerived.vendBins
            ? formatBRLForSheet(parseBRLnum(withDerived.vendBins))
            : '',
          liquido: withDerived.liquido
            ? formatBRLForSheet(parseBRLnum(withDerived.liquido))
            : '',
          statusPgto: deriveStatusPgtoFromParcels(
            form.parc1,
            form.parc2,
            form.parc3,
            form.parc4
          ),
        };
      }
      await onSave(payload);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/40">
      <div className="bg-white w-full sm:max-w-2xl max-h-[92vh] overflow-hidden rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div>
            <h3 className="text-sm font-bold text-slate-800">
              Editar {isAssinatura ? 'assinatura' : 'pedido'} — linha {pedido.rowNum}
            </h3>
            <p className="text-[11px] text-slate-500 truncate">
              {pedido.nomeCliente}
              {isAssinatura && ' · aba ASSINATURAS'}
            </p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-100 text-slate-400">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">{error}</div>
          )}

          {canUploadDocs && (
            <OrderDocumentUpload
              pedido={form}
              accessToken={accessToken}
              userEmail={user.email}
              onUpdated={(updated) => {
                setForm(updated);
                onNfUploaded?.();
              }}
            />
          )}

          {isAssinatura ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Tipo recorrência (col E)">
                <select
                  value={form.tipoRecorrencia ?? 'Assinatura de Licença'}
                  onChange={(e) => handleChange('tipoRecorrencia', e.target.value)}
                  className={inputCls}
                >
                  {TIPO_RECORRENCIA_OPTIONS.map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Status contrato (col F)">
                <select
                  value={form.statusContrato ?? 'Ativo'}
                  onChange={(e) => handleChange('statusContrato', e.target.value)}
                  className={inputCls}
                >
                  {STATUS_CONTRATO_OPTIONS.map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Periodicidade (col G)">
                <select
                  value={form.periodicidade ?? ''}
                  onChange={(e) => handleChange('periodicidade', e.target.value)}
                  className={inputCls}
                >
                  <option value="">—</option>
                  {PERIODICIDADE_OPTIONS.map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="N° Contrato Dist. (col M)">
                <input
                  type="text"
                  value={form.numContratoDist ?? ''}
                  onChange={(e) => handleChange('numContratoDist', e.target.value)}
                  className={inputCls}
                />
              </Field>
              <Field label="Vencimento (col N)">
                <input
                  type="date"
                  value={brToInputDate(form.vencimento ?? form.parc1 ?? '')}
                  onChange={(e) => {
                    const venc = inputDateToBr(e.target.value);
                    setForm((f) => ({
                      ...f,
                      vencimento: venc,
                      parc1: venc,
                      statusPgto: venc ? 'A VENCER' : 'SEM DATA',
                    }));
                  }}
                  className={inputCls}
                />
              </Field>
            </div>
          ) : (
            <>
              <ParcelVencimentoFields
                parc1={form.parc1}
                parc2={form.parc2}
                parc3={form.parc3}
                parc4={form.parc4}
                statusPgto={form.statusPgto}
                onChange={(next) => setForm((f) => ({ ...f, ...next }))}
              />

              {!isAssinatura && (user.role === 'admin' || user.role === 'financeiro') && (
                <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-3 space-y-2">
                  <p className="text-[10px] font-bold uppercase text-slate-400 tracking-wide">
                    Valores calculados (T, V, W, X)
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <CalcField label="Total compra (T)" value={formatBRLDisplay(displayForm.totalCompra)} />
                    <CalcField label="Venda total (V)" value={formatBRLDisplay(displayForm.vendaTotal)} />
                    <CalcField
                      label="Venda % (W)"
                      value={formatPctDisplay(displayForm.vendaPct, {
                        bruto: displayForm.bruto,
                        totalCompra: displayForm.totalCompra,
                        vendaTotal: displayForm.vendaTotal,
                      })}
                    />
                    <CalcField label="Bruto (X)" value={formatBRLDisplay(displayForm.bruto)} />
                  </div>
                  <p className="text-[10px] text-slate-400">
                    Margem % e totais recalculam ao alterar Qtd, R$ Custo Dist. ou R$ Vend. BInsight.
                  </p>
                </div>
              )}
            </>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {editableFields.map((col) => {
              if (!isAssinatura && derivedKeySet.has(col.key)) return null;

              const value = String(form[col.key] ?? '');
              const id = col.key;

              if (!isAssinatura && moneyKeySet.has(col.key) && col.key !== 'totalCompra' && col.key !== 'bruto' && col.key !== 'vendaTotal') {
                return (
                  <MoneyField
                    key={id}
                    label={col.label}
                    value={value}
                    onChange={(v) => handleChange(col.key, v)}
                  />
                );
              }

              if (col.type === 'date') {
                return (
                  <div key={id}>
                    <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                      {col.label}
                    </label>
                    <input
                      type="date"
                      value={brToInputDate(value) || brToInputDate(defaultOrderDateBR())}
                      onChange={(e) => handleChange(col.key, inputDateToBr(e.target.value))}
                      className={inputCls}
                    />
                  </div>
                );
              }

              if (col.type === 'textarea') {
                return (
                  <div key={id} className="sm:col-span-2">
                    <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                      {col.label}
                    </label>
                    <textarea
                      value={value}
                      onChange={(e) => handleChange(col.key, e.target.value)}
                      rows={3}
                      className={inputCls}
                    />
                  </div>
                );
              }

              if (col.key === 'obsCliente' && isAssinatura) return null;

              if (col.key === 'obsCliente') {
                return (
                  <div key={id} className="sm:col-span-2">
                    <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                      {col.label}
                    </label>
                    <select
                      value={value}
                      onChange={(e) => handleChange(col.key, e.target.value)}
                      className={inputCls}
                    >
                      <option value="">—</option>
                      {OBS_CLIENTE_STATUSES.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                      {value && !OBS_CLIENTE_STATUSES.includes(value as (typeof OBS_CLIENTE_STATUSES)[number]) && (
                        <option value={value}>{value}</option>
                      )}
                    </select>
                  </div>
                );
              }

              if (col.type === 'select' && col.options) {
                return (
                  <div key={id}>
                    <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                      {col.label}
                    </label>
                    <select
                      value={value}
                      onChange={(e) => handleChange(col.key, e.target.value)}
                      className={inputCls}
                    >
                      <option value="">—</option>
                      {col.options.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                      {value && !col.options.includes(value) && <option value={value}>{value}</option>}
                    </select>
                  </div>
                );
              }

              return (
                <div key={id}>
                  <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                    {col.label}
                  </label>
                  <input
                    type="text"
                    value={value}
                    onChange={(e) => handleChange(col.key, e.target.value)}
                    className={inputCls}
                  />
                </div>
              );
            })}
          </div>
        </form>

        <div className="px-5 py-4 border-t border-slate-100 flex gap-3 justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="px-4 py-2 text-sm font-bold text-white bg-purple-700 hover:bg-purple-800 rounded-lg flex items-center gap-2 disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Salvar no Mapa
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">{label}</label>
      {children}
    </div>
  );
}

function CalcField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[9px] font-bold uppercase text-slate-400 mb-0.5">{label}</p>
      <p className="text-sm font-semibold text-slate-800 tabular-nums">{value}</p>
    </div>
  );
}

function MoneyField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (sheetValue: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  const commit = () => {
    setEditing(false);
    const n = parseBRLnum(draft);
    onChange(n > 0 || draft.trim() ? formatBRLForSheet(n) : '');
  };

  return (
    <div>
      <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">{label}</label>
      {editing ? (
        <input
          type="text"
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commit();
          }}
          className={inputCls}
          placeholder="R$ 0,00"
        />
      ) : (
        <button
          type="button"
          onClick={() => {
            setDraft(value);
            setEditing(true);
          }}
          className={`${inputCls} text-left tabular-nums hover:border-purple-300`}
        >
          {formatBRLDisplay(value)}
        </button>
      )}
    </div>
  );
}
