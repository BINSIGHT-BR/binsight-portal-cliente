/**
 * Cliente HTTP para Cloud Functions (Service Account → Sheets).
 * Usa Firebase ID Token — não requer OAuth Google Sheets no browser.
 */

import { auth } from './firebase';
import {
  ClientAccessRecord,
  ClientAccessStatus,
  OrderAlert,
  PedidoMapa,
  PortalUser,
} from '../types';

export type ClientStatus = 'none' | 'pendente' | 'ativo' | 'revogado';

export interface PedidosFilters {
  status?: string;
  distribuidor?: string;
  statusPgto?: string;
  search?: string;
  dateFrom?: string;
  dateTo?: string;
}

export interface StatusHistoryEntry {
  timestamp: string;
  rowNum: number;
  pedidoRef: string;
  field: 'status' | 'obsCliente';
  oldValue: string;
  newValue: string;
  changedBy: string;
}

function apiOrigin(): string {
  const env = import.meta.env.VITE_API_ORIGIN?.trim();
  if (env) return env.replace(/\/$/, '');
  const host = window.location.hostname;
  if (host.includes('localhost') || host.includes('127.0.0.1')) {
    return 'https://connect-binsight.web.app';
  }
  return '';
}

async function apiFetch<T>(path: string, options: RequestInit = {}, retried = false): Promise<T> {
  const token = await getIdToken(retried);
  const base = apiOrigin();
  const headers: Record<string, string> = {
    'X-Firebase-Authorization': `Bearer ${token}`,
    ...(options.headers as Record<string, string> | undefined),
  };
  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }
  const res = await fetch(`${base}/api/${path}`, {
    ...options,
    headers,
  });
  const text = await res.text();
  let body: { error?: string } = {};
  try {
    body = JSON.parse(text) as { error?: string };
  } catch {
    if (!res.ok && text.includes('401')) {
      if (!retried) return apiFetch<T>(path, options, true);
      throw new Error('Sessão expirada. Saia e entre novamente.');
    }
  }
  if (!res.ok) {
    if (res.status === 401 && !retried) {
      return apiFetch<T>(path, options, true);
    }
    throw new Error(body.error || `Erro na API (${res.status})`);
  }
  return JSON.parse(text) as T;
}

async function getIdToken(forceRefresh = false): Promise<string> {
  const user = auth.currentUser;
  if (!user) throw new Error('Sessão expirada. Faça login novamente.');
  return user.getIdToken(forceRefresh);
}

function toAccessRecord(raw: {
  email: string;
  nome: string;
  cnpj: string;
  status: ClientAccessStatus;
  approvedBy?: string;
  approvedAt?: string;
  additionalCnpjs?: string[];
  notifyEmail?: boolean;
}): ClientAccessRecord {
  return {
    email: raw.email,
    nome: raw.nome,
    cnpj: raw.cnpj,
    status: raw.status,
    aprovadoPor: raw.approvedBy ?? '',
    dataAprovacao: raw.approvedAt ?? '',
    cnpjsAdicionais: raw.additionalCnpjs ?? [],
    notifyEmail: raw.notifyEmail ?? true,
  };
}

function filtersToQuery(filters?: PedidosFilters): string {
  if (!filters) return '';
  const params = new URLSearchParams();
  if (filters.status) params.set('status', filters.status);
  if (filters.distribuidor) params.set('distribuidor', filters.distribuidor);
  if (filters.statusPgto) params.set('statusPgto', filters.statusPgto);
  if (filters.search) params.set('search', filters.search);
  if (filters.dateFrom) params.set('dateFrom', filters.dateFrom);
  if (filters.dateTo) params.set('dateTo', filters.dateTo);
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

export async function fetchMeFromApi(): Promise<{
  portalUser: PortalUser;
  clientStatus: ClientStatus;
}> {
  const data = await apiFetch<{ portalUser: PortalUser; clientStatus: ClientStatus }>('me');
  return data;
}

export async function fetchOrderDocumentFromApi(
  rowNum: number,
  kind: 'nf' | 'boleto',
  mapaTab?: string
): Promise<{ fileName: string; mimeType: string; blob: Blob }> {
  const tabQs = mapaTab?.trim() ? `?tab=${encodeURIComponent(mapaTab.trim())}` : '';
  const data = await apiFetch<{ fileName: string; mimeType: string; dataBase64: string }>(
    `pedidos/${rowNum}/document/${kind}${tabQs}`
  );
  const binary = atob(data.dataBase64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return {
    fileName: data.fileName,
    mimeType: data.mimeType,
    blob: new Blob([bytes], { type: data.mimeType }),
  };
}

export async function fetchPedidosFromApi(filters?: PedidosFilters): Promise<PedidoMapa[]> {
  const data = await apiFetch<{ pedidos: PedidoMapa[] }>(`pedidos${filtersToQuery(filters)}`);
  return data.pedidos;
}

export async function fetchAlertasFromApi(): Promise<OrderAlert[]> {
  const data = await apiFetch<{
    alertas: Array<{
      kind: OrderAlert['kind'];
      rowNum: number;
      nomeCliente: string;
      numPedidoCli: string;
      numNF: string;
      message: string;
      severity: OrderAlert['severity'];
    }>;
  }>('alertas');
  return data.alertas.map((a) => ({
    kind: a.kind,
    severity: a.severity,
    message: a.message,
    pedido: {
      rowNum: a.rowNum,
      nomeCliente: a.nomeCliente,
      numPedidoCli: a.numPedidoCli,
      numNF: a.numNF,
    } as PedidoMapa,
  }));
}

export async function fetchStatusHistoryFromApi(rowNum: number): Promise<StatusHistoryEntry[]> {
  const data = await apiFetch<{ historico: StatusHistoryEntry[] }>(
    `pedidos/${rowNum}/historico`
  );
  return data.historico;
}

export async function downloadNfFromApi(
  rowNum: number
): Promise<{ fileName: string; dataUrl: string }> {
  const data = await apiFetch<{ fileName: string; dataUrl: string }>(`pedidos/${rowNum}/nf`);
  return { fileName: data.fileName, dataUrl: data.dataUrl };
}

export async function uploadNfViaApi(rowNum: number, file: File): Promise<void> {
  const form = new FormData();
  form.append('file', file);
  await apiFetch(`pedidos/${rowNum}/nf`, { method: 'POST', body: form });
}

export async function deleteNfViaApi(rowNum: number): Promise<void> {
  await apiFetch(`pedidos/${rowNum}/nf`, { method: 'DELETE' });
}

export async function createPedidoViaApi(pedido: Partial<PedidoMapa>): Promise<PedidoMapa> {
  const data = await apiFetch<{ pedido: PedidoMapa }>('pedidos', {
    method: 'POST',
    body: JSON.stringify(pedido),
  });
  return data.pedido;
}

export async function updatePedidoViaApi(
  rowNum: number,
  pedido: Partial<PedidoMapa>
): Promise<PedidoMapa> {
  const data = await apiFetch<{ pedido: PedidoMapa }>(`pedidos/${rowNum}`, {
    method: 'PATCH',
    body: JSON.stringify(pedido),
  });
  return data.pedido;
}

export async function deletePedidoViaApi(rowNum: number): Promise<void> {
  await apiFetch(`pedidos/${rowNum}`, { method: 'DELETE' });
}

export async function fetchAcessosFromApi(): Promise<ClientAccessRecord[]> {
  const data = await apiFetch<{ acessos: Parameters<typeof toAccessRecord>[0][] }>('acessos');
  return data.acessos.map(toAccessRecord);
}

export async function createAcessoViaApi(payload: {
  email: string;
  nome: string;
  cnpj: string;
  additionalCnpjs?: string[];
}): Promise<void> {
  await apiFetch('acessos', { method: 'POST', body: JSON.stringify(payload) });
}

export async function patchAcessoViaApi(
  email: string,
  payload: {
    status?: ClientAccessStatus;
    nome?: string;
    cnpj?: string;
    additionalCnpjs?: string[];
  }
): Promise<void> {
  await apiFetch(`acessos/${encodeURIComponent(email)}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export async function deleteAcessoViaApi(email: string): Promise<void> {
  await apiFetch(`acessos/${encodeURIComponent(email)}`, { method: 'DELETE' });
}

export async function resetPasswordViaApi(email: string): Promise<string> {
  const data = await apiFetch<{ message: string }>(
    `acessos/${encodeURIComponent(email)}/reset-password`,
    { method: 'POST', body: JSON.stringify({}) }
  );
  return data.message;
}

export async function registerViaApi(nome: string, cnpj: string): Promise<void> {
  await apiFetch('register', {
    method: 'POST',
    body: JSON.stringify({ nome, cnpj }),
  });
}

export function triggerFileDownload(dataUrl: string, fileName: string): void {
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = fileName;
  a.click();
}
