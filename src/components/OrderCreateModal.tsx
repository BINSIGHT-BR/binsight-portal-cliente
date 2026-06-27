import { FormEvent, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Loader2, Plus, X } from 'lucide-react';
import { PedidoMapa, PortalUser } from '../types';
import { defaultOrderDateBR, PERIODICIDADE_OPTIONS, resolveMonthlyTabFromDate, STATUS_CONTRATO_OPTIONS, TIPO_RECORRENCIA_OPTIONS, USE_MOCK_DATA } from '../constants/columns';
import { OBS_CLIENTE_STATUSES } from '../constants/obsCliente';
import { brDateToIso, isoDateToBR } from '../utils/orders';
import { computeOrderDerivedFields } from '../utils/orderCalculations';
import { formatBRLDisplay } from '../utils/brl';
import { deriveStatusPgtoFromParcels } from '../utils/parcelPayment';
import ParcelVencimentoFields, { formInputCls as inputCls } from './ParcelVencimentoFields';
import type { MapaKind } from '../types';
import {
  fetchMapaFormOptions,
  formatCnpjInput,
  lookupCustomerByCnpj,
  resolveVendedorForUser,
  type MapaFormOptions,
} from '../utils/mapaLookups';

const PRIORIDADES = ['Baixa', 'Média', 'Alta', 'Urgente'] as const;

const MOCK_DISTRIBUIDORES = ['AGIS', 'GOLDEN', 'INGRAM', 'SCANSOURCE', 'SND'];

const MOCK_VENDEDORES = [
  { email: 'felipe.dantas@binsight.com.br', nome: 'Felipe Dantas' },
  { email: 'financeiro@binsight.com.br', nome: 'Financeiro BInsight' },
];

function emptyForm(): Partial<PedidoMapa> {
  return {
    data: defaultOrderDateBR(),
    vendedor: '',
    cnpj: '',
    nomeCliente: '',
    numPedidoCli: '',
    prioridade: 'Média',
    descricaoProduto: '',
    distribuidor: '',
    numPedidoDist: '',
    qtd: '1',
    custoDist: '',
    vendBins: '',
    parc1: '',
    status: 'PENDENTE',
    statusPgto: 'SEM DATA',
    statusComissao: 'PENDENTE',
    emissao: 'Não',
    obsPedido: '',
    obsCliente: '',
  };
}

interface Props {
  user: PortalUser;
  accessToken: string;
  onClose: () => void;
  onSubmit: (pedido: Partial<PedidoMapa>) => Promise<void>;
}

export default function OrderCreateModal({ user, accessToken, onClose, onSubmit }: Props) {
  const [mapaKind, setMapaKind] = useState<MapaKind>('pedido');
  const [form, setForm] = useState<Partial<PedidoMapa>>(() => emptyForm());
  const [options, setOptions] = useState<MapaFormOptions | null>(null);
  const [loadingOptions, setLoadingOptions] = useState(!USE_MOCK_DATA);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupHint, setLookupHint] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const derived = useMemo(
    () => computeOrderDerivedFields(form as PedidoMapa),
    [form.qtd, form.custoDist, form.vendBins]
  );

  const monthlyHint = form.data && mapaKind === 'pedido' ? resolveMonthlyTabFromDate(form.data) : 'ASSINATURAS';

  useEffect(() => {
    if (USE_MOCK_DATA) {
      setOptions({
        distribuidores: MOCK_DISTRIBUIDORES,
        vendedores: MOCK_VENDEDORES,
      });
      setForm((f) => ({
        ...f,
        vendedor: resolveVendedorForUser(
          { distribuidores: MOCK_DISTRIBUIDORES, vendedores: MOCK_VENDEDORES },
          user.email
        ),
      }));
      setLoadingOptions(false);
      return;
    }

    fetchMapaFormOptions(accessToken)
      .then((opts) => {
        setOptions(opts);
        setForm((f) => ({
          ...f,
          vendedor: f.vendedor || resolveVendedorForUser(opts, user.email),
        }));
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Erro ao carregar listas.'))
      .finally(() => setLoadingOptions(false));
  }, [accessToken, user.email]);

  const runCnpjLookup = async (cnpj: string) => {
    const digits = cnpj.replace(/\D/g, '');
    if (digits.length < 11) {
      setLookupHint(null);
      return;
    }
    if (USE_MOCK_DATA) {
      if (digits.startsWith('23373')) {
        setForm((f) => ({ ...f, nomeCliente: 'VAMOS LOCACAO (demo)' }));
        setLookupHint('Demo: cliente encontrado.');
      } else {
        setLookupHint('Demo: informe o nome manualmente.');
      }
      return;
    }

    setLookupLoading(true);
    setLookupHint(null);
    try {
      const hit = await lookupCustomerByCnpj(accessToken, cnpj);
      if (hit.nome) {
        setForm((f) => ({
          ...f,
          nomeCliente: hit.nome,
          vendedor: hit.vendedor || f.vendedor || '',
        }));
        setLookupHint(
          hit.source === 'customers'
            ? 'Cliente encontrado no cadastro BInsight.'
            : 'Cliente encontrado em pedidos anteriores no Mapa.'
        );
      } else {
        setLookupHint('CNPJ não encontrado — preencha o nome manualmente.');
      }
    } catch {
      setLookupHint('Não foi possível consultar o CNPJ. Preencha o nome manualmente.');
    } finally {
      setLookupLoading(false);
    }
  };

  const handleCnpjChange = (raw: string) => {
    const formatted = formatCnpjInput(raw);
    setForm((f) => ({ ...f, cnpj: formatted }));
    if (normalizeDigits(formatted).length === 14) {
      void runCnpjLookup(formatted);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const payload: Partial<PedidoMapa> = {
        ...form,
        ...derived,
        mapaKind,
        cnpj: form.cnpj?.trim() ?? '',
      };
      if (mapaKind === 'pedido') {
        payload.statusPgto = deriveStatusPgtoFromParcels(
          form.parc1 ?? '',
          form.parc2 ?? '',
          form.parc3 ?? '',
          form.parc4 ?? ''
        );
      } else {
        const venc = (form.vencimento ?? form.parc1 ?? '').trim();
        payload.vencimento = venc;
        payload.parc1 = venc;
        payload.tipoRecorrencia = form.tipoRecorrencia ?? 'Assinatura de Licença';
        payload.statusContrato = form.statusContrato ?? 'Ativo';
        payload.statusPgto = venc ? 'A VENCER' : 'SEM DATA';
      }
      await onSubmit(payload);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao criar pedido.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/40">
      <form
        onSubmit={handleSubmit}
        className="bg-white w-full sm:max-w-2xl max-h-[94vh] overflow-hidden rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col"
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 shrink-0">
          <div>
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <Plus className="w-4 h-4 text-purple-600" />
              Novo pedido no Mapa
            </h3>
            <p className="text-[11px] text-slate-500 mt-0.5">
              {USE_MOCK_DATA
                ? 'Preview local — não grava no Google Sheets.'
                : mapaKind === 'pedido'
                  ? <>CONSOLIDADO + aba mensal <strong>{monthlyHint || '—'}</strong></>
                  : <>Grava na aba <strong>ASSINATURAS</strong> (licenças / recorrência)</>}
            </p>
          </div>
          <button type="button" onClick={onClose} className="p-2 rounded-lg hover:bg-slate-100 text-slate-400">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">{error}</div>
          )}

          {loadingOptions ? (
            <div className="flex items-center gap-2 text-xs text-slate-500 py-8 justify-center">
              <Loader2 className="w-4 h-4 animate-spin" /> Carregando distribuidores e vendedores…
            </div>
          ) : (
            <>
              <Section title="Tipo de registro">
                <div className="flex flex-wrap gap-2">
                  {(
                    [
                      ['pedido', 'Pedido (hardware / one-shot)'],
                      ['assinatura', 'Assinatura (licença / software)'],
                    ] as const
                  ).map(([kind, label]) => (
                    <button
                      key={kind}
                      type="button"
                      onClick={() => setMapaKind(kind)}
                      className={`px-3 py-2 rounded-lg text-[11px] font-bold border transition ${
                        mapaKind === kind
                          ? 'bg-purple-700 text-white border-purple-700'
                          : 'bg-white text-slate-600 border-slate-200 hover:border-purple-300'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </Section>

              <Section title="Identificação">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Field label="Data (col A)">
                    <input
                      type="date"
                      required
                      value={brDateToIso(form.data ?? '')}
                      onChange={(e) => setForm((f) => ({ ...f, data: isoDateToBR(e.target.value) }))}
                      className={inputCls}
                    />
                  </Field>
                  <Field label="Vendedor (col B)">
                    <select
                      required
                      value={form.vendedor ?? ''}
                      onChange={(e) => setForm((f) => ({ ...f, vendedor: e.target.value }))}
                      className={inputCls}
                    >
                      <option value="">Selecione…</option>
                      {(options?.vendedores ?? []).map((v) => (
                        <option key={v.email} value={v.nome}>
                          {v.nome}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="CNPJ (col C)">
                    <div className="relative">
                      <input
                        type="text"
                        required
                        placeholder="00.000.000/0000-00"
                        value={form.cnpj ?? ''}
                        onChange={(e) => handleCnpjChange(e.target.value)}
                        onBlur={() => void runCnpjLookup(form.cnpj ?? '')}
                        className={inputCls}
                      />
                      {lookupLoading && (
                        <Loader2 className="w-4 h-4 animate-spin text-purple-500 absolute right-3 top-2.5" />
                      )}
                    </div>
                    {lookupHint && <p className="text-[10px] text-slate-500 mt-1">{lookupHint}</p>}
                  </Field>
                  <Field label="Nome do cliente (col D)">
                    <input
                      type="text"
                      required
                      value={form.nomeCliente ?? ''}
                      onChange={(e) => setForm((f) => ({ ...f, nomeCliente: e.target.value }))}
                      className={inputCls}
                    />
                  </Field>
                  <Field label="N° Ped. Cliente / OC (col E)">
                    <input
                      type="text"
                      value={form.numPedidoCli ?? ''}
                      onChange={(e) => setForm((f) => ({ ...f, numPedidoCli: e.target.value }))}
                      className={inputCls}
                    />
                  </Field>
                  <Field label="Prioridade (col F)">
                    {mapaKind === 'pedido' ? (
                      <select
                        value={form.prioridade ?? 'Média'}
                        onChange={(e) => setForm((f) => ({ ...f, prioridade: e.target.value }))}
                        className={inputCls}
                      >
                        {PRIORIDADES.map((p) => (
                          <option key={p} value={p}>
                            {p}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <select
                        value={form.tipoRecorrencia ?? 'Assinatura de Licença'}
                        onChange={(e) => setForm((f) => ({ ...f, tipoRecorrencia: e.target.value }))}
                        className={inputCls}
                      >
                        {TIPO_RECORRENCIA_OPTIONS.map((o) => (
                          <option key={o} value={o}>
                            {o}
                          </option>
                        ))}
                      </select>
                    )}
                  </Field>
                  {mapaKind === 'assinatura' && (
                    <>
                      <Field label="Status contrato (col F)">
                        <select
                          value={form.statusContrato ?? 'Ativo'}
                          onChange={(e) => setForm((f) => ({ ...f, statusContrato: e.target.value }))}
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
                          onChange={(e) => setForm((f) => ({ ...f, periodicidade: e.target.value }))}
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
                    </>
                  )}
                </div>
              </Section>

              <Section title="Produto e distribuidor">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Field label="Descrição do produto (col G)" className="sm:col-span-2">
                    <textarea
                      required
                      rows={2}
                      value={form.descricaoProduto ?? ''}
                      onChange={(e) => setForm((f) => ({ ...f, descricaoProduto: e.target.value }))}
                      className={inputCls}
                    />
                  </Field>
                  <Field label="Distribuidor (col H)">
                    <select
                      required
                      value={form.distribuidor ?? ''}
                      onChange={(e) => setForm((f) => ({ ...f, distribuidor: e.target.value }))}
                      className={inputCls}
                    >
                      <option value="">Selecione…</option>
                      {(options?.distribuidores ?? []).map((d) => (
                        <option key={d} value={d}>
                          {d}
                        </option>
                      ))}
                    </select>
                    <p className="text-[10px] text-slate-400 mt-1">Lista: master DISTRIBUIDORES · col D (nome fantasia)</p>
                  </Field>
                  {mapaKind === 'pedido' ? (
                    <Field label="N° Ped. Distribuidor (col I)">
                      <input
                        type="text"
                        value={form.numPedidoDist ?? ''}
                        onChange={(e) => setForm((f) => ({ ...f, numPedidoDist: e.target.value }))}
                        className={inputCls}
                      />
                    </Field>
                  ) : (
                    <Field label="N° Contrato Dist. (col M)">
                      <input
                        type="text"
                        value={form.numContratoDist ?? ''}
                        onChange={(e) => setForm((f) => ({ ...f, numContratoDist: e.target.value }))}
                        className={inputCls}
                      />
                    </Field>
                  )}
                  <Field label="Quantidade (col R)">
                    <input
                      type="number"
                      min={1}
                      required
                      value={form.qtd ?? '1'}
                      onChange={(e) => setForm((f) => ({ ...f, qtd: e.target.value }))}
                      className={inputCls}
                    />
                  </Field>
                </div>
              </Section>

              <Section title="Valores (digitados — col S e U)">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Field label="R$ Custo unit. Distribuidor (col S)">
                    <input
                      type="text"
                      required
                      placeholder="R$ 454,00"
                      value={form.custoDist ?? ''}
                      onChange={(e) => setForm((f) => ({ ...f, custoDist: e.target.value }))}
                      className={inputCls}
                    />
                  </Field>
                  <Field label="R$ Venda unit. BInsight (col U)">
                    <input
                      type="text"
                      required
                      placeholder="R$ 629,00"
                      value={form.vendBins ?? ''}
                      onChange={(e) => setForm((f) => ({ ...f, vendBins: e.target.value }))}
                      className={inputCls}
                    />
                  </Field>
                </div>
                <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2 rounded-xl bg-slate-50 border border-slate-100 p-3 text-center">
                  <Calc label="Total compra (T)" value={derived.totalCompra || formatBRLDisplay(0)} />
                  <Calc label="Venda total (V)" value={derived.vendaTotal || '—'} />
                  <Calc label="Margem % (W)" value={derived.vendaPct || '—'} />
                  <Calc label="Bruto (X)" value={derived.bruto || '—'} />
                </div>
                <p className="text-[10px] text-slate-400 mt-2">
                  Total compra, venda total, margem % e bruto são calculados automaticamente (Qtd × unitários).
                  Coluna Y (líquido) permanece vazia — fórmula/comissão na planilha.
                </p>
              </Section>

              <Section title={mapaKind === 'pedido' ? 'Pagamento e status' : 'Vencimento e status'}>
                {mapaKind === 'pedido' ? (
                  <ParcelVencimentoFields
                    parc1={form.parc1 ?? ''}
                    parc2={form.parc2 ?? ''}
                    parc3={form.parc3 ?? ''}
                    parc4={form.parc4 ?? ''}
                    statusPgto={form.statusPgto}
                    onChange={(next) => setForm((f) => ({ ...f, ...next }))}
                  />
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Field label="Vencimento (col N)">
                      <input
                        type="date"
                        value={form.vencimento ? brDateToIso(form.vencimento) : form.parc1 ? brDateToIso(form.parc1) : ''}
                        onChange={(e) => {
                          const venc = e.target.value ? isoDateToBR(e.target.value) : '';
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
                    <Field label="Status pagamento (col O)">
                      <input
                        type="text"
                        readOnly
                        value={form.statusPgto ?? 'SEM DATA'}
                        className={`${inputCls} bg-slate-50 text-slate-500`}
                      />
                    </Field>
                  </div>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
                  <Field label="Status pedido (col Q)">
                    <select
                      value={form.status ?? 'PENDENTE'}
                      onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
                      className={inputCls}
                    >
                      <option value="PENDENTE">PENDENTE</option>
                      <option value="SOLICITADO">SOLICITADO</option>
                      <option value="PENDENTE NF e Boleto">PENDENTE NF e Boleto</option>
                      <option value="FATURADO">FATURADO</option>
                      <option value="FINALIZADO">FINALIZADO</option>
                    </select>
                  </Field>
                  <Field label="Status comissão (col Z)">
                    <select
                      value={form.statusComissao ?? 'PENDENTE'}
                      onChange={(e) => setForm((f) => ({ ...f, statusComissao: e.target.value }))}
                      className={inputCls}
                    >
                      <option value="PENDENTE">PENDENTE</option>
                      <option value="SOLICITADO">SOLICITADO</option>
                      <option value="FINALIZADO">FINALIZADO</option>
                      <option value="PAGA">PAGA</option>
                    </select>
                  </Field>
                </div>
              </Section>

              {mapaKind === 'pedido' && (
                <Section title="Observações">
                  <div className="grid grid-cols-1 gap-3">
                    <Field label="Obs. pedido interna (col AA)">
                      <textarea
                        rows={2}
                        value={form.obsPedido ?? ''}
                        onChange={(e) => setForm((f) => ({ ...f, obsPedido: e.target.value }))}
                        placeholder="Ex.: 01/06/2026 - Pedido recebido e encaminhado ao distribuidor"
                        className={inputCls}
                      />
                    </Field>
                    <Field label="Obs. cliente / timeline (col AB)">
                      <select
                        value={form.obsCliente ?? ''}
                        onChange={(e) => setForm((f) => ({ ...f, obsCliente: e.target.value }))}
                        className={inputCls}
                      >
                        <option value="">—</option>
                        {OBS_CLIENTE_STATUSES.map((o) => (
                          <option key={o} value={o}>
                            {o}
                          </option>
                        ))}
                      </select>
                    </Field>
                  </div>
                </Section>
              )}
              {mapaKind === 'assinatura' && (
                <Section title="Observações">
                  <Field label="Obs. pedido (col X)">
                    <textarea
                      rows={2}
                      value={form.obsPedido ?? ''}
                      onChange={(e) => setForm((f) => ({ ...f, obsPedido: e.target.value }))}
                      className={inputCls}
                    />
                  </Field>
                </Section>
              )}
            </>
          )}
        </div>

        <div className="px-5 py-4 border-t border-slate-100 flex gap-3 justify-end shrink-0">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">
            Cancelar
          </button>
          <button
            type="submit"
            disabled={saving || loadingOptions}
            className="px-4 py-2 text-sm font-bold text-white bg-purple-700 hover:bg-purple-800 rounded-lg disabled:opacity-50 flex items-center gap-2"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            {mapaKind === 'assinatura' ? 'Criar assinatura' : 'Criar pedido'}
          </button>
        </div>
      </form>
    </div>
  );
}

function normalizeDigits(s: string): string {
  return s.replace(/\D/g, '');
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <h4 className="text-[10px] font-bold uppercase tracking-wider text-purple-600 mb-2">{title}</h4>
      {children}
    </div>
  );
}

function Field({
  label,
  children,
  className = '',
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">{label}</label>
      {children}
    </div>
  );
}

function Calc({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[9px] font-bold uppercase text-slate-400">{label}</p>
      <p className="text-xs font-bold text-slate-700">{value}</p>
    </div>
  );
}
