# Architecture de neutroncore

Hub PWA du homelab : films et séries, demandes, téléchargements, sous-titres, tâches de fond (mcp-tracking et Lyra), projets suivis, ambiance (TV, Hue, scènes), lanceur local (dossiers et terminaux Claude Code), chat Lyra.

## Vue d'ensemble

```
telephone / bureau  --HTTPS (tailnet)-->  lyra-control-api (FastAPI, :9876)
        |                                       |-- /app/  : ce depot, construit par `npm run build` (dist/)
        |                                       |-- routers : tv, hue, qbit, services, tracking, arr, overseerr,
        |                                       |             subtitles, system, projects, launcher, lyra_chat, roadmap
        |                                       |-- socket UNIX du demon Lyra (chat SSE)
        `-- coque Android (Capacitor) : charge la meme URL, ne contient pas le frontend
```

- **Frontend** : Vite + React 19 + TypeScript, aucune bibliothèque d'interface. Design system maison dans `src/styles.css` (jetons du branding amineutron : or `#f6c177`, rose `#eb6f92`, aubergine `#0e0a10` ; polices JetBrains Mono et Cantarell auto-hébergées).
- **Écrans** : un fichier par écran dans `src/screens/`, primitives dans `src/components/ui.tsx`, aide contextuelle dans `src/lib/help.ts`.
- **Données** : `usePoll` (`src/lib/poll.ts`) interroge l'API à un rythme adapté (5 s pour l'actif, 30 à 60 s pour le reste), en pause quand l'onglet est caché. Pas de WebSocket, sauf le flux SSE du chat Lyra et des sessions.
- **Authentification** : clé Bearer saisie une fois et gardée dans localStorage ; les actions destructives exigent un jeton HMAC de 30 s (`GET /auth/token`) renvoyé dans l'en-tête `X-Confirm`.
- **Projets suivis** : `src/components/Projects.tsx` lit `GET /roadmap/projects` (relais vers project-tracker, qui lit les issues GitHub) : une ligne par projet, ligne de temps avec les moments qui demandent une intervention humaine, mascotte.
- **Mascottes** : `src/mascots.json` (30 créatures ASCII, 6 états), `src/components/Mascot.tsx`, bus `src/lib/mascotBus.ts` alimenté par les événements Lyra.
- **Coque Android** : `android/` (Capacitor 8), `capacitor.config.ts` pointe vers l'URL du tailnet ; un `npm run build` suffit à mettre à jour le téléphone, l'APK ne change que pour le natif.

## Backend

Le backend `lyra-control-api` n'est pas encore publié : il vit dans un dépôt privé et sert ce frontend en statique. Un mode démonstration sans backend (données fictives) est prévu : voir la feuille de route du dépôt.

## Développer

```bash
npm run dev      # serveur Vite avec proxy vers :9876
npm run build    # tsc + vite build -> dist/
```
