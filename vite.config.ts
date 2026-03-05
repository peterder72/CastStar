import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  return {
    plugins: [react()],
    define: {
      __TMDB_API_KEY__: JSON.stringify(env.TMDB_API_KEY ?? env.VITE_TMDB_API_KEY ?? ''),
    },
  }
})
