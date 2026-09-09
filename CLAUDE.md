# CLAUDE.md — neutroncore

Hub central de l'ecosysteme amineutron : films/series, demandes, telechargements,
sous-titres, taches de fond (tracking + Lyra), projets & mises a jour, ambiance
(TV/Hue/scenes), lanceur local (dossiers + terminaux Claude Code), chat Lyra.

## Architecture

- **Frontend** (ce depot) : Vite + React 19 + TypeScript, PWA. Aucune lib UI —
  design system maison dans `src/styles.css` (tokens issus du branding
  amineutron : or #f6c177, rose #eb6f92, aubergine #0e0a10 ; polices JetBrains
  Mono + Cantarell auto-hebergees dans `public/fonts/`).
- **Backend** : `~/dev/mobile/lyra-control-api` (FastAPI :9876) — les routers
  neutroncore sont `arr, overseerr, subtitles, system, projects, launcher,
  lyra_chat` + les routers historiques (tv, hue, qbit, services, tracking...).
- **Serving** : `npm run build` -> `dist/`, monte par FastAPI sur
  `http://<host>:9876/app/` (StaticFiles). Pas de deploiement separe.
- **Auth** : cle Bearer (LYRA_CONTROL_API_KEY de `~/.lyra-control.env`), saisie
  au premier lancement, stockee en localStorage. Actions destructives : token
  HMAC 30 s via `GET /auth/token` renvoye en header `X-Confirm`.
- **Chat Lyra** : POST /lyra/chat en SSE (pont vers le socket UNIX du daemon
  `~/.lyra/lyra.sock`, protocole JSON-lines) ; reponses aux confirmations via
  POST /lyra/answer.

## Commandes

```bash
npm run dev      # dev server Vite (proxy API vers :9876)
npm run build    # tsc + vite build -> dist/ (c'est le deploiement)
```

Apres un build, l'app est immediatement servie par le service
`lyra-control-api.service` (pas de restart necessaire pour le statique ;
restart requis si le backend change) :

```bash
systemctl --user restart lyra-control-api.service
```

## Conventions

- Polling differencie gate par visibilite : hook `usePoll` (src/lib/poll.ts) —
  5 s pour l'actif (torrents, sessions), 30-60 s pour le reste. Pas de
  WebSocket (sauf SSE du chat Lyra).
- Chaque ecran = un fichier dans `src/screens/`, primitives partagees dans
  `src/components/ui.tsx`. Garder les ecrans sous ~200 lignes.
- Jamais de secret dans le code : les cles API du stack media sont lues cote
  backend depuis les configs des conteneurs (lib/media_keys.py).
- Texte UI en francais, minuscules pour le chrome (identite wordmark).

## Etat connu / dettes

- qBittorrent : mot de passe absent de l'env apres la rotation Vaultwarden ->
  502 sur /qbit/torrents. Fix prevu : credential systemd user-scope
  `qbt-password` (config.py le lit deja via $CREDENTIALS_DIRECTORY) — voir
  la commande dans le rapport de session ou README.
- La maquette design de reference est publiee en artifact Claude
  (« neutroncore — maquette ») ; source dans le scratchpad de session.

## App bureau (2026-08-12)

- `neutroncore-app.sh` : fenetre `google-chrome --app` (instance unique, focus
  Hyprland si deja ouverte). Entree Wofi/Rofi : `~/.local/share/applications/neutroncore.desktop`.
- Endpoints v2 : DELETE /tracking/sessions/{id}, POST /qbit/torrents/{hash}/delete,
  GET /arr/movies|series, GET /launcher/browse, GET /system/journal, POST /tv/app.
- Chat Lyra : lecteur JSON-lines bufferise maison (_LineReader) — ne PAS revenir
  a socket.makefile, il casse apres un timeout.

## v3 (2026-08-12)
- 7 themes (data-theme sur :root, tokens dans styles.css), reglages localStorage (lib/settings.ts, ecran Parametres)
- Scrollbar auto-masquee (classe html.scrolling), responsive <560px
- LyraPanel toujours monte (hidden CSS) : badge non-lu anime + Notification API ; bulles larges en .bub.pre scrollables
- Demandes : saisons/qualite/langue + watchlist maison (~/.neutroncore/watchlist.json)
- Updates systeme : dnf check-update (cache ~/.neutroncore/system_updates.json), download-only des paquets surs
- Ambilight : modes JointSpace FOLLOW_VIDEO/FOLLOW_AUDIO/LOUNGE_LIGHT/OFF (pas les libelles courts)

## v4 (2026-08-13)
- Mascottes ASCII (src/mascots.json, 15 fast lyra + 15 slow ephaistos/hestia, 6 etats animes) :
  composant Mascot.tsx + bus lib/mascotBus.ts (onLyraEvent mappe les evenements SSE vers les etats).
  Chaine sur l'accueil + miniatures dans le chat. Choix/toggles dans parametres.
- Scenes ambiance en carres : GET /hue/scenes/{id}/preview (couleurs via lib/huecolor.py, teste),
  mini-piece RoomPreview (positions entertainment), LED glow .scene-sq.on::after.
- /hue/lights renvoie la couleur hex (teinte pleine luminosite) ; sliders bri par lumiere.
- 4 animations de notif lyra (pulse/shake/ring/toast) choisies dans parametres avec apercu.
- Portage TUI Lyra des mascottes : a faire cote projet lyra (les frames sont dans mascots.json).

## v5 (2026-08-17) — accueil du nouvel arrivant
- **Animation de lancement** (`components/BootSplash.tsx`) : allumage du réacteur (CSS)
  puis wordmark ASCII figlet *slant* en dégradé et log de boot qui affiche
  l'installation RÉELLE (services up/total, daemon Lyra, serveurs MCP branchés).
  Passable au clic ou à la touche, respecte `prefers-reduced-motion`.
  Réglage `bootAnim` (défaut activé) dans paramètres > démarrage & aide.
- **Animation de retour** (`components/WelcomeBack.tsx`, 2026-08-23) : version
  courte (~1,8 s) jouée quand l'app est rouverte moins de 4 h après. Halo qui
  respire, mascotte choisie en état « ok », salutation selon l'heure (bon retour
  / te revoilà / bonsoir / « encore debout ? » la nuit) et temps écoulé depuis
  la dernière visite. Réglage `welcomeAnim`.
- Aiguillage dans `pickIntro()` (App.tsx) : première ouverture ou absence de
  plus de 4 h → séquence complète ; retour rapide → salut court ; chaque intro
  se désactive séparément. `neutroncore_last_visit` horodate la visite,
  `neutroncore_force_intro` permet le rejeu depuis les réglages (trois boutons :
  revoir le lancement / le retour / le tutoriel).
- **Tours guidés** (`components/Tour.tsx`) : deux tours — `main` (bienvenue,
  accueil, mode télé, paramètres) et `settings` (thèmes, affichage, mascottes,
  démarrage, puis galerie de choix de mascotte avec aperçu des 5 humeurs).
  Le tour principal propose le second à sa dernière page (`offer: 'settings'`).
  **Une mascotte narratrice différente par page** (champ `mascot`).
  Zone éclairée NETTE : le voile flouté est percé par un `mask-image` radial
  centré sur la cible (variables `--mx/--my/--mw/--mh` inline) ; le halo ne
  porte plus l'assombrissement (plus de `box-shadow: 0 0 0 9999px`). Le halo suit un élément réel via
  sélecteur CSS ; l'étape mode télé bascule vraiment l'affichage. Drapeau
  `neutroncore_tour_v1` en localStorage, relançable depuis les paramètres.
  Cible du bouton télé : attribut `data-tour="tv"` (robuste si un autre bouton
  apparaît dans la topbar).
- **Aide par écran** : `PageTitle` accepte `help="<clé>"` et affiche un bouton `?`
  qui ouvre le contenu de `lib/help.ts` (11 écrans couverts). Le point doré du
  titre est porté par `.ptitle .t::after` pour rester collé au texte.
- Wordmark ASCII : figlet `small` était illisible en JetBrains Mono (traits qui
  fusionnent) — `slant` en graisse 400 est net.

## Adaptation téléphone (2026-08-18)
- **Mode télé** : `zoom: 1.35` ne s'applique plus qu'au-dessus de 980px. Sur un
  écran de 390px il ne laissait que 289px utiles : topbar et cartes débordaient,
  et le bouton de sortie pouvait devenir inatteignable alors que la navigation
  est masquée dans ce mode.
- **Tours sur téléphone** : carte ancrée en bas (ou en haut si la cible est dans
  la moitié basse, classe `at-top`) ; l'étape paramètres ouvre le tiroir et vise
  `.rail.open .nav a.on` (la rail est cachée sous 980px) ; la cible est amenée
  dans l'écran par `scrollIntoView` (`block: 'start'` pour les cibles hautes,
  sinon `'center'`) avec `scroll-margin-top` pour ne pas coller à la topbar.
- **Sonde services** : le check `lyra` cherchait le processus `lyra.pipeline`
  (architecture pré-démon) — fausse alerte rouge permanente sur l'accueil alors
  que le daemon tournait. Corrigé en `lyra.daemon` (repli sur l'ancien motif).

## Tour v2 (2026-08-18)
- Page bienvenue : presente aussi Lyra (chef d'orchestre : choisit le modele,
  traduit la phrase en commande, fait confirmer, execute). Centree AUSSI sur
  telephone (`.tour-card.center` echappe a l'ancrage bas de la media query).
- Rappel visuel : `hintHelp` sur une etape ajoute `.tour-hint-help` sur :root ;
  les boutons `?` passent au-dessus du voile (z-index 195) et pulsent en degrade.
  Repond au cas "le texte parle du ? mais rien ne le montre".
- **Bug du zoom** : en mode tele (`zoom:1.35` au-dessus de 980px),
  getBoundingClientRect renvoie des coordonnees VISUELLES qui etaient reposees
  dans le calque lui-meme zoome -> halo decale (pointait a cote sur ordinateur,
  juste sur telephone ou le zoom vaut 1). Fix : diviser par le zoom du root.
- Curseur anime (`pointer: true`) : part du centre de l'ecran, glisse vers la
  cible (transition .85s) puis joue un anneau de clic en boucle.
- Transitions : le contenu de la carte est remonte a chaque etape (`key`) avec
  une entree laterale dont le sens suit suivant/retour (etat `dir`).
- Textes : mode tele reformule (le bouton devient "quitter tele"), etape
  mascottes ecrite a la premiere personne par la mascotte (moi / Ephaistos).

## Application Android (Capacitor, 2026-08-22)
- Coque native dans `android/`, config dans `capacitor.config.ts`.
  `appId: app.neutroncore.hub`, nom affiche « neutroncore ».
- **Elle ne embarque pas le frontend** : `server.url` pointe vers
  `http://<IP_TAILSCALE>:9876/app/` (tailnet). Un `npm run build` suffit donc a
  mettre a jour ce que le telephone affiche, sans reconstruire d'APK.
- Deux pieges rencontres, a connaitre si on refait la manip :
  - `colors.xml` n'est pas genere par Capacitor 8 alors que `styles.xml` y fait
    reference (`@color/colorPrimary`) -> a creer, sinon le build casse.
  - Android 9+ bloque le HTTP en clair : sans `network_security_config.xml`,
    ecran blanc. Le cleartext n'est autorise QUE pour l'hote du tailnet et le
    LAN, pas globalement (le tunnel Tailscale chiffre deja le trafic).
  - Ne PAS creer `drawable/splash.xml` : Capacitor fournit deja `splash.png`
    dans chaque densite, et les deux entrent en conflit (Duplicate resources).
    Remplacer les PNG.
- Reconstruire : `./build-apk.sh` (ajouter `--install` avec le telephone
  branche en USB et le debogage actif). Le script n'installe QUE sur un
  appareil USB : la TV Philips est appairee en ADB reseau et serait sinon une
  cible possible.

### Adaptation telephone (2026-08-22, teste sur Pixel 9 Pro / Android 17)
- **Cibles tactiles** : media query `(max-width:980px) and (pointer:coarse)`.
  Le viewport fait ~500px pour 2856px physiques : les tailles pensees pour la
  souris donnaient des boutons de moins de 4mm. Minimum 44px desormais.
- **Plein ecran** : barres systeme masquees en mode immersif (MainActivity,
  WindowInsetsControllerCompat + BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE),
  remasquees a chaque retour de focus. Marges de securite en CSS via
  `env(safe-area-inset-*)` (index.html a deja `viewport-fit=cover`).
- **Bouton retour** : ferme d'abord la surcouche ouverte (modale, tutoriel,
  tiroir, chat, mode tele), puis revient a l'accueil, et ne quitte qu'ensuite.
  Deux pieges enchaines :
  1. `enableOnBackInvokedCallback="false"` est IGNORE a partir d'API 36 : le
     retour predictif est impose et fermait l'activite sans passer par
     Capacitor (le listener `backButton` n'etait jamais appele).
  2. `getOnBackInvokedDispatcher()` en direct ne marche pas non plus :
     AppCompat y enregistre deja son rappel, qui gagne. Il faut passer par
     `getOnBackPressedDispatcher().addCallback(...)` (androidx.activity).
  Cote web, l'interface empile une entree d'historique par surcouche ouverte
  et ferme sur `popstate` — ce qui profite aussi au geste retour du navigateur.

## Sessions Claude Code dans le lanceur (2026-08-24)
- Bloc « sessions » en tête de l'écran lanceur (`components/Sessions.tsx`,
  `SessionChat.tsx`, `SessionMeta.tsx`, helpers `lib/sessions.ts`). Sessions
  vivantes dont le cwd est SOUS un favori du lanceur (case « hors favoris
  aussi » pour tout voir). Carte dépliable (conversation + réponse), « plein
  écran » (`.sess.max`, fixed), « fenêtre » (focus kitty via hyprctl),
  « fiche » (nom, commentaire en bandeau, couleur `--sc`, épingle ; option
  `/rename` propagé au terminal). Puce « N sessions » sur les favoris.
  Récentes (7 j, dossiers du lanceur, sans les runs `claude -p`) avec
  « reprendre » = kitty + `claude --resume`.
- Backend `routers/claude_sessions.py` + `lib/claude_sessions.py` (logique pure,
  testée `tests/test_claude_sessions.py`) + `lib/kitty_rc.py`. Sources : registre
  `~/.claude/sessions/<pid>.json` (status idle/running), transcripts JSONL
  (lecture incrémentale par offset d'octets), fiches `~/.neutroncore/sessions_meta.json`.
- Répondre = kitty remote control (`allow_remote_control socket-only` +
  `listen_on unix:/tmp/kitty-nc-{kitty_pid}` dans dotfiles/kitty.conf) : la
  fenêtre est retrouvée par le pid `claude` dans foreground_processes. Une
  kitty lancée AVANT cette config n'a pas de socket -> session « lecture
  seule ». Action `launcher_reply` (token X-Confirm), touches limitées
  (`kitty_rc.ALLOWED_KEYS`).
- Notifs : hooks Claude Code `Notification` + `Stop` (`~/.claude/scripts/hooks/
  neutroncore-session-event.sh`, curl 1 s non bloquant) -> POST /launcher/
  sessions/hook -> SSE /launcher/sessions/events (lecture fetch streaming,
  reconnexion 4 s). Carte en attente : pastille rose + animation `lyraAnim`
  (pulse/shake/ring, toast inline) + Notification bureau ; fin de réponse :
  halo or 2 cycles. Poll 5 s en filet.
- 2026-08-24 (soir) : classes CSS des sessions prefixees `cs-` (l'ecran taches
  utilisait deja `.sess`/`.sess-detail` -> collision qui cassait « taches de
  fond » sur telephone). En-tete de carte : nom 14px, dossier en pilule
  couleur, etat en mot colore, boutons en grille 3 colonnes sous 560px.
  Rendu des reponses `components/Markdown.tsx` (fences ``` en blocs separes
  avec bouton copier, titres, listes, code inline) ; outils "nom + argument".
  Nom synchronise dans les deux sens : `lib/claude_sessions.sync_names`
  adopte le nom `/rename` du terminal (registre `nameSource != derived`,
  memo `synced_name` dans la fiche) ; renommer dans l'app envoie `/rename`
  (PUT meta, propagate par defaut). Le terminal gagne en cas de conflit.
- Tour multi-formats 2026-08-24 (390 / 820 / 1366 / 1920 / 3840 TV) : `.grid>*{min-width:0}`
  (un titre nowrap ne force plus une colonne plus large que l'ecran — cause du
  debordement de « taches de fond ») ; `.sess .head` en wrap sous 980px ;
  `.scroll-x` avec fondu a droite + table min-width sur telephone ; vignettes
  de theme en auto-fill sous 560px ; mode tele zoom 2.4 au-dela de 3000px.
  Harnais de test : scratchpad `_viewport.html` (a copier dans dist/ apres
  build, meme origine => force startScreen/intro off et `document.hidden=false`
  dans l'iframe, sinon usePoll ne demarre pas quand l'onglet est en fond).
- Capsule bureau (2026-08-24) : quand Claude attend une réponse, l'API envoie
  `notify-send` avec les hints du template Quickshell `Capsule`
  (`routers/claude_sessions.py: _send_capsule`, hints construits par
  `lib/claude_sessions.capsule_hints`, testés). Réglages persistants
  `~/.neutroncore/notif_capsule.json` (GET/PUT /launcher/sessions/notif-settings,
  POST /launcher/sessions/notif-test) : enabled, accent (session|#hex), label
  ({repo} {name} {message}), position, style, open_ms, duration_ms, on_stop.
  UI : `components/SessionNotifSettings.tsx` dans paramètres (5 exemples par
  entrée + valeur libre) + réglage local `sessionBrowserNotif` (notif
  navigateur des sessions, à couper sur le PC). Le clic sur la capsule fait
  le focus de la kitty (`focus-pid:<kitty_pid>` calculé côté API).
- Correctifs 2026-08-24 (soir 2) : `kitty_rc.send_text` envoie le texte PUIS
  la touche `enter` en deux appels (150 ms) — `texte\r` en un bloc est pris
  pour un collage par Claude Code (texte inséré, jamais soumis). Brouillon de
  réponse persisté par session (`localStorage cs-draft:<id>`) : survit au
  changement d'écran / repli de carte. Tracking `[DEV]` : hook SessionEnd
  rendu synchrone (async = jamais exécuté à la sortie) + reconciliation dans
  `stop-tracking-session.py` (tmp `/tmp/claude-dev-tracking-*` d'une session
  dont le pid est mort -> `done`).
- Etats de session + fermeture (2026-08-25) : fiche `state` = `parked` (en
  veille, groupe replie « en veille », bouton veille/réveiller) ou `closing`
  (en fermeture). POST /launcher/sessions/{id}/state (réversible, sans
  confirmation) ; POST .../close {mode: clean|now, steps} (token
  `launcher_close`). `clean` = envoi du prompt de clôture
  (`lib/claude_sessions.closing_prompt`, étapes CLOSING_STEPS : summary
  docs/SESSIONS.md, readme, git, memory) et carte « en fermeture » avec chat ;
  Claude termine par `SESSION PRETE A FERMER` -> `close_ready` (détecté dans le
  transcript) -> carte verte « prête à fermer ». `now` = `/exit` dans la kitty
  (SIGTERM si injoignable). UI `components/SessionClose.tsx` : fermer ? ->
  clôturer proprement ? (cases) -> fermeture sans clôture = 2e confirmation.
  Accueil : `components/HomeSessions.tsx` (réglage « sessions claude code sur
  l'accueil ») — glyphes/mascottes réagissant à `lib/sessions.glyphState`
  (attend=err, travaille=busy, veille=sleep, fermeture=work, prête=ok).
- Lancement « en route » (2026-08-25) : store `lib/launches.ts` (Lanceur ->
  Sessions). Après `POST /launcher/claude` ou `/resume`, une carte fantôme
  `.cs-launch` pulse en tête des sessions (poll accéléré 1,5 s) jusqu'à ce
  qu'une session corresponde (`matchLaunch` : même sessionId pour une reprise,
  sinon même cwd et startedAt >= clic − 5 s) ; la vraie carte arrive avec
  `.anim-arrive` (glissement + halo or 4,5 s) et se déplie. Au-delà de 60 s :
  carte ambre « aucune session détectée ». Bouton du favori : « en route… ».
  Mesuré : enregistrement de la session ~2 s après le lancement.
- Choix affichés quand Claude attend (2026-08-25) : hook `PermissionRequest`
  (settings.json, synchrone 3 s, même script que Notification/Stop ; il n'écrit
  rien -> le dialogue du terminal s'ouvre normalement) -> POST /hook stocke
  {tool, input, suggestions} ; sinon repli sur le dernier `tool_use` sans
  `tool_result` du transcript (`lib/claude_sessions.pending_tool` :
  AskUserQuestion, ExitPlanMode). `describe_pending` -> {kind permission|plan|
  question, detail (diff Edit, commande Bash, plan markdown, questions+options),
  options[{label, keys}]} rendu par `PendingPanel` dans SessionChat ; chaque
  bouton envoie la séquence de touches du dialogue (POST /reply {keys}) :
  Entrée = oui, flèche bas+Entrée = 2e choix (seulement si `permission_
  suggestions`), Échap = non. Testé en réel (`--permission-mode default`) :
  Write refusé par Échap, fichier non créé. Faux « attend ta réponse » corrigé :
  le registre écrit `busy`/`waiting`, jamais `running` ; on lève l'attente si
  status busy/running après la notif OU si le transcript a bougé
  (`activity_after`). Fermeture : Ctrl+C avant `/exit` (saisie en cours).
  PIEGE test : une kitty lancée depuis une session Claude hérite de
  CLAUDE_CODE_CHILD_SESSION (pas de transcript) -> `systemd-run --user`.
- Sessions sur l'accueil / télé (2026-08-25, 2e passe) : exclues si `state=parked`
  ou fiche `home_hidden` (bouton « accueil : oui/non » sur chaque carte du
  lanceur, PUT meta). `components/HomeSessions.tsx` (`visibleOnHome`) sert
  l'accueil et la source télé `sessions` (TvDashboard) ; pour cette source
  les tailles s/m/l sont des FORMATS : court = glyphes, moyen = glyphe + nom +
  état en colonne, long = bande `.tv-wide` pleine largeur au-dessus des
  colonnes CSS avec le dernier échange (pas de zoom sur cette section).
- Mode télé responsive (2026-08-24) : zoom par paliers selon la largeur réelle
  (<1200 : 1, 1200 : 1.1, 1700 : 1.35, 2400 : 1.8, 3000 : 2.4) et colonnes
  `.tv-cols` 3/2/1 ; avant, 1.35 fixe faisait déborder la barre du haut à 1366.
- Notifications téléphone (2026-08-24) : serveur **ntfy** auto-hébergé
  (`neutroncore/ntfy/docker-compose.yml`, écoute sur l'IP Tailscale uniquement,
  port 8377, `auth-default-access: deny-all`, utilisateur `neutroncore`). L'API
  publie (`routers/claude_sessions._push_phone`, payload `lib/claude_sessions.
  ntfy_payload` testé) quand Claude attend / a fini ; jeton `NTFY_TOKEN` +
  `NTFY_PHONE_PASSWORD` dans `~/.lyra-control.env` (jamais en dur). Réglages
  `phone_enabled/priority/on_stop/quiet` dans notif_capsule.json (heures de
  silence, testées). Le clic ouvre `APP_PUBLIC_URL?screen=lanceur&session=ID` :
  intent-filter VIEW dans AndroidManifest (rebuild APK requis) + `appUrlOpen`
  (@capacitor/app) dans App.tsx + dépliage auto dans Sessions.tsx
  (`sessionStorage.deepLinkTarget`). Badge nav « lanceur » = sessions en
  attente (rose) ou actives (gris), poll 10 s.
- Glyphe de session personnalisable (2026-08-24) : fiche > glyphe = lettres |
  mascotte (30, `mascots.json`, état suit la session) | icône (35 SVG inline
  `lib/icons.tsx`) + fond (palette ou libre). Meta `icon` ("mascot:kind:name"
  / "icon:id", validé `ICON_RE`) et `icon_bg`. Rendu `components/SessionGlyph.tsx`.
  Réglages repliables : composant `Fold` (chevron CSS + catégorie, contenu
  décalé) dans SessionNotifSettings.
- Deep link Android VALIDÉ 2026-08-24 (Pixel 9 Pro) : push ntfy -> tap -> app
  ouverte sur lanceur, session dépliée. Deux réglages faits par adb, à refaire
  sur un autre téléphone : `pm set-app-links-user-selection --user 0 --package
  app.neutroncore.hub true <IP_TAILSCALE>` (sinon le lien http ouvre Chrome) et
  abonnement ntfy par intent `ntfy://<IP_TAILSCALE>:8377/<topic>?secure=false`
  (topic `NTFY_TOPIC`, aléatoire, lecture anonyme autorisée par ACL ntfy —
  `ntfy access everyone <topic> read-only` — l'écriture reste sur jeton ; le
  serveur n'est joignable que via le tailnet). Piège : après un `npm run build`,
  l'app ouverte garde l'ancien bundle jusqu'au bandeau « recharger ».
