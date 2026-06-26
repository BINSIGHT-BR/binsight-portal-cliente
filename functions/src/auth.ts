import * as admin from 'firebase-admin';
import { Request } from 'firebase-functions/v2/https';
import {
  AuthContext,
  BINSIGHT_EMAIL_DOMAIN,
  FERNANDO_EMAIL,
  FINANCEIRO_EMAIL,
  PortalRole,
  PortalUser,
} from './constants';
import { fetchRegistryForEmail } from './registryService';

if (!admin.apps.length) {
  admin.initializeApp();
}

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

export class ForbiddenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ForbiddenError';
  }
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function isBinsightEmail(email: string): boolean {
  return email.endsWith(`@${BINSIGHT_EMAIL_DOMAIN}`);
}

function resolveBinsightRole(email: string): PortalRole {
  const em = normalizeEmail(email);
  if (em === FERNANDO_EMAIL) return 'admin';
  if (em === FINANCEIRO_EMAIL) return 'financeiro';
  return 'staff';
}

function displayNameFromEmail(email: string, fallback?: string): string {
  if (fallback?.trim()) return fallback.trim();
  return email
    .split('@')[0]
    .split('.')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

export async function authenticateRequest(req: Request): Promise<AuthContext> {
  const header = req.headers.authorization ?? '';
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    throw new HttpError(401, 'Token de autenticação ausente.');
  }

  let decoded: admin.auth.DecodedIdToken;
  try {
    decoded = await admin.auth().verifyIdToken(match[1]);
  } catch {
    throw new HttpError(401, 'Token inválido ou expirado. Faça login novamente.');
  }

  const email = normalizeEmail(decoded.email ?? '');
  if (!email) {
    throw new HttpError(403, 'Conta sem e-mail válido.');
  }

  if (isBinsightEmail(email)) {
    const role = resolveBinsightRole(email);
    const portalUser: PortalUser = {
      email,
      displayName: displayNameFromEmail(email, decoded.name),
      role,
      cnpjs: [],
    };
    return {
      uid: decoded.uid,
      email,
      portalUser,
      clientStatus: 'none',
    };
  }

  const record = await fetchRegistryForEmail(email);
  const cnpjs =
    record && record.status === 'ATIVO'
      ? [record.cnpj, ...record.additionalCnpjs].filter(Boolean)
      : [];

  const portalUser: PortalUser = {
    email,
    displayName: record?.nome || displayNameFromEmail(email, decoded.name),
    role: 'cliente',
    cnpjs,
  };

  let clientStatus: AuthContext['clientStatus'] = 'none';
  if (record?.status === 'PENDENTE') clientStatus = 'pendente';
  else if (record?.status === 'ATIVO') clientStatus = 'ativo';
  else if (record?.status === 'REVOGADO') clientStatus = 'revogado';

  return { uid: decoded.uid, email, portalUser, clientStatus };
}

export function requireFinanceOrAdmin(auth: AuthContext): void {
  const role = auth.portalUser.role;
  if (role !== 'admin' && role !== 'financeiro') {
    throw new ForbiddenError('Acesso restrito a financeiro ou administrador.');
  }
}

export function seesAllOrders(auth: AuthContext): boolean {
  const role = auth.portalUser.role;
  return role === 'admin' || role === 'financeiro' || role === 'staff';
}

export function canEditOrders(auth: AuthContext): boolean {
  const role = auth.portalUser.role;
  return role === 'admin' || role === 'financeiro';
}
