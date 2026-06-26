import {
  CLIENT_ACCESS_TAB,
  CLIENT_PORTAL_REGISTRY_TAB,
  getRegistrySpreadsheetId,
} from '../constants/columns';
import { ClientAccessRecord, ClientAccessStatus } from '../types';
import {
  appendSheetRows,
  fetchSheetRange,
  listSheetTitles,
  updateSheetRange,
  withTokenRetry,
} from './googleSheets';
import { normalizeCNPJ } from './orders';

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function todayBR(): string {
  const d = new Date();
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

/** Col H — default Sim se vazio (cadastros antigos). */
export function parseNotifyFlag(raw: string): boolean {
  const s = String(raw ?? '').trim().toLowerCase();
  if (s === 'não' || s === 'nao' || s === 'n' || s === 'false' || s === '0') return false;
  return true;
}

export function formatNotifyFlag(value: boolean): string {
  return value ? 'Sim' : 'Não';
}

function parseRow(row: string[]): ClientAccessRecord | null {
  const email = normalizeEmail(String(row[0] ?? ''));
  if (!email) return null;
  const extras = String(row[6] ?? '')
    .split(/[,;]/)
    .map((s) => normalizeCNPJ(s.trim()))
    .filter((s) => s.length >= 11);
  return {
    email,
    nome: String(row[1] ?? '').trim(),
    cnpj: normalizeCNPJ(String(row[2] ?? '')),
    status: (String(row[3] ?? 'PENDENTE').trim().toUpperCase() || 'PENDENTE') as ClientAccessStatus,
    aprovadoPor: String(row[4] ?? '').trim(),
    dataAprovacao: String(row[5] ?? '').trim(),
    cnpjsAdicionais: extras,
    notifyEmail: parseNotifyFlag(String(row[7] ?? '')),
  };
}

const REGISTRY_DATA_RANGE = 'A2:H2000';

async function resolveRegistryTab(accessToken: string): Promise<string> {
  const spreadsheetId = getRegistrySpreadsheetId();
  const titles = await listSheetTitles(accessToken, spreadsheetId);
  if (titles.includes(CLIENT_PORTAL_REGISTRY_TAB)) return CLIENT_PORTAL_REGISTRY_TAB;
  return CLIENT_ACCESS_TAB;
}

export async function fetchRegistryRecords(accessToken: string): Promise<ClientAccessRecord[]> {
  const spreadsheetId = getRegistrySpreadsheetId();
  return withTokenRetry(accessToken, async (token) => {
    const tab = await resolveRegistryTab(token);
    const rows = await fetchSheetRange(token, spreadsheetId, `${tab}!${REGISTRY_DATA_RANGE}`);
    return rows
      .map((row) => parseRow(row))
      .filter((r): r is ClientAccessRecord => r !== null);
  });
}

export async function fetchRegistryForEmail(
  accessToken: string,
  email: string
): Promise<ClientAccessRecord | null> {
  const all = await fetchRegistryRecords(accessToken);
  return all.find((r) => r.email === normalizeEmail(email)) ?? null;
}

/** E-mails ATIVOS com NOTIFY=Sim para o CNPJ do pedido. */
export async function fetchNotifyRecipientsForCnpj(
  accessToken: string,
  cnpj: string
): Promise<string[]> {
  const digits = normalizeCNPJ(cnpj);
  if (digits.length < 11) return [];
  const records = await fetchRegistryRecords(accessToken);
  const out: string[] = [];
  for (const r of records) {
    if (r.status !== 'ATIVO' || !r.notifyEmail) continue;
    if (allCnpjsFromRecord(r).includes(digits)) out.push(r.email);
  }
  return out;
}

async function findRegistryRowNum(
  accessToken: string,
  email: string
): Promise<{ tab: string; rowNum: number } | null> {
  const spreadsheetId = getRegistrySpreadsheetId();
  return withTokenRetry(accessToken, async (token) => {
    const tab = await resolveRegistryTab(token);
    const rows = await fetchSheetRange(token, spreadsheetId, `${tab}!${REGISTRY_DATA_RANGE}`);
    const target = normalizeEmail(email);
    for (let i = 0; i < rows.length; i++) {
      if (normalizeEmail(String(rows[i][0] ?? '')) === target) {
        return { tab, rowNum: i + 2 };
      }
    }
    return null;
  });
}

export async function registerClientAccess(
  accessToken: string,
  email: string,
  nome: string,
  cnpj: string,
  notifyEmail = true
): Promise<void> {
  const existing = await fetchRegistryForEmail(accessToken, email);
  if (existing) throw new Error('Já existe uma solicitação para este e-mail.');

  const digits = normalizeCNPJ(cnpj);
  if (digits.length < 11) throw new Error('Informe um CNPJ válido.');

  const spreadsheetId = getRegistrySpreadsheetId();
  await withTokenRetry(accessToken, async (token) => {
    const tab = await resolveRegistryTab(token);
    await appendSheetRows(token, spreadsheetId, tab, [
      [
        normalizeEmail(email),
        nome.trim(),
        digits,
        'PENDENTE',
        '',
        '',
        '',
        formatNotifyFlag(notifyEmail),
      ],
    ]);
  });
}

export async function updateNotifyPreference(
  accessToken: string,
  email: string,
  notifyEmail: boolean
): Promise<void> {
  const loc = await findRegistryRowNum(accessToken, email);
  if (!loc) throw new Error('Registro não encontrado.');

  const spreadsheetId = getRegistrySpreadsheetId();
  await withTokenRetry(accessToken, async (token) => {
    const rows = await fetchSheetRange(
      token,
      spreadsheetId,
      `${loc.tab}!A${loc.rowNum}:H${loc.rowNum}`
    );
    const row = rows[0] ?? [];
    while (row.length < 8) row.push('');
    row[7] = formatNotifyFlag(notifyEmail);
    await updateSheetRange(
      token,
      spreadsheetId,
      `${loc.tab}!A${loc.rowNum}:H${loc.rowNum}`,
      [row]
    );
  });
}

export async function setClientAccessStatus(
  accessToken: string,
  email: string,
  status: ClientAccessStatus,
  approvedBy: string
): Promise<void> {
  const loc = await findRegistryRowNum(accessToken, email);
  if (!loc) throw new Error('Registro não encontrado.');

  const spreadsheetId = getRegistrySpreadsheetId();
  await withTokenRetry(accessToken, async (token) => {
    const rows = await fetchSheetRange(
      token,
      spreadsheetId,
      `${loc.tab}!A${loc.rowNum}:H${loc.rowNum}`
    );
    const row = rows[0] ?? [];
    row[3] = status;
    if (status === 'ATIVO') {
      row[4] = approvedBy;
      row[5] = todayBR();
    }
    await updateSheetRange(
      token,
      spreadsheetId,
      `${loc.tab}!A${loc.rowNum}:H${loc.rowNum}`,
      [row]
    );
  });
}

export async function createRegistryRecordManual(
  accessToken: string,
  payload: {
    email: string;
    nome: string;
    cnpj: string;
    additionalCnpjs?: string[];
    notifyEmail?: boolean;
  }
): Promise<void> {
  const existing = await fetchRegistryForEmail(accessToken, payload.email);
  if (existing) throw new Error('Já existe um registro para este e-mail.');

  const digits = normalizeCNPJ(payload.cnpj);
  if (digits.length < 11) throw new Error('Informe um CNPJ válido.');
  const extras = (payload.additionalCnpjs ?? [])
    .map(normalizeCNPJ)
    .filter((s) => s.length >= 11)
    .join(';');

  const spreadsheetId = getRegistrySpreadsheetId();
  await withTokenRetry(accessToken, async (token) => {
    const tab = await resolveRegistryTab(token);
    await appendSheetRows(token, spreadsheetId, tab, [
      [
        normalizeEmail(payload.email),
        payload.nome.trim(),
        digits,
        'PENDENTE',
        '',
        '',
        extras,
        formatNotifyFlag(payload.notifyEmail !== false),
      ],
    ]);
  });
}

export async function updateRegistryRecord(
  accessToken: string,
  email: string,
  payload: {
    nome?: string;
    cnpj?: string;
    additionalCnpjs?: string[];
    status?: ClientAccessStatus;
    notifyEmail?: boolean;
  }
): Promise<void> {
  const loc = await findRegistryRowNum(accessToken, email);
  if (!loc) throw new Error('Registro não encontrado.');

  const spreadsheetId = getRegistrySpreadsheetId();
  await withTokenRetry(accessToken, async (token) => {
    const rows = await fetchSheetRange(
      token,
      spreadsheetId,
      `${loc.tab}!A${loc.rowNum}:H${loc.rowNum}`
    );
    const row = rows[0] ?? [];
    if (payload.nome !== undefined) row[1] = payload.nome;
    if (payload.cnpj !== undefined) row[2] = normalizeCNPJ(payload.cnpj);
    if (payload.status !== undefined) row[3] = payload.status;
    if (payload.additionalCnpjs !== undefined) {
      row[6] = payload.additionalCnpjs.map(normalizeCNPJ).filter((s) => s.length >= 11).join(';');
    }
    if (payload.notifyEmail !== undefined) row[7] = formatNotifyFlag(payload.notifyEmail);
    await updateSheetRange(
      token,
      spreadsheetId,
      `${loc.tab}!A${loc.rowNum}:H${loc.rowNum}`,
      [row]
    );
  });
}

export async function deleteRegistryRecord(accessToken: string, email: string): Promise<void> {
  const loc = await findRegistryRowNum(accessToken, email);
  if (!loc) return;

  const spreadsheetId = getRegistrySpreadsheetId();
  await withTokenRetry(accessToken, async (token) => {
    await updateSheetRange(
      token,
      spreadsheetId,
      `${loc.tab}!A${loc.rowNum}:H${loc.rowNum}`,
      [['', '', '', 'REVOGADO', '', '', '', '']]
    );
  });
}

export function allCnpjsFromRecord(r: ClientAccessRecord): string[] {
  const set = new Set<string>();
  if (r.cnpj) set.add(r.cnpj);
  for (const c of r.cnpjsAdicionais) set.add(c);
  return Array.from(set);
}
