import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// base /app/ : servi par lyra-control-api (FastAPI StaticFiles) sur :9876/app
export default defineConfig({
  base: '/app/',
  plugins: [react()],
  server: {
    proxy: {
      // dev : npm run dev proxifie l'API vers l'instance locale
      '^/(arr|requests|subtitles|system|projects|launcher|lyra|services|qbit|tracking|tv|hue|ironman|screens|fan|auth|health)': {
        target: 'http://127.0.0.1:9876',
        changeOrigin: true,
      },
    },
  },
})
