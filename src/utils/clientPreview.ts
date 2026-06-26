import { ClientAccessRecord } from '../types';
import { allCnpjsFromRecord } from './registrySheet';

const STORAGE_KEY = 'binsight_connect_client_preview';

export interface ClientPreviewState {
  email: string;
  nome: string;
  cnpjs: string[];
}

export function loadClientPreview(): ClientPreviewState | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ClientPreviewState;
    if (!parsed.email || !parsed.cnpjs?.length) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveClientPreview(state: ClientPreviewState | null): void {
  if (!state) {
    sessionStorage.removeItem(STORAGE_KEY);
    return;
  }
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function previewFromRecord(record: ClientAccessRecord): ClientPreviewState {
  return {
    email: record.email,
    nome: record.nome,
    cnpjs: allCnpjsFromRecord(record),
  };
}
