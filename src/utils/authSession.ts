import { PortalUser } from '../types';
import { buildPortalUser, resolveBinsightRole } from './roles';
import { fetchRegistryForEmail, allCnpjsFromRecord } from './registrySheet';
import { isBinsightEmail } from './firebase';

export type ClientStatus = 'none' | 'pendente' | 'ativo' | 'revogado';

export async function resolvePortalSession(
  accessToken: string,
  email: string,
  displayName: string
): Promise<{ portalUser: PortalUser; clientStatus: ClientStatus }> {
  const em = email.trim().toLowerCase();

  if (isBinsightEmail(em)) {
    return {
      portalUser: buildPortalUser(em, displayName || em),
      clientStatus: 'none',
    };
  }

  const record = await fetchRegistryForEmail(accessToken, em);
  if (!record) {
    return {
      portalUser: buildPortalUser(em, displayName || em, []),
      clientStatus: 'none',
    };
  }

  const cnpjs = allCnpjsFromRecord(record);
  const status = record.status.toLowerCase() as ClientStatus;

  return {
    portalUser: buildPortalUser(em, record.nome || displayName || em, cnpjs, record.notifyEmail),
    clientStatus:
      status === 'ativo' || status === 'pendente' || status === 'revogado' ? status : 'none',
  };
}

export function canAccessMapaDirectly(email: string): boolean {
  const role = resolveBinsightRole(email);
  return role === 'admin' || role === 'financeiro' || role === 'staff';
}
