import type { CapacitorConfig } from '@capacitor/cli'
import { readFileSync } from 'node:fs'

// Lit une variable depuis l'environnement, sinon depuis .env.local (gitignore).
function envVar(name: string, fallback: string): string {
  if (process.env[name]) return process.env[name] as string
  try {
    const line = readFileSync('.env.local', 'utf8').split('\n').find((l) => l.startsWith(`${name}=`))
    if (line) return line.slice(name.length + 1).trim()
  } catch { /* pas de .env.local : fallback */ }
  return fallback
}

// Coque Android de neutroncore.
//
// L'application ne cherche PAS a fonctionner hors ligne : elle ne sert a rien
// sans le backend a la maison. Elle charge donc directement l'interface servie
// par lyra-control-api sur le tailnet, ce qui evite de recompiler un APK a
// chaque deploiement du frontend (npm run build suffit).
//
// Le trafic passe dans le tunnel Tailscale, chiffre par WireGuard ; le
// cleartext est autorise uniquement pour cet hote prive.
const config: CapacitorConfig = {
  appId: 'app.neutroncore.hub',
  appName: 'neutroncore',
  webDir: 'dist',
  android: {
    allowMixedContent: false,
    backgroundColor: '#0e0a10',
  },
  server: {
    url: envVar('NEUTRONCORE_URL', 'http://100.64.0.1:9876/app/'),
    cleartext: true,
    androidScheme: 'http',
  },
}

export default config
