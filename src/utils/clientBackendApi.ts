import type { User } from 'firebase/auth';
import { isBinsightEmail } from './firebase';

/** Clientes externos: pedidos e documentos via Cloud Functions (Service Account). */
export function usesClientBackendApi(user: User | null | undefined): boolean {
  if (!user?.email) return false;
  return !isBinsightEmail(user.email);
}
