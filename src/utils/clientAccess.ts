import { USE_MOCK_DATA, USE_OAUTH_SHEETS } from '../constants/columns';
import { ClientAccessRecord, ClientAccessStatus } from '../types';
import {
  createRegistryRecordManual,
  deleteRegistryRecord,
  fetchRegistryRecords,
  fetchRegistryForEmail,
  registerClientAccess,
  setClientAccessStatus as setRegistryAccessStatus,
  updateRegistryRecord,
  allCnpjsFromRecord,
} from './registrySheet';
import { sendPortalPasswordResetEmail } from './firebase';
import {
  adminResetSheetPassword,
  isConnectPortalConfigured,
  isSheetSessionToken,
  updateNotifyViaSheetAuth,
} from './connectPortalApi';
import {
  createAcessoViaApi,
  deleteAcessoViaApi,
  fetchAcessosFromApi,
  patchAcessoViaApi,
  registerViaApi,
  resetPasswordViaApi,
} from './clienteApi';

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export async function fetchClientAccessRecords(
  accessToken: string
): Promise<ClientAccessRecord[]> {
  if (USE_MOCK_DATA) return [];
  if (USE_OAUTH_SHEETS) return fetchRegistryRecords(accessToken);
  return fetchAcessosFromApi();
}

export async function fetchClientAccessForEmail(
  accessToken: string,
  email: string
): Promise<ClientAccessRecord | null> {
  if (USE_MOCK_DATA) return null;
  if (USE_OAUTH_SHEETS) return fetchRegistryForEmail(accessToken, email);
  const all = await fetchClientAccessRecords(accessToken);
  return all.find((r) => r.email === normalizeEmail(email)) ?? null;
}

export function getActiveCnpjsForRecord(r: ClientAccessRecord | null): string[] {
  if (!r || r.status !== 'ATIVO') return [];
  return allCnpjsForRecord(r);
}

export async function requestClientAccess(
  accessToken: string,
  email: string,
  nome: string,
  cnpj: string,
  notifyEmail = true,
  contact?: { nomeContato?: string; sobrenomeContato?: string }
): Promise<void> {
  if (USE_MOCK_DATA) {
    throw new Error('Cadastro indisponível em modo mock.');
  }
  if (USE_OAUTH_SHEETS) {
    await registerClientAccess(accessToken, email, nome, cnpj, notifyEmail, contact);
    const { notifyFinanceiroCadastro } = await import('./notifyService');
    void notifyFinanceiroCadastro({
      email: email.trim().toLowerCase(),
      nome,
      cnpj,
      notifyEmail,
    });
    return;
  }
  await registerViaApi(nome, cnpj);
}

export async function updateNotifyPreference(
  accessToken: string,
  email: string,
  notifyEmail: boolean
): Promise<void> {
  if (USE_MOCK_DATA) return;
  if (isSheetSessionToken(accessToken)) {
    await updateNotifyViaSheetAuth(accessToken, notifyEmail);
    return;
  }
  if (USE_OAUTH_SHEETS) {
    const { updateNotifyPreference: updateSheet } = await import('./registrySheet');
    await updateSheet(accessToken, email, notifyEmail);
    return;
  }
  throw new Error('Preferências disponíveis apenas em modo OAuth.');
}

export async function setClientAccessStatus(
  accessToken: string,
  email: string,
  status: ClientAccessStatus,
  approvedBy: string
): Promise<void> {
  if (USE_MOCK_DATA) return;
  if (USE_OAUTH_SHEETS) {
    await setRegistryAccessStatus(accessToken, email, status, approvedBy);
    return;
  }
  await patchAcessoViaApi(email, { status });
}

export async function createClientAccessManual(
  accessToken: string,
  payload: {
    email: string;
    nome: string;
    cnpj: string;
    additionalCnpjs?: string[];
    nomeContato?: string;
    sobrenomeContato?: string;
  }
): Promise<void> {
  if (USE_MOCK_DATA) return;
  if (USE_OAUTH_SHEETS) {
    await createRegistryRecordManual(accessToken, payload);
    return;
  }
  await createAcessoViaApi(payload);
}

export async function updateClientAccess(
  accessToken: string,
  email: string,
  payload: {
    nome?: string;
    cnpj?: string;
    additionalCnpjs?: string[];
    status?: ClientAccessStatus;
    nomeContato?: string;
    sobrenomeContato?: string;
  }
): Promise<void> {
  if (USE_MOCK_DATA) return;
  if (USE_OAUTH_SHEETS) {
    await updateRegistryRecord(accessToken, email, payload);
    return;
  }
  await patchAcessoViaApi(email, payload);
}

export async function deleteClientAccess(accessToken: string, email: string): Promise<void> {
  if (USE_MOCK_DATA) return;
  if (USE_OAUTH_SHEETS) {
    await deleteRegistryRecord(accessToken, email);
    return;
  }
  await deleteAcessoViaApi(email);
}

export async function resetClientPassword(email: string, actorEmail?: string): Promise<string> {
  if (USE_MOCK_DATA) {
    return 'Reset de senha simulado (modo mock).';
  }
  if (USE_OAUTH_SHEETS) {
    if (isConnectPortalConfigured()) {
      if (!actorEmail) {
        throw new Error('E-mail do administrador é obrigatório para reset de senha.');
      }
      return adminResetSheetPassword(email, actorEmail);
    }
    await sendPortalPasswordResetEmail(email);
    return `E-mail de redefinição enviado para ${email.trim().toLowerCase()}.`;
  }
  return resetPasswordViaApi(email);
}

export { allCnpjsForRecord };

function allCnpjsForRecord(r: ClientAccessRecord): string[] {
  return allCnpjsFromRecord(r);
}
