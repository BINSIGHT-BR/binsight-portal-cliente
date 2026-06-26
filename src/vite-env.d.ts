/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_CLIENT_REGISTRY_ID?: string;
  readonly VITE_USE_MOCK_DATA?: string;
  readonly VITE_SKIP_AUTH?: string;
  readonly VITE_LOCAL_DEMO_ROLE?: string;
  readonly VITE_API_ORIGIN?: string;
  readonly VITE_NOTIFY_WEBAPP_URL?: string;
  readonly VITE_NOTIFY_SECRET?: string;
  readonly VITE_CONNECT_WEBAPP_URL?: string;
  readonly VITE_CONNECT_SECRET?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
