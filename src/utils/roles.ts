export const FERNANDO_EMAIL = 'fernando.dantas@binsight.com.br';
export const FINANCEIRO_EMAIL = 'financeiro@binsight.com.br';
export const FELIPE_EMAIL = 'felipe.dantas@binsight.com.br';

import { PortalRole, PortalUser } from '../types';
import { isBinsightEmail } from './firebase';

export function resolveBinsightRole(email: string): PortalRole {
  const em = email.trim().toLowerCase();
  if (em === FERNANDO_EMAIL) return 'admin';
  if (em === FINANCEIRO_EMAIL) return 'financeiro';
  if (isBinsightEmail(em)) return 'staff';
  return 'cliente';
}

export function buildPortalUser(
  email: string,
  displayName: string,
  cnpjs: string[] = [],
  notifyEmail?: boolean
): PortalUser {
  return {
    email: email.trim().toLowerCase(),
    displayName: displayName.trim() || email.split('@')[0],
    role: resolveBinsightRole(email),
    cnpjs,
    notifyEmail,
  };
}

export function canEditOrders(user: PortalUser): boolean {
  return user.role === 'admin' || user.role === 'financeiro';
}

export function canManageClientAccess(user: PortalUser): boolean {
  return user.role === 'admin' || user.role === 'financeiro';
}

export function canUseClientPreview(user: PortalUser | null): boolean {
  return user?.role === 'admin';
}

export function canResetClientPassword(user: PortalUser): boolean {
  return user.role === 'admin' || user.role === 'financeiro';
}

export function seesAllOrders(user: PortalUser): boolean {
  return user.role === 'admin' || user.role === 'financeiro' || user.role === 'staff';
}

export function seesFinancialDetails(user: PortalUser): boolean {
  return user.role === 'admin' || user.role === 'financeiro' || user.role === 'staff';
}

export function roleLabel(role: PortalRole): string {
  switch (role) {
    case 'admin':
      return 'Administrador';
    case 'financeiro':
      return 'Financeiro';
    case 'staff':
      return 'BInsight';
    case 'cliente':
      return 'Cliente';
  }
}
