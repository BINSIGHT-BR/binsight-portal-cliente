import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  reauthenticateWithPopup,
  reauthenticateWithCredential,
  EmailAuthProvider,
  sendPasswordResetEmail,
  updatePassword,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updateProfile,
  User,
  UserCredential,
} from 'firebase/auth';
import { getFirebaseConfig } from './firebase-config';
import {
  clearGoogleSheetsAccessToken,
  isGoogleSheetsAccessToken,
  loadGoogleSheetsAccessToken,
  saveGoogleSheetsAccessToken,
} from './googleAccessToken';

const app = initializeApp(getFirebaseConfig());
export const auth = getAuth(app);
export const db = getFirestore(app);

export const BINSIGHT_EMAIL_DOMAIN = 'binsight.com.br';

const provider = new GoogleAuthProvider();
provider.addScope('https://www.googleapis.com/auth/spreadsheets');
provider.addScope('https://www.googleapis.com/auth/drive.file');
provider.addScope('https://www.googleapis.com/auth/drive.readonly');

export function isGoogleLinkedUser(user: User | null | undefined): boolean {
  return Boolean(user?.providerData.some((p) => p.providerId === 'google.com'));
}

export async function registerWithEmailPassword(
  email: string,
  password: string,
  displayName: string
): Promise<User> {
  const normalized = email.trim().toLowerCase();
  if (normalized.endsWith(`@${BINSIGHT_EMAIL_DOMAIN}`)) {
    throw new Error('Clientes externos devem usar e-mail da empresa, não @binsight.com.br.');
  }
  const cred = await createUserWithEmailAndPassword(auth, normalized, password);
  if (displayName.trim()) {
    await updateProfile(cred.user, { displayName: displayName.trim() });
  }
  return cred.user;
}

export async function loginWithEmailPassword(email: string, password: string): Promise<User> {
  const cred = await signInWithEmailAndPassword(auth, email.trim().toLowerCase(), password);
  return cred.user;
}

export async function getFirebaseIdToken(): Promise<string | null> {
  const user = auth.currentUser;
  if (!user) return null;
  return user.getIdToken();
}

export function isBinsightEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return email.trim().toLowerCase().endsWith(`@${BINSIGHT_EMAIL_DOMAIN}`);
}

let cachedAccessToken: string | null = null;

function extractAuthResult(result: UserCredential) {
  const credential = GoogleAuthProvider.credentialFromResult(result);
  if (!credential?.accessToken) {
    throw new Error('Não foi possível obter o token de acesso do Google.');
  }
  cachedAccessToken = credential.accessToken;
  saveGoogleSheetsAccessToken(credential.accessToken);
  return { user: result.user, accessToken: cachedAccessToken };
}

const FIREBASE_AUTH_SETTINGS_URL =
  'https://console.firebase.google.com/project/comercial-binsight/authentication/settings';

/** Domínios que precisam estar em Authentication → Authorized domains. */
export const REQUIRED_AUTH_DOMAINS = [
  'localhost',
  'connect-binsight.web.app',
  'connect-binsight.firebaseapp.com',
] as const;

export function currentAuthHostname(): string {
  if (typeof window === 'undefined') return 'localhost';
  return window.location.hostname;
}

export function unauthorizedDomainHelp(hostname = currentAuthHostname()): string {
  const needsAdd = !REQUIRED_AUTH_DOMAINS.includes(hostname as (typeof REQUIRED_AUTH_DOMAINS)[number]);
  const lines = [
    `Domínio atual: ${hostname}`,
    '',
    'Para desenvolvimento local, abra exatamente:',
    'http://localhost:3001',
    '(127.0.0.1 ou IP da rede não funcionam sem cadastro no Firebase.)',
  ];
  if (needsAdd) {
    lines.push(
      '',
      `Adicione "${hostname}" em Firebase → Authentication → Settings → Authorized domains:`,
      FIREBASE_AUTH_SETTINGS_URL,
      '',
      'Domínios de produção recomendados:',
      ...REQUIRED_AUTH_DOMAINS.filter((d) => d !== 'localhost').map((d) => `• ${d}`)
    );
  }
  return lines.join('\n');
}

export function formatAuthError(error: unknown): string {
  const code = (error as { code?: string })?.code;
  const message = (error as { message?: string })?.message || 'Erro desconhecido';
  switch (code) {
    case 'auth/popup-closed-by-user':
      return 'Login cancelado. Tente novamente.';
    case 'auth/cancelled-popup-request':
      return 'Outra janela de login estava aberta. Feche pop-ups extras e tente de novo.';
    case 'auth/operation-not-allowed':
      return 'Cadastro por e-mail ainda não está ativo no Firebase. Peça ao administrador para habilitar E-mail/Senha em Authentication → Sign-in method.';
    case 'auth/email-already-in-use':
      return 'Já existe uma conta com este e-mail. Entre ou use "Esqueci a senha".';
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'E-mail ou senha incorretos.';
    case 'auth/weak-password':
      return 'A senha deve ter pelo menos 6 caracteres.';
    case 'auth/requires-recent-login':
      return 'Por segurança, confirme sua senha atual e tente novamente.';
    case 'auth/network-request-failed':
      return 'Falha de rede. Verifique sua conexão.';
    case 'auth/unauthorized-domain':
      return `Domínio não autorizado no Firebase Auth.\n\n${unauthorizedDomainHelp()}\n\nAtalho: use modo demo (VITE_USE_MOCK_DATA=true) e os botões Admin/Financeiro/Cliente na tela de login.\nGuia completo: scripts/setup-auth-domains.md`;
    default:
      if (message.includes('auth/unauthorized-domain') || message.includes('unauthorized-domain')) {
        return `Domínio não autorizado no Firebase Auth.\n\n${unauthorizedDomainHelp()}`;
      }
      return message;
  }
}

export async function loginWithGoogle(): Promise<{ user: User; accessToken: string }> {
  provider.setCustomParameters({ prompt: 'select_account' });
  try {
    const result = await signInWithPopup(auth, provider);
    return extractAuthResult(result);
  } finally {
    provider.setCustomParameters({});
  }
}

export function clearSheetsAccessCache(): void {
  cachedAccessToken = null;
  clearGoogleSheetsAccessToken();
}

export async function logout(): Promise<void> {
  clearSheetsAccessCache();
  await auth.signOut();
}

let connectInFlight: Promise<string> | null = null;

/** Conecta Google Sheets sob demanda (nunca na abertura automática do site). */
export async function connectGoogleSheetsAccess(): Promise<string> {
  if (connectInFlight) return connectInFlight;
  connectInFlight = (async () => {
    const user = auth.currentUser;
    if (!user) throw new Error('Faça login primeiro.');
    if (!isGoogleLinkedUser(user)) {
      throw new Error('Esta conta não usa Google. Entre com Google ou vincule a conta Google.');
    }
    provider.setCustomParameters({ prompt: 'select_account' });
    try {
      const result = await reauthenticateWithPopup(user, provider);
      const { accessToken } = extractAuthResult(result);
      return accessToken;
    } finally {
      provider.setCustomParameters({});
      connectInFlight = null;
    }
  })();
  return connectInFlight;
}

export function hasGoogleSheetsAccess(): boolean {
  if (cachedAccessToken && isGoogleSheetsAccessToken(cachedAccessToken)) return true;
  const stored = loadGoogleSheetsAccessToken();
  if (stored) {
    cachedAccessToken = stored;
    return true;
  }
  return false;
}

export function subscribeAuth(
  onUser: (user: User, accessToken: string, provider: 'google' | 'firebase-email') => void,
  onSignedOut: () => void
): () => void {
  return onAuthStateChanged(auth, async (user) => {
    if (!user) {
      cachedAccessToken = null;
      onSignedOut();
      return;
    }
    if (isGoogleLinkedUser(user)) {
      const sheetsToken = loadGoogleSheetsAccessToken();
      if (sheetsToken) {
        cachedAccessToken = sheetsToken;
        onUser(user, sheetsToken, 'google');
        return;
      }
      cachedAccessToken = null;
      try {
        const idToken = await user.getIdToken();
        onUser(user, idToken, 'google');
      } catch {
        onSignedOut();
      }
      return;
    }
    try {
      const idToken = await user.getIdToken();
      onUser(user, idToken, 'firebase-email');
    } catch {
      onSignedOut();
    }
  });
}

export async function getAccessToken(): Promise<string | null> {
  return cachedAccessToken;
}

export function isGoogleAuthExpiredError(err: unknown): boolean {
  const msg = String((err as Error)?.message ?? err);
  return msg.includes('401') || msg.includes('invalid_grant') || msg.includes('UNAUTHENTICATED');
}

export async function refreshGoogleAccessToken(): Promise<string> {
  return connectGoogleSheetsAccess();
}

/** Envia link de redefinição/definição de senha (Firebase Auth). */
export async function sendPortalPasswordResetEmail(email: string): Promise<void> {
  const normalized = email.trim().toLowerCase();
  if (!normalized) throw new Error('Informe um e-mail válido.');
  if (normalized.endsWith(`@${BINSIGHT_EMAIL_DOMAIN}`)) {
    throw new Error('Contas @binsight.com.br usam login Google — altere a senha na conta Google.');
  }
  await sendPasswordResetEmail(auth, normalized);
}

export function userHasPasswordProvider(user: User | null | undefined): boolean {
  return Boolean(user?.providerData.some((p) => p.providerId === 'password'));
}

export function userIsGoogleOnly(user: User | null | undefined): boolean {
  if (!user) return false;
  const hasGoogle = user.providerData.some((p) => p.providerId === 'google.com');
  return hasGoogle && !userHasPasswordProvider(user);
}

/** Cliente com e-mail/senha: confirma com senha atual e atualiza. Contas Google+senha idem. */
export async function changePortalPassword(
  newPassword: string,
  currentPassword?: string
): Promise<void> {
  const user = auth.currentUser;
  if (!user) throw new Error('Faça login novamente.');
  if (newPassword.length < 6) throw new Error('A senha deve ter pelo menos 6 caracteres.');
  const hasPassword = userHasPasswordProvider(user);
  if (!hasPassword) {
    throw new Error(
      'Sua conta usa apenas Google. Use "Esqueci minha senha" ou "Enviar link por e-mail" para definir uma senha.'
    );
  }
  const email = user.email?.trim().toLowerCase();
  if (!email) throw new Error('E-mail da conta não encontrado.');
  if (!currentPassword?.trim()) {
    throw new Error('Informe sua senha atual para confirmar a alteração.');
  }
  const credential = EmailAuthProvider.credential(email, currentPassword);
  await reauthenticateWithCredential(user, credential);
  await updatePassword(user, newPassword);
}
