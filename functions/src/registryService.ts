import {
  CLIENT_ACCESS_TAB,
  CLIENT_PORTAL_REGISTRY_TAB,
  ClientAccessStatus,
  ClientPortalRecord,
  NotifyRecipient,
  getRegistrySpreadsheetId,
} from './constants';
import {
  appendSheetRows,
  fetchSheetRange,
  listSheetTitles,
  updateSheetValues,
} from './sheetsClient';
import { displayContactName } from './clientContact';
import { notifyFinanceiroNewRegistration } from './emailService';

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function normalizeCNPJ(raw: string): string {
  return raw.replace(/\D/g, '');
}

function parseNotifyFlag(raw: string): boolean {
  const s = String(raw ?? '').trim().toLowerCase();
  if (s === 'não' || s === 'nao' || s === 'n' || s === 'false' || s === '0') return false;
  return true;
}

function allCnpjsFromRecord(r: ClientPortalRecord): string[] {
  const set = new Set<string>();
  if (r.cnpj) {
    const c = normalizeCNPJ(r.cnpj);
    if (c.length >= 11) set.add(c);
  }
  for (const raw of r.additionalCnpjs) {
    const c = normalizeCNPJ(raw);
    if (c.length >= 11) set.add(c);
  }
  return Array.from(set);
}

function parseRegistryRow(row: string[], rowNum: number): ClientPortalRecord | null {
  const email = normalizeEmail(String(row[0] ?? ''));
  if (!email) return null;
  const status = (String(row[3] ?? 'PENDENTE').trim().toUpperCase() ||
    'PENDENTE') as ClientAccessStatus;
  const extras = String(row[6] ?? '')
    .split(/[,;]/)
    .map((s) => normalizeCNPJ(s.trim()))
    .filter((s) => s.length >= 11);
  return {
    email,
    nome: String(row[1] ?? '').trim(),
    cnpj: normalizeCNPJ(String(row[2] ?? '')),
    status,
    approvedBy: String(row[4] ?? '').trim(),
    approvedAt: String(row[5] ?? '').trim(),
    additionalCnpjs: extras,
    notifyEmail: parseNotifyFlag(String(row[7] ?? '')),
    nomeContato: String(row[8] ?? '').trim(),
    sobrenomeContato: String(row[9] ?? '').trim(),
    rowNum,
  };
}

async function resolveRegistryTab(): Promise<string> {
  const spreadsheetId = getRegistrySpreadsheetId();
  const titles = await listSheetTitles(spreadsheetId);
  if (titles.includes(CLIENT_PORTAL_REGISTRY_TAB)) return CLIENT_PORTAL_REGISTRY_TAB;
  return CLIENT_ACCESS_TAB;
}

export async function fetchRegistryRecords(): Promise<ClientPortalRecord[]> {
  const spreadsheetId = getRegistrySpreadsheetId();
  const tab = await resolveRegistryTab();
  const rows = await fetchSheetRange(spreadsheetId, `${tab}!A2:J2000`);
  return rows
    .map((row, i) => parseRegistryRow(row, i + 2))
    .filter((r): r is ClientPortalRecord => r !== null);
}

export async function fetchRegistryForEmail(
  email: string
): Promise<ClientPortalRecord | null> {
  const target = normalizeEmail(email);
  const all = await fetchRegistryRecords();
  return all.find((r) => r.email === target) ?? null;
}

/** E-mails ATIVOS com NOTIFY=Sim para o CNPJ do pedido. */
export async function fetchNotifyRecipientsForCnpj(cnpj: string): Promise<string[]> {
  const profiles = await fetchNotifyRecipientProfilesForCnpj(cnpj);
  return profiles.map((p) => p.email);
}

/** Destinatários com nome cadastrado (cols I/J ou col B) para saudação no e-mail. */
export async function fetchNotifyRecipientProfilesForCnpj(
  cnpj: string
): Promise<NotifyRecipient[]> {
  const digits = normalizeCNPJ(cnpj);
  if (digits.length < 11) return [];
  const records = await fetchRegistryRecords();
  const out: NotifyRecipient[] = [];
  for (const r of records) {
    if (r.status !== 'ATIVO' || !r.notifyEmail) continue;
    if (allCnpjsFromRecord(r).includes(digits)) {
      out.push({ email: r.email, displayName: displayContactName(r) });
    }
  }
  return out;
}

export async function registerClientAccess(
  email: string,
  nome: string,
  cnpj: string,
  additionalCnpjs: string[] = []
): Promise<ClientPortalRecord> {
  const spreadsheetId = getRegistrySpreadsheetId();
  const tab = await resolveRegistryTab();
  const existing = await fetchRegistryForEmail(email);
  if (existing) {
    throw new Error('Já existe uma solicitação para este e-mail.');
  }
  const digits = normalizeCNPJ(cnpj);
  if (digits.length !== 14) throw new Error('Informe um CNPJ válido (14 dígitos).');
  const extras = additionalCnpjs
    .map(normalizeCNPJ)
    .filter((s) => s.length === 14 && s !== digits)
    .join(';');

  await appendSheetRows(spreadsheetId, tab, [
    [normalizeEmail(email), nome.trim(), digits, 'PENDENTE', '', '', extras, 'Sim'],
  ]);

  const record: ClientPortalRecord = {
    email: normalizeEmail(email),
    nome: nome.trim(),
    cnpj: digits,
    status: 'PENDENTE',
    approvedBy: '',
    approvedAt: '',
    additionalCnpjs: extras ? extras.split(';') : [],
    notifyEmail: true,
    rowNum: 0,
  };

  await notifyFinanceiroNewRegistration(record);
  return record;
}

export async function setRegistryStatus(
  email: string,
  status: ClientAccessStatus,
  approvedBy: string
): Promise<void> {
  await updateRegistryRecord(email, { status, approvedBy });
}

export async function createRegistryRecord(
  email: string,
  nome: string,
  cnpj: string,
  additionalCnpjs: string[] = []
): Promise<ClientPortalRecord> {
  const spreadsheetId = getRegistrySpreadsheetId();
  const tab = await resolveRegistryTab();
  const existing = await fetchRegistryForEmail(email);
  if (existing) throw new Error('Já existe um registro para este e-mail.');

  const digits = normalizeCNPJ(cnpj);
  if (digits.length < 11) throw new Error('Informe um CNPJ válido.');
  const extras = additionalCnpjs.map(normalizeCNPJ).filter((s) => s.length >= 11).join(';');

  await appendSheetRows(spreadsheetId, tab, [
    [normalizeEmail(email), nome.trim(), digits, 'PENDENTE', '', '', extras, 'Sim'],
  ]);

  return {
    email: normalizeEmail(email),
    nome: nome.trim(),
    cnpj: digits,
    status: 'PENDENTE',
    approvedBy: '',
    approvedAt: '',
    additionalCnpjs: extras ? extras.split(';') : [],
    notifyEmail: true,
    rowNum: 0,
  };
}

export async function updateRegistryRecord(
  email: string,
  updates: {
    nome?: string;
    cnpj?: string;
    status?: ClientAccessStatus;
    approvedBy?: string;
    additionalCnpjs?: string[];
  }
): Promise<void> {
  const spreadsheetId = getRegistrySpreadsheetId();
  const tab = await resolveRegistryTab();
  const rows = await fetchSheetRange(spreadsheetId, `${tab}!A2:J2000`);
  const target = normalizeEmail(email);

  for (let i = 0; i < rows.length; i++) {
    if (normalizeEmail(String(rows[i][0] ?? '')) !== target) continue;
    const rowNum = i + 2;
    const current = parseRegistryRow(rows[i], rowNum);
    if (!current) throw new Error('Registro inválido.');

    const nome = updates.nome?.trim() ?? current.nome;
    const cnpj = updates.cnpj ? normalizeCNPJ(updates.cnpj) : current.cnpj;
    const status = updates.status ?? current.status;
    const approvedBy = updates.approvedBy ?? current.approvedBy;
    const today = new Date().toLocaleDateString('pt-BR');
    const approvedAt =
      status === 'ATIVO' && status !== current.status
        ? today
        : current.approvedAt;
    const extras =
      updates.additionalCnpjs !== undefined
        ? updates.additionalCnpjs.map(normalizeCNPJ).filter((s) => s.length >= 11).join(';')
        : current.additionalCnpjs.join(';');

    await updateSheetValues(spreadsheetId, `${tab}!A${rowNum}:H${rowNum}`, [
      [target, nome, cnpj, status, approvedBy, approvedAt, extras, current.notifyEmail ? 'Sim' : 'Não'],
    ]);
    return;
  }
  throw new Error('Registro não encontrado.');
}

export async function deleteRegistryRecord(email: string): Promise<void> {
  const spreadsheetId = getRegistrySpreadsheetId();
  const tab = await resolveRegistryTab();
  const rows = await fetchSheetRange(spreadsheetId, `${tab}!A2:J2000`);
  const target = normalizeEmail(email);

  for (let i = 0; i < rows.length; i++) {
    if (normalizeEmail(String(rows[i][0] ?? '')) === target) {
      const rowNum = i + 2;
      await updateSheetValues(spreadsheetId, `${tab}!A${rowNum}:H${rowNum}`, [
        ['', '', '', 'REVOGADO', '', '', '', ''],
      ]);
      return;
    }
  }
  throw new Error('Registro não encontrado.');
}

export function toClientPortalUser(record: ClientPortalRecord) {
  return {
    email: record.email,
    nome: record.nome,
    cnpj: record.cnpj,
    status: record.status,
    approvedBy: record.approvedBy,
    approvedAt: record.approvedAt,
    additionalCnpjs: record.additionalCnpjs,
  };
}
