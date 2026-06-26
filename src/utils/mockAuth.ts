import { User } from 'firebase/auth';
import { MOCK_CNPJ_CLIENT } from '../data/mockOrders';
import { FERNANDO_EMAIL, FINANCEIRO_EMAIL } from './roles';

export type MockLoginRole = 'admin' | 'financeiro' | 'cliente';

export interface MockSession {
  role: MockLoginRole;
  email: string;
  displayName: string;
  cnpjs: string[];
}

const STORAGE_KEY = 'binsight_connect_mock_session';

const PRESETS: Record<MockLoginRole, Omit<MockSession, 'role'>> = {
  admin: {
    email: FERNANDO_EMAIL,
    displayName: 'Fernando Dantas',
    cnpjs: [],
  },
  financeiro: {
    email: FINANCEIRO_EMAIL,
    displayName: 'Financeiro BInsight',
    cnpjs: [],
  },
  cliente: {
    email: 'compras.demo@empresa.com.br',
    displayName: 'Cliente Demo',
    cnpjs: [MOCK_CNPJ_CLIENT],
  },
};

export function mockSessionForRole(role: MockLoginRole): MockSession {
  return { role, ...PRESETS[role] };
}

export function saveMockSession(session: MockSession): void {
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(session));
}

export function loadMockSession(): MockSession | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as MockSession;
  } catch {
    return null;
  }
}

export function clearMockSession(): void {
  sessionStorage.removeItem(STORAGE_KEY);
}

/** Objeto mínimo compatível com telas que leem user.email / displayName. */
export function mockFirebaseUser(session: MockSession): User {
  return {
    uid: `mock-${session.role}`,
    email: session.email,
    displayName: session.displayName,
    emailVerified: true,
    isAnonymous: false,
    metadata: {} as User['metadata'],
    providerData: [],
    refreshToken: '',
    tenantId: null,
    delete: async () => {},
    getIdToken: async () => 'mock-token',
    getIdTokenResult: async () => ({ token: 'mock-token' } as never),
    reload: async () => {},
    toJSON: () => ({}),
    phoneNumber: null,
    photoURL: null,
    providerId: 'mock',
  } as User;
}
