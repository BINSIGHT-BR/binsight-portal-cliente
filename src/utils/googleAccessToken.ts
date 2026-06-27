const TOKEN_KEY = 'binsight_google_sheets_token';
const EXP_KEY = 'binsight_google_sheets_token_exp';

/** Google OAuth access token (not Firebase ID JWT). */
export function isGoogleSheetsAccessToken(token: string | null | undefined): boolean {
  if (!token) return false;
  return !token.startsWith('eyJ');
}

export function saveGoogleSheetsAccessToken(token: string, expiresInSec = 3500): void {
  sessionStorage.setItem(TOKEN_KEY, token);
  sessionStorage.setItem(EXP_KEY, String(Date.now() + expiresInSec * 1000));
}

export function loadGoogleSheetsAccessToken(): string | null {
  const token = sessionStorage.getItem(TOKEN_KEY);
  const exp = sessionStorage.getItem(EXP_KEY);
  if (!token || !exp || Date.now() > Number(exp)) {
    clearGoogleSheetsAccessToken();
    return null;
  }
  return token;
}

export function clearGoogleSheetsAccessToken(): void {
  sessionStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(EXP_KEY);
}
