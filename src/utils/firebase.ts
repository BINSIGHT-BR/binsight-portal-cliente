import { initializeApp } from 'firebase/app';
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  reauthenticateWithPopup,
  sendPasswordResetEmail,
  updatePassword,
  User,
  UserCredential,
} from 'firebase/auth';
import { getFirebaseConfig } from './firebase-config';

const app = initializeApp(getFirebaseConfig());
export const auth = getAuth(app);

export const BINSIGHT_EMAIL_DOMAIN = 'binsight.com.br';

const provider = new GoogleAuthProvider();
provider.addScope('https://www.googleapis.com/auth/spreadsheets');
provider.addScope('https://www.googleapis.com/auth/drive.file');
provider.addScope('https://www.googleapis.com/auth/drive.readonly');
provider.setCustomParameters({ prompt: 'consent' });

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
  const result = await signInWithPopup(auth, provider);
  return extractAuthResult(result);
}

export async function logout(): Promise<void> {
  cachedAccessToken = null;
  await auth.signOut();
}

export function subscribeAuth(
  onUser: (user: User, accessToken: string) => void,
  onSignedOut: () => void
): () => void {
  return onAuthStateChanged(auth, async (user) => {
    if (!user) {
      cachedAccessToken = null;
      onSignedOut();
      return;
    }
    if (cachedAccessToken) {
      onUser(user, cachedAccessToken);
      return;
    }
    try {
      const token = await refreshGoogleAccessToken();
      onUser(user, token);
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
  const user = auth.currentUser;
  if (!user) throw new Error('Sessão expirada. Faça login novamente.');
  const result = await reauthenticateWithPopup(user, provider);
  const { accessToken } = extractAuthResult(result);
  return accessToken;
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

/** Cliente com provedor senha: altera após reautenticar com Google. */
export async function changePortalPassword(newPassword: string): Promise<void> {
  const user = auth.currentUser;
  if (!user) throw new Error('Faça login novamente.');
  if (newPassword.length < 6) throw new Error('A senha deve ter pelo menos 6 caracteres.');
  const hasPassword = user.providerData.some((p) => p.providerId === 'password');
  if (!hasPassword) {
    throw new Error(
      'Sua conta usa apenas Google. Use "Enviar link por e-mail" para definir uma senha alternativa.'
    );
  }
  await reauthenticateWithPopup(user, provider);
  await updatePassword(user, newPassword);
}
