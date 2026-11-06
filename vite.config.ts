import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// base /app/ : servi par lyra-control-api (FastAPI StaticFiles) sur :9876/app.
// VITE_BASE la remplace pour la démo GitHub Pages (/neutroncore/).
export default defineConfig({
  base: process.env.VITE_BASE || '/app/',
  plugins: [react()],
  server: {
    proxy: {
      // dev : npm run dev proxifie l'API vers l'instance locale
      '^/(agenda|arr|audit|auth|automations|branches|camera|ci-deps|cyber|dette|dv|fan|godeye|health|hue|ironman|journal|launcher|lyra|maj|manga|media|minuteurs|modelisation|notes|notifications|plan|projects|qbit|rampes|recherche|recos|reglages|requests|reseau|ressources|resume|reveil|roadmap|sauvegardes|screens|securite|services|sorties|spatial|subtitles|system|tests|tracking|tv|vms-console|zones-audio)': {
        target: 'http://127.0.0.1:9876',
        changeOrigin: true,
      },
    },
  },
})
