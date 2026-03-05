import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { readFileSync } from 'node:fs'

const packageJson = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf-8')) as { version?: string }
const appVersion = packageJson.version ?? '0.0.0'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  return {
    plugins: [tailwindcss(), react()],
    define: {
      __APP_VERSION__: JSON.stringify(appVersion),
      __TMDB_API_KEY__: JSON.stringify(env.TMDB_API_KEY ?? env.VITE_TMDB_API_KEY ?? ''),
      __CASTSTAR_DEMO__: JSON.stringify(env.CASTSTAR_DEMO ?? env.VITE_CASTSTAR_DEMO ?? ''),
    },
  }
})
