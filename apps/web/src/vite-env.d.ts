/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Base URL phones should use to join, e.g. http://192.168.1.20:5173. Defaults to this page's origin. */
  readonly VITE_PUBLIC_URL?: string;
}
