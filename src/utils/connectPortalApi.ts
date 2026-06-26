import { PedidoMapa } from '../types';
import type { ClientStatus } from '../contexts/AuthContext';

const WEBAPP_URL =
  (import.meta.env.VITE_CONNECT_WEBAPP_URL as string | undefined)?.trim() ||
  (import.meta.env.VITE_NOTIFY_WEBAPP_URL as string | undefined)?.trim() ||
  '';
const CONNECT_SECRET =
  (import.meta.env.VITE_CONNECT_SECRET as string | undefined)?.trim() ||
  (import.meta.env.VITE_NOTIFY_SECRET as string | undefined)?.trim() ||
  '';

export function isConnectPortalConfigured(): boolean {
  return Boolean(WEBAPP_URL && CONNECT_SECRET);
}

export interface SheetAuthProfile {
  email: string;
  nome: string;
  status: ClientStatus;
  cnpjs: string[];
  notifyEmail: boolean;
  mustChangePassword: boolean;
}

export interface SheetLoginResult {
  sessionToken: string;
  expiresAt: number;
  profile: SheetAuthProfile;
}

async function postConnect<T>(payload: Record<string, unknown>): Promise<T> {
  if (!isConnectPortalConfigured()) {
    throw new Error('Portal Connect Web App não configurado (VITE_CONNECT_WEBAPP_URL).');
  }
  const res = await fetch(WEBAPP_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ ...payload, secret: CONNECT_SECRET }),
  });
  const data = (await res.json().catch(() => ({}))) as T & { ok?: boolean; error?: string };
  if (!res.ok || data.ok === false) {
    throw new Error((data as { error?: string }).error || `Erro HTTP ${res.status}`);
  }
  return data;
}

export async function loginWithSheetAuth(email: string, password: string): Promise<SheetLoginResult> {
  const data = await postConnect<{
    sessionToken: string;
    expiresAt: number;
    profile: SheetAuthProfile;
  }>({ type: 'login', email, password });
  return {
    sessionToken: data.sessionToken,
    expiresAt: data.expiresAt,
    profile: data.profile,
  };
}

export async function validateSheetSession(sessionToken: string): Promise<SheetAuthProfile> {
  const data = await postConnect<{ profile: SheetAuthProfile }>({
    type: 'validate_session',
    sessionToken,
  });
  return data.profile;
}

export async function changeSheetPassword(
  sessionToken: string,
  oldPassword: string,
  newPassword: string
): Promise<void> {
  await postConnect({
    type: 'change_password',
    sessionToken,
    oldPassword,
    newPassword,
  });
}

export async function adminResetSheetPassword(
  targetEmail: string,
  actorEmail: string
): Promise<string> {
  const data = await postConnect<{ message: string; tempPassword?: string }>({
    type: 'admin_reset_password',
    targetEmail,
    actorEmail,
  });
  if (data.tempPassword) {
    return `${data.message}\nSenha temporária: ${data.tempPassword}`;
  }
  return data.message;
}

export async function updateNotifyViaSheetAuth(
  sessionToken: string,
  notifyEmail: boolean
): Promise<void> {
  await postConnect({
    type: 'client_update_notify',
    sessionToken,
    notifyEmail,
  });
}

export async function fetchPedidosViaSheetAuth(sessionToken: string): Promise<PedidoMapa[]> {
  const data = await postConnect<{ pedidos: PedidoMapa[] }>({
    type: 'client_pedidos',
    sessionToken,
  });
  return data.pedidos ?? [];
}

export async function fetchDriveFileViaSheetAuth(
  sessionToken: string,
  driveUrl: string
): Promise<{ name: string; mimeType: string; blob: Blob }> {
  const data = await postConnect<{ name: string; mimeType: string; base64: string }>({
    type: 'client_drive_file',
    sessionToken,
    driveUrl,
  });
  const binary = atob(data.base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return {
    name: data.name,
    mimeType: data.mimeType,
    blob: new Blob([bytes], { type: data.mimeType }),
  };
}

export function isSheetSessionToken(token: string | null | undefined): boolean {
  return Boolean(token && token.includes('.') && token.length > 40);
}
