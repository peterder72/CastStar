/// <reference types="vite/client" />

declare const __TMDB_API_KEY__: string

interface ImportMetaEnv {
  readonly VITE_TMDB_API_KEY?: string
  readonly VITE_TMDB_READ_ACCESS_TOKEN?: string
}
