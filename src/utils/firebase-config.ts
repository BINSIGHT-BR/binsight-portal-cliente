import primaryConfig from '../../firebase-applet-config.json';

export type FirebaseWebConfig = {
  projectId: string;
  appId: string;
  apiKey: string;
  authDomain: string;
  storageBucket: string;
  messagingSenderId: string;
  measurementId?: string;
};

const baseConfig = primaryConfig as FirebaseWebConfig;

/**
 * Em dev: authDomain = host:porta + proxy Vite /__/auth → firebaseapp.com.
 * Requer `localhost` em Firebase → Authentication → Authorized domains.
 */
export function getFirebaseConfig(): FirebaseWebConfig {
  if (import.meta.env.DEV && typeof window !== 'undefined') {
    const host = window.location.hostname;
    const port = window.location.port;
    return {
      ...baseConfig,
      authDomain: port ? `${host}:${port}` : host,
    };
  }
  return baseConfig;
}
