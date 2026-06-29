import { CONSOLIDADO_TAB } from '../constants/columns';
import { PedidoMapa } from '../types';
import { isPedidoEntregue, isPagamentoVencido } from './clientOrderStatus';
import { isMeaningfulMapaRow, parseSheetDate } from './ordersCore';

export type PedidoBucket =
  | 'pendente'
  | 'faturado'
  | 'entregue'
  | 'cancelado'
  | 'rma';

export const BUCKET_LABELS: Record<PedidoBucket, string> = {
  pendente: 'Pendente',
  faturado: 'Faturado (em andamento)',
  entregue: 'Entregue / Finalizado',
  cancelado: 'Cancelado',
  rma: 'RMA',
};

export const BUCKET_COLORS: Record<PedidoBucket, string> = {
  pendente: '#f59e0b',
  faturado: '#3b82f6',
  entregue: '#22c55e',
  cancelado: '#ef4444',
  rma: '#8b5cf6',
};

export const VENDEDOR_PALETTE = [
  '#7c3aed',
  '#2563eb',
  '#0891b2',
  '#059669',
  '#d97706',
  '#db2777',
  '#4f46e5',
  '#0d9488',
  '#ca8a04',
  '#64748b',
];

export interface IndicatorFilters {
  dateFrom?: string;
  dateTo?: string;
  vendedores: string[];
  distribuidores: string[];
  buckets: PedidoBucket[];
}

export interface IndicatorKpis {
  totalVendas: number;
  semData: number;
  pendentes: number;
  faturados: number;
  entregues: number;
  cancelados: number;
  rma: number;
  pagamentoVencido: number;
  nfPendente3d: number;
}

export interface MonthVendedorRow {
  monthKey: string;
  monthLabel: string;
  [vendedor: string]: string | number;
}

export interface MonthBucketRow {
  monthKey: string;
  monthLabel: string;
  pendente: number;
  faturado: number;
  entregue: number;
  cancelado: number;
  rma: number;
}

export interface MonthPgtoRow {
  monthKey: string;
  monthLabel: string;
  vencida: number;
  aVencer: number;
  emDia: number;
  semData: number;
}

export interface IndicatorSummary {
  filtered: PedidoMapa[];
  kpis: IndicatorKpis;
  byMonthVendedor: MonthVendedorRow[];
  byMonthBucket: MonthBucketRow[];
  byMonthPgto: MonthPgtoRow[];
  vendedores: string[];
  matrixRows: { monthLabel: string; vendedor: string; count: number }[];
}

function emissaoIsSim(val: string): boolean {
  const v = val.trim().toLowerCase();
  return v === 'sim' || v === '✔' || v === 's' || v === 'yes';
}

function emissaoIsNao(val: string): boolean {
  const v = val.trim().toLowerCase();
  return v === 'não' || v === 'nao' || v === '✖' || v === 'n' || v === 'no';
}

function statusIncludes(status: string, ...needles: string[]): boolean {
  const s = status.toUpperCase();
  return needles.some((n) => s.includes(n));
}

function obsIncludes(obs: string, ...needles: string[]): boolean {
  const o = obs.toLowerCase();
  return needles.some((n) => o.includes(n.toLowerCase()));
}

const EXCLUDED_VENDEDORES = ['fernando dantas'];

function isExcludedVendedor(v: string): boolean {
  const n = v
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  return EXCLUDED_VENDEDORES.some((e) => n === e || n.includes(e));
}

/** Só aba CONSOLIDADO; exclui ASSINATURAS e vendedores internos. */
export function isMapaVendasRow(p: PedidoMapa): boolean {
  if (p.mapaKind === 'assinatura') return false;
  if (!isMeaningfulMapaRow(p)) return false;
  if (isExcludedVendedor(p.vendedor)) return false;
  const tab = (p.mapaTab ?? CONSOLIDADO_TAB).trim();
  return tab === CONSOLIDADO_TAB || !tab;
}

export function normalizeVendedor(v: string): string {
  const t = v.trim();
  return t || 'Sem vendedor';
}

export function classifyPedidoBucket(p: PedidoMapa): PedidoBucket {
  const obs = p.obsCliente ?? '';
  const status = p.status ?? '';

  if (obsIncludes(obs, 'rma')) return 'rma';
  if (statusIncludes(status, 'CANCELADO') || obsIncludes(obs, 'cancelado')) return 'cancelado';

  if (
    isPedidoEntregue({
      status,
      statusComissao: p.statusComissao,
      obsCliente: obs,
      emissao: p.emissao,
      data: p.data,
    }) ||
    statusIncludes(status, 'ENTREGUE', 'FINALIZADO') ||
    obsIncludes(obs, 'entregue', 'licença', 'licenca')
  ) {
    return 'entregue';
  }

  if (
    statusIncludes(status, 'FATURADO', 'TRANSITO', 'ROTA') ||
    emissaoIsSim(p.emissao) ||
    obsIncludes(obs, 'faturado', 'processo de entrega', 'licença', 'licenca')
  ) {
    return 'faturado';
  }

  return 'pendente';
}

function monthKeyFromDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

function monthLabelFromKey(key: string): string {
  const [y, m] = key.split('-');
  const month = parseInt(m, 10) - 1;
  const names = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  return `${names[month] ?? m}/${y}`;
}

function matchesDateRange(dataBR: string, dateFrom?: string, dateTo?: string): boolean {
  if (!dateFrom && !dateTo) return true;
  const d = parseSheetDate(dataBR);
  if (!d) return false;
  if (dateFrom) {
    const from = new Date(`${dateFrom}T00:00:00`);
    if (d < from) return false;
  }
  if (dateTo) {
    const to = new Date(`${dateTo}T23:59:59`);
    if (d > to) return false;
  }
  return true;
}

export function defaultIndicatorFilters(): IndicatorFilters {
  const now = new Date();
  const from = new Date(now.getFullYear(), 0, 1);
  return {
    dateFrom: from.toISOString().slice(0, 10),
    dateTo: now.toISOString().slice(0, 10),
    vendedores: [],
    distribuidores: [],
    buckets: [],
  };
}

export function filterIndicadorPedidos(
  pedidos: PedidoMapa[],
  filters: IndicatorFilters
): PedidoMapa[] {
  return pedidos.filter((p) => {
    if (!isMapaVendasRow(p)) return false;
    if (!matchesDateRange(p.data, filters.dateFrom, filters.dateTo)) return false;
    if (filters.vendedores.length && !filters.vendedores.includes(normalizeVendedor(p.vendedor)))
      return false;
    if (
      filters.distribuidores.length &&
      !filters.distribuidores.includes(p.distribuidor.trim() || 'Sem distribuidor')
    )
      return false;
    if (filters.buckets.length && !filters.buckets.includes(classifyPedidoBucket(p))) return false;
    return true;
  });
}

function daysSince(date: Date): number {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return Math.floor((now.getTime() - d.getTime()) / 86400000);
}

function isNfPendente3d(p: PedidoMapa): boolean {
  const orderDate = parseSheetDate(p.data);
  return Boolean(orderDate && emissaoIsNao(p.emissao) && daysSince(orderDate) >= 3);
}

function pgtoCategory(p: PedidoMapa): keyof Omit<MonthPgtoRow, 'monthKey' | 'monthLabel'> {
  const pg = p.statusPgto.toUpperCase();
  if (pg.includes('VENCID')) return 'vencida';
  if (pg.includes('A VENC') || pg.includes('VENCER')) return 'aVencer';
  if (pg.includes('SEM DATA') || !pg.trim()) return 'semData';
  return 'emDia';
}

export function buildIndicatorSummary(
  pedidos: PedidoMapa[],
  filters: IndicatorFilters
): IndicatorSummary {
  const scope = pedidos.filter(isMapaVendasRow);
  const filtered = filterIndicadorPedidos(pedidos, filters);

  const vendedorSet = new Set<string>();
  for (const p of scope) {
    vendedorSet.add(normalizeVendedor(p.vendedor));
  }
  const vendedores = [...vendedorSet].sort((a, b) => a.localeCompare(b, 'pt-BR'));

  const bucketCounts: Record<PedidoBucket, number> = {
    pendente: 0,
    faturado: 0,
    entregue: 0,
    cancelado: 0,
    rma: 0,
  };

  let semData = 0;
  let pagamentoVencido = 0;
  let nfPendente3d = 0;

  const monthVendedorMap = new Map<string, Map<string, number>>();
  const monthBucketMap = new Map<string, MonthBucketRow>();
  const monthPgtoMap = new Map<string, MonthPgtoRow>();

  for (const p of filtered) {
    const bucket = classifyPedidoBucket(p);
    bucketCounts[bucket] += 1;

    if (isPagamentoVencido(p)) pagamentoVencido += 1;
    if (isNfPendente3d(p)) nfPendente3d += 1;

    const d = parseSheetDate(p.data);
    if (!d) {
      semData += 1;
      continue;
    }

    const mk = monthKeyFromDate(d);
    const ml = monthLabelFromKey(mk);
    const vend = normalizeVendedor(p.vendedor);

    if (!monthVendedorMap.has(mk)) monthVendedorMap.set(mk, new Map());
    const vm = monthVendedorMap.get(mk)!;
    vm.set(vend, (vm.get(vend) ?? 0) + 1);

    if (!monthBucketMap.has(mk)) {
      monthBucketMap.set(mk, {
        monthKey: mk,
        monthLabel: ml,
        pendente: 0,
        faturado: 0,
        entregue: 0,
        cancelado: 0,
        rma: 0,
      });
    }
    monthBucketMap.get(mk)![bucket] += 1;

    if (!monthPgtoMap.has(mk)) {
      monthPgtoMap.set(mk, {
        monthKey: mk,
        monthLabel: ml,
        vencida: 0,
        aVencer: 0,
        emDia: 0,
        semData: 0,
      });
    }
    monthPgtoMap.get(mk)![pgtoCategory(p)] += 1;
  }

  const monthKeys = [...new Set([...monthVendedorMap.keys(), ...monthBucketMap.keys()])].sort();

  const byMonthVendedor: MonthVendedorRow[] = monthKeys.map((mk) => {
    const row: MonthVendedorRow = {
      monthKey: mk,
      monthLabel: monthLabelFromKey(mk),
    };
    const vm = monthVendedorMap.get(mk);
    for (const v of vendedores) {
      row[v] = vm?.get(v) ?? 0;
    }
    return row;
  });

  const byMonthBucket = monthKeys.map((mk) => monthBucketMap.get(mk)!);
  const byMonthPgto = monthKeys.map((mk) => monthPgtoMap.get(mk)!);

  const matrixRows: IndicatorSummary['matrixRows'] = [];
  for (const mk of monthKeys) {
    const ml = monthLabelFromKey(mk);
    const vm = monthVendedorMap.get(mk);
    if (!vm) continue;
    for (const [vendedor, count] of vm) {
      if (count > 0) matrixRows.push({ monthLabel: ml, vendedor, count });
    }
  }

  return {
    filtered,
    kpis: {
      totalVendas: filtered.length,
      semData,
      pendentes: bucketCounts.pendente,
      faturados: bucketCounts.faturado,
      entregues: bucketCounts.entregue,
      cancelados: bucketCounts.cancelado,
      rma: bucketCounts.rma,
      pagamentoVencido,
      nfPendente3d,
    },
    byMonthVendedor,
    byMonthBucket,
    byMonthPgto,
    vendedores,
    matrixRows,
  };
}

export function listDistribuidores(pedidos: PedidoMapa[]): string[] {
  const set = new Set<string>();
  for (const p of pedidos) {
    if (!isMapaVendasRow(p)) continue;
    set.add(p.distribuidor.trim() || 'Sem distribuidor');
  }
  return [...set].sort((a, b) => a.localeCompare(b, 'pt-BR'));
}

export function vendedorColor(vendedor: string, vendedores: string[]): string {
  const idx = vendedores.indexOf(vendedor);
  return VENDEDOR_PALETTE[idx >= 0 ? idx % VENDEDOR_PALETTE.length : 0];
}
