import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { User } from 'firebase/auth';
import {
  formatAuthError,
  loginWithGoogle,
  loginWithEmailPassword,
  registerWithEmailPassword,
  logout as firebaseLogout,
  subscribeAuth,
  isGoogleLinkedUser,
  connectGoogleSheetsAccess,
  hasGoogleSheetsAccess,
  isBinsightEmail,
} from '../utils/firebase';
import { isGoogleSheetsAccessToken } from '../utils/googleAccessToken';
import { PedidoMapa, PortalUser } from '../types';
import { ClientAccessRecord } from '../types';
import { buildPortalUser, canManageClientAccess, canUseClientPreview, seesAllOrders } from '../utils/roles';
import { fetchAllOrders, filterOrdersByCnpjs } from '../utils/orders';
import { fetchClientAccessRecords } from '../utils/clientAccess';
import {
  loadClientPreview,
  previewFromRecord,
  saveClientPreview,
  type ClientPreviewState,
} from '../utils/clientPreview';
import {
  validateSheetSession,
  type SheetAuthProfile,
} from '../utils/connectPortalApi';
import {
  clearStoredSheetAuth,
  loadStoredSheetAuth,
  saveStoredSheetAuth,
} from '../utils/sheetAuthSession';
import { USE_MOCK_DATA, SKIP_AUTH, localDemoRole } from '../constants/columns';
import { MOCK_CNPJ_CLIENT } from '../data/mockOrders';
import { normalizeCNPJ } from '../utils/orders';
import { fetchMeFromApi, type ClientStatus as ApiClientStatus } from '../utils/clienteApi';
import { usesClientBackendApi } from '../utils/clientBackendApi';
import { resolvePortalSession, canAccessMapaDirectly } from '../utils/authSession';
import {
  fetchPortalRegistrationByUid,
  fetchPendingPortalRegistrations,
  savePortalRegistration,
} from '../utils/portalRegistration';
import { applyDerivedFields } from '../utils/orderCalculations';
import { formatBRLForSheet, parseBRLnum } from '../utils/brl';
import { USE_OAUTH_SHEETS } from '../constants/columns';
import {
  clearMockSession,
  loadMockSession,
  mockFirebaseUser,
  mockSessionForRole,
  saveMockSession,
  type MockLoginRole,
} from '../utils/mockAuth';

export type ClientStatus = 'none' | 'pendente' | 'ativo' | 'revogado';
export type AuthProvider = 'google' | 'sheet' | 'firebase-email' | null;

interface AuthContextValue {
  user: User | null;
  token: string | null;
  authProvider: AuthProvider;
  portalUser: PortalUser | null;
  clientStatus: ClientStatus;
  needsAuth: boolean;
  isLoggingIn: boolean;
  authError: string | null;
  mustChangePassword: boolean;
  pedidos: PedidoMapa[];
  loadingOrders: boolean;
  ordersError: string | null;
  lastSync: Date | null;
  usingMockData: boolean;
  skipAuth: boolean;
  login: () => Promise<void>;
  loginWithCredentials: (email: string, password: string) => Promise<void>;
  registerPublicAccount: (payload: {
    email: string;
    password: string;
    nomeContato: string;
    sobrenomeContato: string;
    cnpj: string;
    notifyEmail: boolean;
  }) => Promise<void>;
  loginAsDemo: (role: MockLoginRole) => void;
  logout: () => Promise<void>;
  refreshOrders: () => Promise<void>;
  refreshProfile: () => Promise<ClientStatus>;
  clearMustChangePassword: () => void;
  addMockPedido: (partial: Partial<PedidoMapa>) => void;
  clearAuthError: () => void;
  clearOrdersError: () => void;
  clientPreview: ClientPreviewState | null;
  isViewingAsClient: boolean;
  canUseClientPreview: boolean;
  startClientPreview: (record: ClientAccessRecord) => void;
  stopClientPreview: () => void;
  pendingAccessCount: number;
  refreshPendingAccessCount: () => Promise<void>;
  needsSheetsAccess: boolean;
  connectingSheets: boolean;
  connectSheets: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function mockAuthSnapshot(role: MockLoginRole) {
  const session = mockSessionForRole(role);
  return {
    user: mockFirebaseUser(session),
    token: 'mock-token' as const,
    portalUser: buildPortalUser(session.email, session.displayName, session.cnpjs),
    clientStatus: (role === 'cliente' ? 'ativo' : 'none') as ClientStatus,
    needsAuth: false,
  };
}

function readInitialAuthState() {
  if (!USE_MOCK_DATA || !SKIP_AUTH) return null;
  const saved = loadMockSession();
  const role = saved?.role ?? localDemoRole();
  if (!saved) saveMockSession(mockSessionForRole(role));
  return mockAuthSnapshot(role);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [boot] = useState(() => readInitialAuthState());

  const [user, setUser] = useState<User | null>(boot?.user ?? null);
  const [token, setToken] = useState<string | null>(boot?.token ?? null);
  const [authProvider, setAuthProvider] = useState<AuthProvider>(null);
  const [needsAuth, setNeedsAuth] = useState(!(boot?.needsAuth === false));
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [mustChangePassword, setMustChangePassword] = useState(false);
  const [portalUser, setPortalUser] = useState<PortalUser | null>(boot?.portalUser ?? null);
  const [clientStatus, setClientStatus] = useState<ClientStatus>(boot?.clientStatus ?? 'none');

  const [pedidos, setPedidos] = useState<PedidoMapa[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [ordersError, setOrdersError] = useState<string | null>(null);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [clientPreview, setClientPreview] = useState<ClientPreviewState | null>(() =>
    loadClientPreview()
  );
  const [pendingAccessCount, setPendingAccessCount] = useState(0);
  const [connectingSheets, setConnectingSheets] = useState(false);

  const isViewingAsClient = Boolean(clientPreview && portalUser?.role === 'admin');
  const adminCanPreview = canUseClientPreview(portalUser);

  const needsSheetsAccess = Boolean(
    USE_OAUTH_SHEETS &&
      !USE_MOCK_DATA &&
      authProvider === 'google' &&
      portalUser &&
      user &&
      isGoogleLinkedUser(user) &&
      (!hasGoogleSheetsAccess()) &&
      (canAccessMapaDirectly(portalUser.email) || clientStatus === 'ativo')
  );

  const startClientPreview = useCallback((record: ClientAccessRecord) => {
    const preview = previewFromRecord(record);
    saveClientPreview(preview);
    setClientPreview(preview);
  }, []);

  const stopClientPreview = useCallback(() => {
    saveClientPreview(null);
    setClientPreview(null);
  }, []);

  const applySheetProfile = useCallback(
    (sessionToken: string, expiresAt: number, profile: SheetAuthProfile) => {
      saveStoredSheetAuth({ sessionToken, expiresAt, profile });
      setUser(null);
      setToken(sessionToken);
      setAuthProvider('sheet');
      setNeedsAuth(false);
      setAuthError(null);
      setPortalUser(
        buildPortalUser(profile.email, profile.nome, profile.cnpjs, profile.notifyEmail)
      );
      setClientStatus(profile.status as ClientStatus);
      setMustChangePassword(profile.mustChangePassword);
    },
    []
  );

  const applyMockSession = useCallback((role: MockLoginRole) => {
    const session = mockSessionForRole(role);
    saveMockSession(session);
    setUser(mockFirebaseUser(session));
    setToken('mock-token');
    setNeedsAuth(false);
    setAuthError(null);
    setPortalUser(buildPortalUser(session.email, session.displayName, session.cnpjs));
    setClientStatus(role === 'cliente' ? 'ativo' : 'none');
    setAuthProvider(null);
  }, []);

  const resolveUserContext = useCallback(async (currentUser: User, _accessToken: string, provider: AuthProvider) => {
    const email = currentUser.email ?? '';

    if (USE_MOCK_DATA) {
      if (email.endsWith('@binsight.com.br')) {
        setPortalUser(buildPortalUser(email, currentUser.displayName ?? email));
        setClientStatus('none');
        return;
      }
      setPortalUser(
        buildPortalUser(email, currentUser.displayName ?? email, [MOCK_CNPJ_CLIENT])
      );
      setClientStatus('ativo');
      return;
    }

    if (!isBinsightEmail(email)) {
      try {
        const me = await fetchMeFromApi();
        setPortalUser(me.portalUser);
        setClientStatus(me.clientStatus);
        return;
      } catch {
        /* fallback Firestore */
      }
      const reg = currentUser.uid
        ? await fetchPortalRegistrationByUid(currentUser.uid)
        : null;
      if (reg) {
        const cnpjNorm = normalizeCNPJ(reg.cnpj);
        const cnpjs = reg.status === 'ATIVO' && cnpjNorm.length === 14 ? [cnpjNorm] : [];
        setPortalUser(buildPortalUser(reg.email, reg.nome, cnpjs, reg.notifyEmail));
        setClientStatus(
          reg.status === 'ATIVO'
            ? 'ativo'
            : reg.status === 'REVOGADO'
              ? 'revogado'
              : 'pendente'
        );
        return;
      }
      setPortalUser(buildPortalUser(email, currentUser.displayName ?? email));
      setClientStatus('none');
      return;
    }

    if (USE_OAUTH_SHEETS) {
      const session = await resolvePortalSession(_accessToken, email, currentUser.displayName ?? email);
      setPortalUser(session.portalUser);
      setClientStatus(session.clientStatus);
      return;
    }

    const me = await fetchMeFromApi();
    setPortalUser(me.portalUser);
    setClientStatus(me.clientStatus as ApiClientStatus);
  }, []);

  const refreshOrders = useCallback(async () => {
    if (!portalUser) return;
    if (portalUser.role === 'cliente' && clientStatus !== 'ativo') return;

    const useBackendApi = usesClientBackendApi(user);

    if (
      !useBackendApi &&
      USE_OAUTH_SHEETS &&
      authProvider === 'google' &&
      !hasGoogleSheetsAccess() &&
      (canAccessMapaDirectly(portalUser.email) || clientStatus === 'ativo')
    ) {
      setOrdersError(null);
      setPedidos([]);
      return;
    }

    setLoadingOrders(true);
    setOrdersError(null);
    try {
      const all = await fetchAllOrders(token ?? '', undefined, portalUser, useBackendApi);
      let visible = all;
      if (clientPreview && portalUser.role === 'admin') {
        visible = filterOrdersByCnpjs(all, clientPreview.cnpjs);
      } else if (!useBackendApi && !seesAllOrders(portalUser)) {
        visible = filterOrdersByCnpjs(all, portalUser.cnpjs);
      }
      setPedidos(visible);
      setLastSync(new Date());
    } catch (err) {
      setOrdersError(err instanceof Error ? err.message : 'Erro ao carregar pedidos.');
    } finally {
      setLoadingOrders(false);
    }
  }, [portalUser, clientStatus, token, clientPreview, authProvider, user]);

  const refreshProfile = useCallback(async (): Promise<ClientStatus> => {
    if (!token) return clientStatus;
    try {
      if (USE_MOCK_DATA) {
        return clientStatus;
      }
      if (authProvider === 'sheet') {
        const profile = await validateSheetSession(token);
        applySheetProfile(token, loadStoredSheetAuth()?.expiresAt ?? Date.now() + 3600000, profile);
        return profile.status as ClientStatus;
      }
      if (!user) return clientStatus;
      if (authProvider === 'firebase-email' && !isGoogleLinkedUser(user)) {
        try {
          const me = await fetchMeFromApi();
          if (me.clientStatus !== 'none') {
            setPortalUser(me.portalUser);
            setClientStatus(me.clientStatus);
            return me.clientStatus;
          }
        } catch {
          /* fallback Firestore */
        }
        const reg = user.uid ? await fetchPortalRegistrationByUid(user.uid) : null;
        if (reg) {
          const cnpjNorm = normalizeCNPJ(reg.cnpj);
        const cnpjs = reg.status === 'ATIVO' && cnpjNorm.length === 14 ? [cnpjNorm] : [];
          setPortalUser(buildPortalUser(reg.email, reg.nome, cnpjs, reg.notifyEmail));
          const status =
            reg.status === 'ATIVO'
              ? 'ativo'
              : reg.status === 'REVOGADO'
                ? 'revogado'
                : 'pendente';
          setClientStatus(status);
          return status;
        }
        return clientStatus;
      }
      if (USE_OAUTH_SHEETS) {
        const session = await resolvePortalSession(token, user.email ?? '', user.displayName ?? user.email ?? '');
        setPortalUser(session.portalUser);
        setClientStatus(session.clientStatus);
        return session.clientStatus;
      }
      const me = await fetchMeFromApi();
      setPortalUser(me.portalUser);
      const status = me.clientStatus as ApiClientStatus;
      setClientStatus(status);
      return status;
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Erro ao atualizar perfil.');
      return clientStatus;
    }
  }, [user, token, clientStatus, authProvider, applySheetProfile]);

  useEffect(() => {
    if (USE_MOCK_DATA) {
      if (SKIP_AUTH && boot) return;
      const saved = loadMockSession();
      if (saved) {
        applyMockSession(saved.role);
      }
      return;
    }

    let cancelled = false;
    const stored = loadStoredSheetAuth();

    const setupFirebaseAuth = () => {
      const unsub = subscribeAuth(
        async (currentUser, accessToken, provider) => {
          if (cancelled) return;
          setUser(currentUser);
          setToken(accessToken);
          setAuthProvider(provider);
          setNeedsAuth(false);
          setOrdersError(null);
          try {
            await resolveUserContext(currentUser, accessToken, provider);
          } catch (err) {
            setAuthError(err instanceof Error ? err.message : 'Erro ao carregar perfil.');
          }
        },
        () => {
          if (cancelled) return;
          if (loadStoredSheetAuth()) return;
          setUser(null);
          setToken(null);
          setAuthProvider(null);
          setPortalUser(null);
          setPedidos([]);
          setNeedsAuth(true);
        }
      );
      return unsub;
    };

    if (stored) {
      void validateSheetSession(stored.sessionToken)
        .then((profile) => {
          if (cancelled) return;
          applySheetProfile(stored.sessionToken, stored.expiresAt, profile);
        })
        .catch(() => {
          if (cancelled) return;
          clearStoredSheetAuth();
          setupFirebaseAuth();
        });
      return () => {
        cancelled = true;
      };
    }

    const unsub = setupFirebaseAuth();
    return () => {
      cancelled = true;
      unsub();
    };
  }, [resolveUserContext, applyMockSession, applySheetProfile, boot]);

  useEffect(() => {
    if (!portalUser) return;
    if (portalUser.role === 'cliente' && clientStatus !== 'ativo') return;
    refreshOrders();
  }, [portalUser, clientStatus, clientPreview, refreshOrders]);

  const login = async () => {
    if (USE_MOCK_DATA) {
      setAuthError(
        'No modo demo, use os botões "Entrar como Admin/Financeiro/Cliente" abaixo.\n\nGoogle Login só é necessário com VITE_USE_MOCK_DATA=false.'
      );
      return;
    }
    setIsLoggingIn(true);
    setAuthError(null);
    try {
      const { user: u, accessToken } = await loginWithGoogle();
      clearStoredSheetAuth();
      setUser(u);
      setToken(accessToken);
      setAuthProvider('google');
      setNeedsAuth(false);
      await resolveUserContext(u, accessToken, 'google');
    } catch (err) {
      setAuthError(formatAuthError(err));
    } finally {
      setIsLoggingIn(false);
    }
  };

  const loginWithCredentials = async (email: string, password: string) => {
    setIsLoggingIn(true);
    setAuthError(null);
    setOrdersError(null);
    try {
      clearStoredSheetAuth();
      const u = await loginWithEmailPassword(email, password);
      const idToken = await u.getIdToken();
      setUser(u);
      setToken(idToken);
      setAuthProvider('firebase-email');
      setNeedsAuth(false);
      await resolveUserContext(u, idToken, 'firebase-email');
    } catch (err) {
      setAuthError(formatAuthError(err));
    } finally {
      setIsLoggingIn(false);
    }
  };

  const registerPublicAccount = useCallback(async (payload: {
    email: string;
    password: string;
    nomeContato: string;
    sobrenomeContato: string;
    cnpj: string;
    notifyEmail: boolean;
  }) => {
    setIsLoggingIn(true);
    setAuthError(null);
    try {
      clearStoredSheetAuth();
      const nome = `${payload.nomeContato.trim()} ${payload.sobrenomeContato.trim()}`.trim();
      const u = await registerWithEmailPassword(payload.email, payload.password, nome);
      await savePortalRegistration({
        uid: u.uid,
        email: payload.email,
        nome,
        nomeContato: payload.nomeContato,
        sobrenomeContato: payload.sobrenomeContato,
        cnpj: payload.cnpj,
        notifyEmail: payload.notifyEmail,
      });
      const idToken = await u.getIdToken();
      setUser(u);
      setToken(idToken);
      setAuthProvider('firebase-email');
      setNeedsAuth(false);
      setPortalUser(buildPortalUser(u.email ?? payload.email, nome, [], payload.notifyEmail));
      setClientStatus('pendente');
      setMustChangePassword(false);
    } catch (err) {
      setAuthError(formatAuthError(err));
      throw err;
    } finally {
      setIsLoggingIn(false);
    }
  }, []);

  const refreshPendingAccessCount = useCallback(async () => {
    if (!portalUser || !canManageClientAccess(portalUser) || USE_MOCK_DATA) {
      setPendingAccessCount(0);
      return;
    }
    if (!token || !isGoogleSheetsAccessToken(token)) {
      setPendingAccessCount(0);
      return;
    }
    try {
      const [records, firestorePending] = await Promise.all([
        token ? fetchClientAccessRecords(token) : Promise.resolve([]),
        fetchPendingPortalRegistrations().catch(() => []),
      ]);
      const sheetPending = records.filter((r) => r.status === 'PENDENTE').length;
      const firestoreOnly = firestorePending.filter(
        (f) => !records.some((r) => r.email === f.email)
      ).length;
      setPendingAccessCount(sheetPending + firestoreOnly);
    } catch {
      setPendingAccessCount(0);
    }
  }, [portalUser, token]);

  useEffect(() => {
    void refreshPendingAccessCount();
  }, [refreshPendingAccessCount]);

  const loginAsDemo = (role: MockLoginRole) => {
    applyMockSession(role);
  };

  const connectSheets = useCallback(async () => {
    if (!user || !isGoogleLinkedUser(user)) {
      setAuthError('Entre com Google (@binsight.com.br) para conectar as planilhas.');
      return;
    }
    setConnectingSheets(true);
    setAuthError(null);
    try {
      const accessToken = await connectGoogleSheetsAccess();
      setToken(accessToken);
      await resolveUserContext(user, accessToken, 'google');
      await refreshOrders();
      await refreshPendingAccessCount();
    } catch (err) {
      setAuthError(formatAuthError(err));
    } finally {
      setConnectingSheets(false);
    }
  }, [user, resolveUserContext, refreshOrders, refreshPendingAccessCount]);

  const logout = async () => {
    if (USE_MOCK_DATA && SKIP_AUTH) {
      applyMockSession(localDemoRole());
      return;
    }
    if (USE_MOCK_DATA) {
      clearMockSession();
    } else if (authProvider === 'sheet') {
      clearStoredSheetAuth();
    } else {
      await firebaseLogout();
    }
    setUser(null);
    setToken(null);
    setAuthProvider(null);
    setMustChangePassword(false);
    setPortalUser(null);
    setPedidos([]);
    setNeedsAuth(true);
    stopClientPreview();
  };

  const addMockPedido = useCallback((partial: Partial<PedidoMapa>) => {
    if (!USE_MOCK_DATA) return;
    const merged = applyDerivedFields(partial);
    if (merged.custoDist) merged.custoDist = formatBRLForSheet(parseBRLnum(merged.custoDist));
    if (merged.vendBins) merged.vendBins = formatBRLForSheet(parseBRLnum(merged.vendBins));
    setPedidos((prev) => {
      const nextRow = prev.reduce((max, p) => Math.max(max, p.rowNum), 1) + 1;
      const data = merged.data ?? new Date().toLocaleDateString('pt-BR');
      const pedido: PedidoMapa = {
        rowNum: nextRow,
        mapaYear: new Date().getFullYear(),
        data,
        vendedor: merged.vendedor ?? '',
        cnpj: merged.cnpj ?? '',
        nomeCliente: merged.nomeCliente ?? '',
        numPedidoCli: merged.numPedidoCli ?? '',
        prioridade: merged.prioridade ?? 'Média',
        descricaoProduto: merged.descricaoProduto ?? '',
        distribuidor: merged.distribuidor ?? '',
        numPedidoDist: merged.numPedidoDist ?? '',
        emissao: merged.emissao ?? 'Não',
        numNF: merged.numNF ?? '',
        parc1: merged.parc1 ?? '',
        parc2: merged.parc2 ?? '',
        parc3: merged.parc3 ?? '',
        parc4: merged.parc4 ?? '',
        statusPgto: merged.statusPgto ?? 'SEM DATA',
        status: merged.status ?? 'PENDENTE',
        qtd: merged.qtd ?? '1',
        custoDist: merged.custoDist ?? '',
        totalCompra: merged.totalCompra ?? '',
        vendBins: merged.vendBins ?? '',
        vendaTotal: merged.vendaTotal ?? '',
        vendaPct: merged.vendaPct ?? '',
        bruto: merged.bruto ?? '',
        liquido: merged.liquido ?? '',
        statusComissao: merged.statusComissao ?? 'PENDENTE',
        obsPedido: merged.obsPedido ?? '',
        obsCliente: merged.obsCliente ?? '',
        nfDriveUrl: merged.nfDriveUrl ?? '',
        boletoDriveUrl: merged.boletoDriveUrl ?? '',
        mapaKind: merged.mapaKind ?? 'pedido',
        tipoRecorrencia: merged.tipoRecorrencia,
        statusContrato: merged.statusContrato,
        periodicidade: merged.periodicidade,
        vencimento: merged.vencimento,
        numContratoDist: merged.numContratoDist,
        observacaoCliente: merged.observacaoCliente ?? '',
      };
      return [pedido, ...prev];
    });
    setLastSync(new Date());
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      token,
      authProvider,
      portalUser,
      clientStatus,
      needsAuth,
      isLoggingIn,
      authError,
      mustChangePassword,
      pedidos,
      loadingOrders,
      ordersError,
      lastSync,
      usingMockData: USE_MOCK_DATA,
      skipAuth: SKIP_AUTH,
      login,
      loginWithCredentials,
      registerPublicAccount,
      loginAsDemo,
      logout,
      refreshOrders,
      refreshProfile,
      clearMustChangePassword: () => setMustChangePassword(false),
      addMockPedido,
      clearAuthError: () => setAuthError(null),
      clearOrdersError: () => setOrdersError(null),
      clientPreview,
      isViewingAsClient,
      canUseClientPreview: adminCanPreview,
      startClientPreview,
      stopClientPreview,
      pendingAccessCount,
      refreshPendingAccessCount,
      needsSheetsAccess,
      connectingSheets,
      connectSheets,
    }),
    [
      user,
      token,
      authProvider,
      portalUser,
      clientStatus,
      needsAuth,
      isLoggingIn,
      authError,
      mustChangePassword,
      pedidos,
      loadingOrders,
      ordersError,
      lastSync,
      refreshOrders,
      refreshProfile,
      registerPublicAccount,
      addMockPedido,
      clientPreview,
      isViewingAsClient,
      adminCanPreview,
      startClientPreview,
      stopClientPreview,
      pendingAccessCount,
      refreshPendingAccessCount,
      needsSheetsAccess,
      connectingSheets,
      connectSheets,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

export function useClientCnpjs(): string[] {
  const { portalUser, clientPreview, isViewingAsClient } = useAuth();
  if (isViewingAsClient && clientPreview) {
    return clientPreview.cnpjs.map(normalizeCNPJ);
  }
  return portalUser?.cnpjs.map(normalizeCNPJ) ?? [];
}
