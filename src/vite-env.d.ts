/// <reference types="vite/client" />

declare const __TMDB_API_KEY__: string
declare const __CASTSTAR_DEMO__: string
declare const __APP_VERSION__: string

interface ImportMetaEnv {
  readonly VITE_TMDB_API_KEY?: string
  readonly VITE_TMDB_READ_ACCESS_TOKEN?: string
  readonly VITE_CASTSTAR_DEMO?: string
}
