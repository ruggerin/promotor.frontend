/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string;
  /** Portal de chamados (abre em aba nova) — ver src/lib/suporte.ts. */
  readonly VITE_URL_SUPORTE?: string;
  readonly VITE_EMAIL_SUPORTE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
