// Accès directs aux interfaces web du homelab (écran outils et palette de commandes).
const MEDIA_HOST = import.meta.env.VITE_MEDIA_HOST ?? 'media-server.lan'

export const LINKS = [
  { name: 'plex', url: `http://${MEDIA_HOST}:32400/web` },
  { name: 'overseerr', url: `http://${MEDIA_HOST}:5055` },
  { name: 'radarr', url: `http://${MEDIA_HOST}:7878` },
  { name: 'sonarr', url: `http://${MEDIA_HOST}:8989` },
  { name: 'bazarr', url: `http://${MEDIA_HOST}:6767` },
  { name: 'qbittorrent', url: `http://${MEDIA_HOST}:8080` },
  { name: 'prowlarr', url: `http://${MEDIA_HOST}:9696` },
  { name: 'kavita', url: `http://${MEDIA_HOST}:5000` },
  { name: 'vaultwarden', url: 'http://127.0.0.1:8222' },
  { name: 'worldmonitor', url: 'https://worldmonitor.app' },
]
