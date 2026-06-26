import * as admin from 'firebase-admin';
import { sendPasswordResetEmail } from './emailService';

if (!admin.apps.length) {
  admin.initializeApp();
}

const PORTAL_URL =
  process.env.CLIENT_PORTAL_URL?.trim() || 'https://connect-binsight.web.app/login';

export async function resetClientPassword(email: string): Promise<{ ok: true; message: string }> {
  const normalized = email.trim().toLowerCase();
  if (normalized.endsWith('@binsight.com.br')) {
    throw new Error('Reset de senha disponível apenas para clientes externos.');
  }

  try {
    await admin.auth().getUserByEmail(normalized);
  } catch {
    throw new Error('Usuário não encontrado no Firebase Auth. O cliente precisa fazer login Google primeiro.');
  }

  const link = await admin.auth().generatePasswordResetLink(normalized, {
    url: PORTAL_URL,
    handleCodeInApp: false,
  });

  try {
    await sendPasswordResetEmail(normalized, link);
    return { ok: true, message: 'E-mail de redefinição enviado ao cliente.' };
  } catch (err) {
    console.warn('[resetPassword] E-mail falhou, retornando link para admin', err);
    return {
      ok: true,
      message: `Link gerado (e-mail indisponível): ${link}`,
    };
  }
}
