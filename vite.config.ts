import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  return {
    plugins: [tailwindcss(), react()],
    define: {
      __TMDB_API_KEY__: JSON.stringify(env.TMDB_API_KEY ?? env.VITE_TMDB_API_KEY ?? ''),
      __CASTSTAR_DEMO__: JSON.stringify(env.CASTSTAR_DEMO ?? env.VITE_CASTSTAR_DEMO ?? ''),
    },
  }
})
