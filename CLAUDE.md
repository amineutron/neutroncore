# CLAUDE.md — neutroncore

Hub central de l'ecosysteme amineutron : films/series, demandes, telechargements,
sous-titres, taches de fond (tracking + Lyra), projets & mises a jour, ambiance
(TV/Hue/scenes), lanceur local (dossiers + terminaux Claude Code), chat Lyra.

## Chemins et adresses

Aucun chemin ni IP de machine en dur dans ce depot. Les chemins s'ecrivent
avec les variables que lit l'API (`config.py` de lyra-control-api), a
surcharger dans son fichier d'env :

| Variable | Defaut | Role |
|---|---|---|
| `DEV_ROOT` | `~/dev` | racine des projets (lyra, hue-mcp, lyra-control-api...) |
| `LYRA_SOCKET` | `~/.lyra/lyra.sock` | socket UNIX du daemon Lyra |
| `NEUTRONCORE_STATE` | `~/.neutroncore` | etat persistant (watchlist, fiches, reglages notif) |

Les IP vont dans `.env.local` (modele `.env.example`, valeurs de
documentation) ; on ecrit `<IP_TAILSCALE>` dans la doc.

## Architecture

- **Frontend** (ce depot) : Vite + React 19 + TypeScript, PWA. Aucune lib UI —
  design system maison dans `src/styles.css` (tokens issus du branding
  amineutron : or #f6c177, rose #eb6f92, aubergine #0e0a10 ; polices JetBrains
  Mono + Cantarell auto-hebergees dans `public/fonts/`).
- **Backend** : `$DEV_ROOT/mobile/lyra-control-api` (FastAPI :9876) — les routers
  neutroncore sont `arr, overseerr, subtitles, system, projects, launcher,
  lyra_chat` + les routers historiques (tv, hue, qbit, services, tracking...).
- **Serving** : `npm run build` -> `dist/`, monte par FastAPI sur
  `http://<host>:9876/app/` (StaticFiles). Pas de deploiement separe.
- **Auth** : cle Bearer (LYRA_CONTROL_API_KEY de `~/.lyra-control.env`), saisie
  au premier lancement, stockee en localStorage. Actions destructives : token
  HMAC 30 s via `GET /auth/token` renvoye en header `X-Confirm`.
- **Chat Lyra** : POST /lyra/chat en SSE (pont vers le socket UNIX du daemon
  `$LYRA_SOCKET`, protocole JSON-lines) ; reponses aux confirmations via
  POST /lyra/answer.
- **TV / Denon / Hue** (roadmap #73, 2026-09-24) : les routers `tv` et `hue`
  ne parlent plus aux appareils. Chaque route nomme un outil MCP (`tv.*`,
  `denon.*`, `hue.*`) et l'envoie au daemon par le message `{"type": "tool"}`
  (`lib/lyra_tools.py`), sans passer par le modele : ~10-40 ms a chaud.
  Seules les lectures sans equivalent MCP (couleurs, apercus de scene,
  positions Entertainment) lisent encore le pont Hue (`lib/hue_client.py`).
  neutroncore regroupe donc les MCP, il ne les reimplemente pas.
- **VMs** (2026-09-24) : `GET /services/vms` (outil `fedora.vm_status`, a la
  demande, cache 10 s, dernier etat connu si le demon tombe) et
  `POST /services/vms/{vm}/{start|stop|force_stop}` (jeton `vm_<action>_<vm>`).
  Jamais de `virsh` direct depuis l'API : sans `LIBVIRT_DEFAULT_URI`, il lit
  `qemu:///session`, vide.

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

L'API tourne dans son propre environnement `.venv` (depuis le 2026-10-15, `requirements.txt` +
`requirements-dev.txt` pour les tests) : le Python du systeme epinglait `cryptography` 44 (failles
connues) et `pyOpenSSL` de Fedora interdit de le monter au-dela de 45. Ses tests se lancent avec
`.venv/bin/python -m pytest -q`.

Un restart ne tue plus les kitty ouvertes par le lanceur (elles tournent dans
leur propre scope via `systemd-run --scope`) ; l'arret prend 5 s maximum
(`timeout_graceful_shutdown`).

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

- qBittorrent (regle le 2026-10-06) : le 502 sur /qbit/torrents venait d'un
  credential perime en memoire. La rotation mensuelle reecrit le blob
  `~/.config/lyra-control/qbt-password.cred` sans redemarrer l'API, et
  `LoadCredentialEncrypted` ne se relit qu'au demarrage. `lib/creds.py` relit
  donc le blob a chaque login (env > blob > credential charge). Ne pas revenir
  a une lecture seule de `$CREDENTIALS_DIRECTORY`.
- Valeurs privees : `tests/test_config_secrets.py` (lyra-control-api) echoue si
  une IP tailnet ou un chemin `/home/...` reapparait dans un fichier suivi.
  Les adresses de machine n'ont plus de defaut reel dans `config.py`.
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
- Demandes : saisons/qualite/langue + watchlist maison ($NEUTRONCORE_STATE/watchlist.json)
- Updates systeme : dnf check-update (cache $NEUTRONCORE_STATE/system_updates.json), download-only des paquets surs
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
  (lecture incrémentale par offset d'octets), fiches `$NEUTRONCORE_STATE/sessions_meta.json`.
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
  `$NEUTRONCORE_STATE/notif_capsule.json` (GET/PUT /launcher/sessions/notif-settings,
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

## Lot 1 des nouveaux volets (2026-10-06)
- **Dialogues maison** : plus aucun `window.confirm` / `window.alert`. `lib/dialog.ts`
  (`confirmDialog`, `ask` avec case a cocher ou `single`, `toast`) rendu par
  `components/Dialogs.tsx`. Entree n'est PAS interceptee : le focus demarre sur
  « annuler » pour une action `danger`. Une meme question ne s'empile pas deux fois.
- **Telecommande** (`components/Remote.tsx`, ecran ambiance) : POST /tv/key
  (liste fermee `TV_KEYS` dans `routers/tv.py`), /tv/app, /tv/source (entree du
  Denon). La carte prend le focus : fleches, Entree, Retour arriere, Espace.
- **Manquants** (`components/Missing.tsx`, onglet de films & series) :
  GET /arr/missing (episodes avec `series_id`, regroupes par `lib/missing.ts`)
  et POST /arr/search. Un film pas encore sorti n'a pas de bouton « relancer ».
- **Services** (`components/Services.tsx`, ecran outils) : clic = demarrer ou
  arreter, seulement si `controllable` (vrai quand un jeton `service_stop_<nom>`
  existe cote API). Toujours avec X-Confirm.
- Volets ecartes par choix : ventilateur, pairs d'un torrent.

## Lot 2 des nouveaux volets (2026-10-06)
- **Alertes typees** : chaque alerte de GET /system/alerts porte `kind` (disk,
  unit, backup, rotation, memory, agenda) et `key` (identite stable, sans le
  pourcentage). L'accueil lit `kind` ; ne plus tester le texte du titre.
- **Centre de notifications** : cloche dans la barre du haut + tiroir
  (`components/NotifCenter.tsx`, mise en forme `lib/notifs.ts`). Cote API,
  `routers/notifications.py` + `lib/notif_center.py` (teste), fil borne a 300
  entrees dans `$NEUTRONCORE_STATE/notifications.json`. Un veilleur (tache du
  lifespan, 60 s) journalise l'apparition, l'aggravation et la resolution des
  alertes meme sans interface ouverte ; le hook des sessions Claude y ajoute
  « attend ta reponse » et « reponse prete » (une ligne par session, comptee
  xN tant qu'elle n'est pas lue). Vider = jeton `notifications_clear`.
- **Palette de commandes** (Ctrl+K ou bouton « chercher ») :
  `components/Palette.tsx`, classement `lib/palette.ts` (teste), registre
  `lib/commands.tsx` (ecrans, mode tele, themes, scenes Hue, TV, favoris du
  lanceur, liens). Etoile ou Ctrl+D = favori (`neutroncore_palette_favs` en
  localStorage) ; les favoris passent en tete et s'affichent en « raccourcis »
  sur l'accueil (`components/HomeShortcuts.tsx`). Ajouter une commande = une
  entree dans `buildCommands`, avec un `id` stable (c'est la cle du favori).

## Lot 3 des nouveaux volets (2026-10-06)
- **Plan de piece** (ecran `plan`, groupe maison) : `screens/Plan.tsx` +
  `components/RoomPlan.tsx` (SVG en centimetres, glisser-deposer par pointer
  events), geometrie pure `lib/plan.ts` (testee). Lit et ecrit GET/PUT /plan,
  c'est-a-dire le fichier de plan de HALO, qui reste la source de verite et se
  recharge seul. Rien n'est ecrit avant « enregistrer ». Le ruban LED et la TV
  sont affiches mais jamais envoyes (`toPayload`). Piege de nommage herite :
  `roomDims.h` = PROFONDEUR, `roomDims.d` = HAUTEUR. Cote API,
  `validate_incoming` refuse NaN, infini et dimensions hors 100-3000 cm.
- **HALO** : POST /screens/ambihue (associer l'Ambilight aux lampes Hue) et
  GET /screens/measured (couleurs mesurees par la TV, filtrees en #rrggbb),
  interroge toutes les 3 s seulement quand « couleurs de la tv en direct » est
  active.
- **Routines** : `components/Routines.tsx` + `RoutineEditor.tsx` sur l'ecran
  ambiance, aussi dans la palette (`routine:<id>`). Cote API
  `routers/routines.py` + `lib/routines.py` (teste) : catalogue FERME d'actions
  (scene Hue, lumieres, TV, ampli, attente), aucune commande libre ; volume de
  l'ampli plafonne a `DENON_MAX`. Une etape en echec n'arrete pas les
  suivantes. Planification facultative (heure + jours) executee par un
  planificateur du lifespan (30 s), fenetre de 10 min pour ne pas rejouer une
  routine du matin apres un redemarrage le soir ; un passage planifie est
  toujours trace dans le centre de notifications. Ajouter une action = une
  entree dans `ACTIONS` + une branche dans `_execute`.
- Apres revue du lot 3 : POST /routines/{id}/run repond aussitot et execute en
  tache de fond (`running` puis `last` dans GET /routines, suivi par
  `lib/routineRun.ts`) ; les routines sont REVALIDEES a chaque lecture du
  fichier (une routine editee a la main hors bornes est mise de cote, jamais
  executee). `components/NumField.tsx` : champ nombre valide a la sortie ou a
  Entree — ne pas borner un champ controle a chaque frappe, la saisie devient
  impossible. `lib/navGuard.ts` : un ecran avec un brouillon (plan) fait
  confirmer avant tout changement d'ecran, retour ou mode tele.

## Plan de piece : vue 3D et ruban deplacable (2026-10-06, soir)
- **Vue 3D** (`components/RoomPlan3D.tsx`, projection pure `lib/plan3d.ts`
  testee) : meme principe que le Plan3D de HALO, projection orthographique
  yaw + inclinaison. Lecture seule : on tourne autour (glisser de cote,
  fleches, curseur d'inclinaison), on selectionne en touchant ; le deplacement
  se fait dans la vue de dessus. Un appui ne selectionne qu'au relachement et
  s'il n'a pas tourne la vue. TV, ruban et lampes sont tries par profondeur.
- **Ruban LED** : chaque segment = centre, angle (degres, sens horaire vu de
  dessus, 0 = le long de la largeur — convention QML de HALO) et longueur.
  L'app modifie position et angle ; longueur, nombre de segments et TV restent
  a HALO. Glisser deplace tout le ruban d'un bloc (case a decocher pour un
  segment seul). Pas de hauteur stockee : dessine a min(180 cm, plafond - 20).
- **Ne pas ecraser HALO** : GET /plan renvoie `rev` (empreinte du fichier),
  PUT la verifie et refuse si HALO a ecrit entre-temps (`stale`). Le ruban
  n'est envoye que s'il a ete modifie ici (`toPayload(draft, saved)`), et un
  segment inchange n'est pas reecrit cote API (ni arrondi, ni angle normalise).
- Piege de hauteur : `tv.pos.z` est une hauteur depuis le SOL, alors que le
  `pos.z` des lampes est centre sur la mi-hauteur.

## Automatisations (2026-10-06, nuit) — remplacent la carte « routines »
- **Section dediee** (ecran `automatisations`, groupe pilotage) : `screens/Automations.tsx`,
  editeur par blocs `components/AutomationEditor.tsx`, champ generique
  `components/BlockParams.tsx`, mise en phrases `lib/automations.ts` (testee).
  Une automatisation = QUAND (un declencheur) + SI (conditions, facultatives)
  + ALORS (actions). Declencheur `manual` = une routine (bouton « lancer »,
  aussi dans la palette sous l'identifiant `routine:<id>`). Les routines du
  lot 3 sont reprises automatiquement au premier chargement.
- **Cote API** : `lib/automations.py` (catalogues fermes ACTIONS / TRIGGERS /
  CONDITIONS, logique pure testee) + `routers/automations.py` (moteur). Le
  moteur tourne dans l'API (tache du lifespan, 30 s) : alertes et sessions
  Claude EMETTENT des evenements (`automations.emit`), services, TV et
  telechargements sont SONDES toutes les 60 s seulement si une automatisation
  active s'en sert, avec anti-rebond (2 releves identiques).
- **Garde-fous** : aucune action ne peut arreter, supprimer ni executer du
  texte libre ; un etat d'appareil inconnu fait echouer la condition ; delai
  minimal par automatisation (`cooldown_min`) et plafond de 12 lancements par
  heure ; une seule automatisation a la fois ; revalidation a chaque lecture
  du fichier `$NEUTRONCORE_STATE/automations.json`.
- **Trace** : chaque passage automatique va dans l'historique de
  l'automatisation (reussi, en echec, ou « non lance » avec la raison) et dans
  le centre de notifications. Les automatisations horaires apparaissent dans
  l'agenda (categorie `automatisations`, statut a venir / fait / en echec /
  manque).
- **Ajouter un bloc** : une entree dans le catalogue concerne de
  `lib/automations.py`, une branche dans `_execute` / `matches` /
  `conditions_ok`, sa phrase dans `lib/automations.ts`, et le catalogue de
  demo (`src/mock/data/home.ts`).
- **Plan de piece** : dans la vue 3D, glisser une lampe de haut en bas regle
  sa hauteur (`heightDelta` dans `lib/plan3d.ts`) ; glisser le fond tourne.

## Automatisations v2 (2026-10-07) — plus de blocs, diagramme, Lyra
- **Catalogue** (`lib/automations.py` cote API) : 22 actions, 14 declencheurs
  (intervalle, seuil de ressource, demande, agenda, lumieres, evenement externe
  `POST /automations/event/{nom}`, demarrage...), 9 conditions. Conditions
  « toutes / au moins une », chacune inversable. Branche SINON. Par action :
  continuer ou arreter la suite, reessais (0 a 2). Plafond par jour, gabarits
  `{titre} {heure} {jour} {nom}...` dans les messages, compte rendu reglable
  (quand, ou, texte). Le catalogue de demo
  `src/mock/data/automationCatalogue.ts` est GENERE depuis `au.catalogue()` :
  le regenerer quand un bloc change, ne pas l'editer.
- **Deux vues, un brouillon** : `lib/useAutomationDraft.ts` porte l'etat ;
  `AutomationEditor.tsx` bascule entre « blocs » (`AutomationParts.tsx`,
  `AutomationOptions.tsx`) et « diagramme » gauche-droite (`FlowCanvas.tsx`,
  `AutomationDiagram.tsx`, disposition pure `layout()` testee). Sur la liste,
  le diagramme se colore d'apres le passage choisi (`nodeResult`,
  `RunDetail.tsx`).
- **Etat inconnu = aucune branche** : `conditions_ok` rend vrai, faux ou
  `None`. Un appareil injoignable ne lance ni « alors » ni « sinon » (sinon
  « si la tv est allumee... sinon l'allumer » agirait sur une TV muette).
- **Ne se rejouent pas** (`NO_RETRY`) : touche de telecommande, routine,
  attente, action Lyra. Un passage est abandonne apres `MAX_RUN_SECONDS`
  (10 min). L'intervalle n'est pas freine par le delai minimal. Une routine ne
  peut ni s'appeler elle-meme ni en appeler une en pause.
- **Action « demander a lyra »** (`lyra.tool`) : on n'envoie JAMAIS une phrase
  brute a executer sans humain. A l'edition, `POST /automations/analyze`
  interroge le demon (message `analyze`, regles seules, rien n'est execute) ;
  `lyra_verdict` n'accepte qu'un outil trouve, complet, des familles tv / hue /
  denon / catt, classe sans confirmation par Lyra, et une seule action par
  phrase. L'appel resolu (outil + arguments) est stocke ; a l'execution il est
  rejoue par la route `tool` avec `unattended` : le demon refuse lui-meme tout
  outil hors de `PERFORMANCE_TOOLS` et ne pose aucune question. Session du
  demon dediee `automation`. UI : `components/LyraPhrase.tsx` (modifier la
  phrase efface l'appel resolu : il faut la faire analyser de nouveau).
- **Cote Lyra** (`$DEV_ROOT/lyra`, non commite) : `lyra/daemon/analysis.py`,
  `handle_analyze` et l'option `unattended` dans `lyra/daemon/server.py`,
  `scripts/smoke_daemon.py` (`make smoke-daemon` : hello, ping, health,
  analyze, refus sans humain ; n'execute rien). Un demon pas encore redemarre
  repond « type de message inconnu: analyze » : l'UI l'affiche tel quel.
- **Plafonds d'un appel Lyra** (`lyra_call_error`, reverifie a chaque lecture du
  fichier) : volume <= `DENON_MAX`, `catt.cast_browser` / `cast_browser_dual` /
  `cast_url` refuses, seules les adresses https de YouTube en argument. Une
  phrase ne doit jamais permettre ce qu'un bloc natif interdit.
- **Historique** : les « non lance » identiques d'affilee sont regroupes
  (`times`) et partent les premiers quand la liste deborde — la cadence et le
  plafond du jour se comptent dans cet historique.
- Limite connue : `analyze` ne connait que les regles. Une phrase qui passerait
  par le modele dans le chat est « non reconnue » ici (ex. « monte le son a
  40 »). Un mode profond demanderait un pipeline sans effet de bord cote Lyra.

## Atelier 3d (2026-10-11) — le projet modelisation-3d dans neutroncore
Non commite (branche `feat/atelier-3d`) : l'utilisateur valide d'abord.
- **But** : `$DEV_ROOT/modelisation-3d` (pipeline build123d + boucle d'agents
  `/boucle-3d`) devient une section du hub, comme les MCP. neutroncore lit ses
  sorties, il ne les recalcule pas.
- **API** : `routers/modelisation.py` + `lib/modelisation.py` (ecrits par une
  autre session : modeles, jeu d'une iteration, fichiers, archive, pipeline,
  decoupe) et `routers/modelisation_boucle.py` + `lib/modelisation_boucle.py`
  (lancer une iteration). Racine : variable `MODELISATION_ROOT`.
- **Ecran** `screens/Atelier.tsx`, composants `components/atelier/` :
  `Viewer` (vue 3D), `PieceList`, `ControlsBar`, `IterationsPanel`,
  `Materials`, `Montage`. Logique pure et testee dans `lib/atelier.ts` ;
  tout three.js est dans `lib/atelierScene.ts`, charge a l'ouverture de
  l'ecran seulement (bloc separe d'environ 570 Ko).
- **Trois etats par piece** : affichee, fantome (opacite faible, aretes a la
  couleur de la piece), cachee. Clic sur une piece = menu sur place ; Ctrl,
  Maj ou « selection multiple » pour en prendre plusieurs. Focus = selection
  nette, reste en fantome. Eclate global ou autour de la selection. Une piece
  fantome laisse passer le clic vers une piece affichee derriere elle.
- **Familles** : les composants sont regroupes par cle de nomenclature
  (`familyOf` : `vis_bcd` -> `vis`). Les gabarits de controle sont caches au
  depart.
- **Controles** : bandeau d'une ligne (decomptes par nature), deployable en
  liste filtrable. « voir » retrouve les pieces nommees dans le controle.
- **Iterations** : chaque demande est conservee dans
  `sorties/<modele>/demandes.json` avec les pieces designees et les iterations
  de reference. Lancer = `POST /modelisation/{modele}/boucle` (jeton
  `modelisation_boucle`) : le texte est ecrit dans un fichier, et la commande
  ne contient que des chemins valides (`$(cat fichier)`), jamais le texte.
  La session Claude Code s'ouvre dans une kitty rangee sur l'espace Hyprland
  `special:atelier` (visible a la demande : `POST /modelisation/atelier/
  montrer`) et se suit dans l'ecran par `SessionChat`.
- **Materiaux** : `specs/<modele>.prix.yaml` (cote modelisation-3d) =
  `{releve_le, devise, note, articles: {<cle>: {nom_recherche, conditionnement,
  prix_lot_min, prix_lot_max, plateformes, confiance, remarque, inclus}}}`.
  Un prix non constate reste `null` : on n'estime jamais. Le total est une
  fourchette de lots, hors impression et hors port.
- **Montage pas a pas** : `montageSteps` fait apparaitre les pieces que chaque
  etape de la fiche cite ; celles qu'aucune etape ne nomme arrivent a la fin.
- **Videos** : « video (tour) » et « video (montage) » enregistrent la toile
  (MediaRecorder, webm) telle qu'elle est, coupe et eclate compris.
- **Reponses de Claude** : `lib/markdown.ts` (analyse pure, testee) +
  `components/Markdown.tsx`. Tableaux dans un cadre defilant, schemas et
  arborescences en chasse fixe sans cesure, listes avec leur numero d'origine,
  liens limites a http(s). Les propositions d'une question sont des cartes a
  toucher (`.cs-choice`). Tout nouveau cas mal rendu = un test d'abord.
- **Piege de verification** : pour charger la vraie app dans un navigateur de
  test sans exposer la cle, passer par un relais local en lecture seule qui
  ajoute l'en-tete (jamais la cle dans un script de test).


## Atelier 3d, deuxieme passe (2026-10-12) — montage anime, videos, projets
Non commite (branche `feat/atelier-3d`).
- **Montage en gestes courts** (`lib/atelierMontage.ts`, teste sur la vraie fiche) :
  `splitEtape` coupe une phrase de la fiche sur « puis », « ; » et les verbes
  qui s'enchainent ; parentheses et suite de « : » deviennent l'astuce.
  `montageSteps` place chaque piece au geste qui la nomme le mieux (nom propre
  = 2, objet du geste = 3, precision = 1) ; a egalite, une piece imprimee va a
  sa premiere mention, un composant pres des pieces sures de l'etape ; une piece
  que rien ne nomme rejoint celle qu'elle touche et est signalee « deduite ».
  La fiche peut aussi donner des etapes structurees `{titre, astuce, pieces}` :
  elles sont prises telles quelles (c'est la voie exacte, a faire produire par
  la boucle). Une fiche mal formee ne casse rien.
- **Geste rejoue en boucle** : `insertionDir` dit d'ou arrive une piece (axe le
  plus mince de la piece de base, ou face exterieure contre laquelle elle est
  posee) ; `AtelierScene.setAnim` la fait glisser en boucle, pause et vitesse
  par `setAnimPlayback`. Vignette par geste : `thumbnails`.
- **Videos** : `lib/atelierFilm.ts` (scenario pur : plans, camera, fondus) +
  `lib/atelierDirector.ts` (tournage). La scene est pilotee image par image
  (`beginFilm` / `filmFrame` / `endFilm`), recopiee sur une toile 1280x720 avec
  decor et textes, et c'est cette toile qu'on enregistre (mp4 si le navigateur
  sait, sinon webm). « video de montage » = notice sur fond clair, un plan par
  geste ; « video de presentation » = travelling, plongee, vue eclatee, pose
  finale, sans l'outil imprime pose a cote (`piecesProduit`). Temps reel :
  l'onglet doit rester au premier plan. Pendant un film, tout reglage qui
  arrive (etats, selection) est garde pour la fin, pas applique.
- **Controles dits avec des mots** (`lib/atelierControle.ts`) : titre, phrase
  et consequence par famille (le mot avant « : »). Le sens d'une limite est
  deduit des nombres d'un echec. Famille inconnue = formulation generale, rien
  d'invente. Ajouter une famille = une entree dans `FAMILLES`.
- **Bulle de la boucle** (`components/atelier/LoopBubble.tsx`) : languette sur
  le flanc droit, s'ouvre seule quand Claude attend. Piege CSS : `all:unset`
  sur un enfant remet `pointer-events` a la valeur heritee (`none` ici).
- **Selection dans la liste** : un clic ajoute ou retire, Maj + clic prend la
  plage (`rangeSelection`), « toutes » une famille. L'ancre se lit AVANT
  `setSelection` : la mise a jour d'etat s'execute apres.
- **Projets** (`components/atelier/ProjectBar.tsx`, API
  `routers/modelisation_projets.py` + `lib/modelisation_projets.py`) : creer
  (spec de depart + dossier de sorties), retirer de l'atelier (liste
  `$NEUTRONCORE_STATE/atelier_masques.json`, fichiers intacts, « remettre »), ou
  supprimer = DEPLACER spec, releve de prix, code du modele, son test et ses
  sorties dans `$NEUTRONCORE_STATE/atelier_corbeille/<nom>-<date>/`. L'API
  n'efface jamais rien : la corbeille se vide a la main. Jeton
  `modelisation_supprimer`, deux confirmations dans l'ecran. Ce routeur est
  inclus avant `modelisation` : son GET /modelisation remplace la liste brute.
- **Identites stables** : le releve periodique rend un objet neuf toutes les
  8 s ; `pieces` et les gestes ne sont recalcules que si leur contenu change,
  sinon l'animation repartirait de zero a chaque releve.

## Plans, noms en clair, branches par session (2026-10-12, suite)
Non commite (branche `feat/atelier-3d`).
- **Onglet « plans »** (`components/atelier/Plans.tsx`) : les planches PNG du
  pipeline (plans cotes, coupes, vues d'usage) chargees par l'API authentifiee,
  agrandissables et telechargeables ; la fiche de fabrication rendue en
  Markdown ; l'archive des fichiers a imprimer.
- **Materiaux en clair** : `nature` dans `specs/<modele>.prix.yaml` dit ce qu'est
  la piece (« batterie (cellule lithium-polymere) ») et devient le titre de la
  ligne ; la reference passe en dessous. Consigne de l'utilisateur : toujours
  dire ce qu'est une piece avant sa reference.
- **Une branche par session** : a la racine d'un projet suivi, POST
  /launcher/claude lance `claude --worktree <sAAMM-HHMMSS>` ; la session vit
  dans `<projet>/.claude/worktrees/<nom>` sur la branche `worktree-<nom>`
  (partie de la branche par defaut distante). La reponse donne `cwd` : le
  lanceur l'attend la (`Launch.expect`). `.claude/worktrees/` est ajoute a
  `.git/info/exclude` (local). Claude Code REFUSE `--worktree` dans un dossier
  jamais approuve : l'API lit `hasTrustDialogAccepted` et, sinon, lance une
  session normale avec une note. Dans un dossier de session il n'y a ni
  `node_modules` ni `.venv` : `npm ci` une fois ; et le build qui deploie reste
  celui du dossier principal, apres fusion.
- **Branches & PR** (ecran projets, `components/Branches.tsx`, `lib/branches.ts`
  teste ; API `routers/git_branches.py` + `lib/git_branches.py`) : par depot
  suivi, branches sans PR, en PR, deja contenues dans une PR, deja fusionnees,
  conflits (`git merge-tree`, calcul en memoire : rien n'est ecrit), PR ouvertes
  (`gh pr list`). Lecture seule. Depots suivis et reglage dans
  `$NEUTRONCORE_STATE/branches.json` (chemins relatifs a `DEV_ROOT`). Rappel :
  chaque lundi a partir de 9 h, un resume dans le centre de notifications.

## Atelier 3d : essai de bout en bout sur un projet neuf (2026-10-12, soir)
Non commite. Essai reel : projet `boite_rangement_lego` cree depuis l'API, premiere
iteration lancee, puis tout l'ecran verifie sur ses sorties. Ce que l'essai a appris :
- **Plusieurs sessions** : `GET /modelisation/sessions` dit sur quel modele travaille
  chaque session de boucle (lu dans son premier message, `/boucle-3d <modele>`) et liste
  les sessions terminees a reprendre. `components/atelier/useBoucles.ts` le lit une fois
  pour l'ecran ; la bulle liste toutes les sessions, marque celles du projet affiche, et
  revient a la session du projet quand on en change (logique pure : `lib/atelierSessions.ts`).
- **Bandeau d'avancement** (`components/atelier/LoopStatus.tsx`) : visible des le lancement,
  une mascotte par etape, temps ecoule, derniere phrase de l'agent ; « n'a pas demarre »
  si aucune session n'apparait en 90 s.
- **Commande de boucle** : lancee avec la demande en message initial, le parametre
  positionnel de la commande prenait le premier mot de la demande pour le nom du modele.
  La commande lit maintenant le premier mot des arguments.
- **Messages de l'utilisateur** : `lib/sessions.userText` retire l'emballage des commandes
  (`<command-name>`, `<command-args>`) et les rappels systeme avant affichage.
- **Axe vertical** : un modele peut etre dessine Z vers le haut (pose sur le plateau).
  Reglage « vertical » par projet (`neutroncore_atelier_haut`), defaut pris dans
  `resume.json` (`haut`). La rotation est faite dans la geometrie au chargement : tout le
  reste (centres, boites, coupe, camera, films) parle un seul repere.
- **Eclate** : un ecart commun (un cinquieme de la plus grande dimension) s'ajoute au
  decalage proportionnel, sinon un bac et son couvercle ne se separent presque pas.
- **Montage** : une etape structuree qui renomme une piece deja posee la « reprend »
  (`reprises`) : elle est rejouee et citee, sans etre posee deux fois.
- **Materiaux** : `consommable: true` dans la nomenclature (filament, ruban) est affiche
  comme tel ; une designation identique au nom de recherche n'est plus ecrite deux fois.
- Pendant que le pipeline reecrit ses sorties, des fichiers manquent quelques secondes
  (404) : la vue se recharge seule au releve suivant ; un tournage lance a ce moment
  s'interrompt avec un message.
- Fin de boucle sur « arbitrage humain » (iteration 2, 155/161) : le bandeau passe a
  « attend ta reponse », la bulle s'ouvre seule. Repondre repasse a « au travail » en
  quelques secondes. `lireControle` cherche la famille aussi APRES le nom de la piece
  (`couvercle:jeu:pire_cas`) ; familles `regle` et `empilement` ajoutees. La phrase citee
  dans le bandeau est debarrassee de sa mise en forme Markdown.
- Fin de l'essai (verdict « escalader », 189/194) et relectures independantes :
  - une session se rattache a son modele par le DEBUT de son transcript
    (`claude_sessions.first_messages`) ; lire les derniers messages la perdait apres un
    redemarrage de l'API, et aucune session terminee n'etait proposee a la reprise ;
  - le registre de Claude Code ecrit `busy`, `idle` ou `shell` (il ne reste qu'une commande
    de fond) : seul `busy` veut dire « au travail ». Le bandeau a un etat « en pause », qui
    sert aussi quand l'API a redemarre et oublie qu'une session attendait ;
  - apres un lancement, la session d'une iteration precedente n'est pas prise pour la
    nouvelle (`sessionDuProjet`) ;
  - `userText` retire la balise de collage d'une longue reponse et masque le resume
    automatique de contexte ;
  - branches : nom de branche commencant par « - » ignore, git lance sans `core.fsmonitor`
    ni hooks du depot, « frais » au plus une fois toutes les 30 s.
  - Laisses tels quels (choix) : PUT /branches/reglages sans jeton X-Confirm, comme les
    autres reglages ; `cwd` absolu dans deux reponses (le lanceur s'en sert pour reconnaitre
    la session) ; une piece illisible au chargement de la vue n'est pas signalee.

## Atelier range, chat des sessions, atelier sur l'accueil (2026-10-13)
Non commite (branche `feat/atelier-3d`).
- **Outils de la vue 3D en sections repliables** (`components/atelier/ViewerTools.tsx`) :
  vue, eclate et coupe, selection et mesure, image et videos. Chaque en-tete dit l'etat
  du reglage ; les sections ouvertes sont retenues (`neutroncore_atelier_outils`). Les
  boutons d'export ne sont plus dans l'en-tete de l'ecran. Le bandeau d'avancement se
  replie aussi (`neutroncore_atelier_avance_plie`).
- **Lanceur et atelier distincts** : `GET /launcher/sessions` et `/recent` portent
  `atelier` (le modele sur lequel la session boucle, `""` sinon). Le lanceur, les
  sessions de l'accueil et le badge de navigation les ecartent (`horsAtelier`) ; le
  compteur `waiting` ne les compte pas. Une boucle tout juste lancee, sans transcript,
  peut apparaitre quelques secondes dans le lanceur.
- **Chat des sessions** (`SessionChat.tsx`, logique dans `lib/sessions.ts`) : les
  commandes d'un tour sont un bloc « execution » en tete de la reponse, replie en une
  ligne de resume, deplie d'office pendant le tour ; la plus recente est en haut. La
  ligne « claude » donne le temps de reflexion et la duree du tour. Les touches du
  terminal sont derriere un bouton « touches ».
  Cote API, `claude_sessions.parse_lines` ajoute `think_s` (ecart entre un bloc de
  reflexion et la ligne d'avant : le texte de la reflexion n'est pas dans le
  transcript), `from` (arrivee de la demande) et `tools_at`. La duree `turn_duration`
  ecrite par Claude Code n'est PAS reprise : elle couvre les commandes de fond et a
  donne 3 h pour un tour de 23 s.
- **Atelier sur l'accueil et en mode tele** (`components/HomeAtelier.tsx`, logique
  `bouclesEnCours` testee) : une ligne par projet qui a une boucle ouverte (etat,
  iteration, etape, mascotte de l'etape). `GET /modelisation/sessions` rend `courants`
  pour eviter de lire chaque modele. Reglage `homeAtelier` ; source tele `atelier`.
  Toucher une ligne ouvre l'atelier sur ce projet (`PROJET_ATELIER` en sessionStorage).
- **Questions illustrees** (`components/atelier/Questions.tsx`, logique `lireAttente`,
  `piecesCitees`, `piecesDuPoint` dans `lib/atelier.ts`) : un point de l'attente est une
  phrase, ou `{texte, pieces, image, recommande, options: [{nom, texte, image}]}` ecrit
  par la boucle (`instantane.py --points-json`, images png ou gif dans
  `sorties/<modele>/questions/`, validees a l'ecriture). L'ecran montre le mini-plan de
  la boucle ; a defaut, une vue 3D des pieces concernees (les autres en fantome),
  celles que le point designe ou, sinon, celles que son texte nomme (approximatif :
  « fiche fabricant » designe a tort la piece « fiche »). L'API sert les `.gif`.
- **Cartes du lanceur stables** (`lib/smoothOrder.ts`, `ordreStable` teste) : le serveur
  trie par activite, ce qui deplacait les cartes et la page a chaque message. L'ecran
  garde son propre ordre : seules remontent une session qui se met a attendre et une
  session nouvelle ; « attend » vers « en pause » ne deplace rien. La carte lue garde
  sa place a l'ecran (le defilement compense), les cartes deplacees glissent.
  `overflow-anchor:none` sur `.cs-list` : l'ancrage natif du navigateur se battait
  avec cette compensation et ramenait la page en haut.
- Suite du meme jour : la vignette 3D d'une question montre les pieces seules, sous
  l'angle isometrique d'ou elles se voient (`camIso`, teste : la camera se place du cote
  de l'objet ou elles sont) ; « avec le contexte » ajoute le reste en fantome. Un point
  peut porter `detail` (plan cote, ouvert a la demande) en plus de `image` (vue simple).
  Cartes du lanceur : elles gardent leur place dans la page et c'est la propriete CSS
  `order` qui les range — deplacer un element remet a zero le defilement de sa
  conversation. Vue 3D : si son code est introuvable (page ouverte avant un build),
  le message le dit et propose « recharger ».
- Images des questions : vignettes petites dans la carte (rendues en 1200 x 800 pour le zoom) ; ouvertes dans une fenetre moyenne (« agrandir » = plein ecran) par
  `components/ImageZoom.tsx` (molette, pincement, boutons, touches + - 0 ; glisser pour
  se deplacer ; double clic ; logique pure `lib/zoom.ts` testee). Pour une vue 3D, la
  barre de la fenetre porte « vue fantome » (reste de l objet en transparence, pieces en question mises en avant), proposee pour TOUTE image d une question qui nomme des pieces, celles de la boucle comprises ; le zoom est garde quand
  on le bascule.
- Fenetre d'une image de question (`ImageZoom` + `components/atelier/Mini3D.tsx`) : a
  cote de l'image, le texte de la question (et de l'option) tant qu'on n'est pas en
  plein ecran ; bascule « image / 3d » : la vue 3D est une vraie scene qu'on fait
  tourner (deuxieme `AtelierScene`, pieces rechargees a l'ouverture) ; « mode fantome »
  y met le reste de l'objet en transparence et les pieces en question en avant.
  `piecesEnAvant` (teste) : si la boucle designe aussi le corps qui porte les autres
  pieces, il passe en decor, sinon il les cacherait. La camera se place du cote de ces
  pieces (`camIso`, `AtelierScene.orbit(cam, cible)`).

## Automatisations : blocs du 2026-10-13
Non commite. Cote API : `lib/automations.py`, `routers/automations.py`,
`lib/test_suites.py`, `lib/test_runner.py`.
- **Declencheur `atelier`** (une boucle de l'atelier 3d attend / rend un verdict, filtre
  sur le nom du projet) : sonde `_poll_atelier`, comparaison pure `atelier_changes` ; le
  premier releve ne declenche rien.
- **Declencheur `session_stuck`** (une session au travail ne bouge plus depuis N min) :
  registre a `busy`, pas en attente, et ni le transcript ni l'etat du registre n'ont
  bouge. Une alerte par arret (`stuck_sessions`). Une commande longue et silencieuse
  (tests de 30 min) y ressemble : regler le seuil au-dessus.
- **Condition `presence`** (je suis la / absent) : la = au moins un ecran du PC allume
  (DPMS, lu par le script de HALO) ; etat illisible = inconnu, aucune branche.
- **`service.start` avec `trigger`** : relance le service que le declencheur vient de
  voir tomber (lu en tete du titre de l'evenement, verifie contre `SERVICES`).
- **Action `tests.run`** : batterie d'un projet, liste FERMEE `test_suites.SUITES` (la
  commande que le projet declare : cible make, script npm, commande de sa CI). Lancee en
  tache de fond, une a la fois par batterie, 50 min au plus ; fin = notification +
  evenement externe `tests_ok` / `tests_echec` pour enchainer. Exclus : ce qui deploie
  (`npm run build`) et la campagne Lyra (GPU). Les libelles sont recopies dans
  `SUITES` de `src/lib/automations.ts` : ajouter une batterie = les deux fichiers.
- Le filtre « contient » du declencheur session FONCTIONNE (applique en tete de
  `matches`, teste) : je l'avais cru absent en ne lisant que la branche `session`.
- **Afficher neutroncore sur la tele, puis remettre** (actions `tv.show` / `tv.restore`,
  routes POST /tv/afficher, /tv/remettre, GET /tv/affichage ; `routers/tv_display.py`,
  logique pure `lib/tv_display.py` testee). La tele est aussi un ecran du PC (moniteur
  dont la description contient `TV_MONITOR_MATCH`, defaut « Philips »). Afficher :
  memorise l'etat (allumee ou non, application en cours) dans
  `$NEUTRONCORE_STATE/tv_avant.json`, allume la tele, la passe sur l'entree HDMI du PC
  (parametre de l'action), ouvre l'app en plein ecran sur cet ecran (`?tele=1` : mode
  tele pour cette fenetre seulement, sans toucher au reglage ni jouer l'intro). Un second
  affichage n'ecrase pas le souvenir. Remettre : ferme la fenetre, relance l'application
  memorisee ; rien en memoire ou autre chose qu'une application = menu d'accueil ; tele
  eteinte avant = reeteinte ; elle etait deja sur une entree = on n'y touche pas (on ne
  sait pas lire laquelle).
  Cote pylips-mcp (non commite) : outils `current_app` et `set_source` (hdmi1 a hdmi4,
  home), appeles par le demon sous `tv.current_app` / `tv.set_source`. Ici : PC sur
  HDMI 1, ampli (ARC) sur HDMI 2, lu par `dumpsys hdmi_control`.
- « demarrer un service : celui qui vient de tomber » lancee A LA MAIN (aucun
  declencheur) relance ce qui est arrete a cet instant ; rien d'arrete = reussi. Un
  service non demarrable d'ici (`services_checker.demarrable` : pas d'unite utilisateur,
  ou service du systeme) est signale dans le centre de notifications sans faire echouer.
  Lyra, surveille par son processus, demarre par son unite `lyra-daemon`. Tracking est
  un service du SYSTEME : l'API ne peut pas le demarrer. n8n n'a ni unite ni conteneur
  sur cette machine (constate le 2026-10-13).

## Camera avec detourage (2026-10-13) — reprise d'obs-virtual-bg, sans OBS
Non commite. Pas encore essayee avec la vraie webcam.
- **Moteur** : `camera/moteur.py` dans lyra-control-api, lance par l'API avec le Python
  qui porte torch et OpenCV (`CAMERA_PYTHON`, par defaut l'environnement d'obs-virtual-bg).
  Webcam (`CAMERA_SOURCE`) -> detourage sur la carte graphique -> camera virtuelle
  v4l2loopback (`CAMERA_SORTIE`, `/dev/video10`, vue par les applications sous le nom
  « OBS Virtual Camera » tant que le module n'est pas recharge avec un autre libelle).
  Il relit `$NEUTRONCORE_STATE/camera.json` deux fois par seconde, publie apercu et etat
  dans `$XDG_RUNTIME_DIR/neutroncore-camera/`, s'arrete sur SIGTERM (jamais de pkill :
  l'API verifie que le pid est bien le moteur). Essai sans webcam : `--source mire
  --sortie aucune --images 90`.
- **Modeles** : `rvm` (Robust Video Matting, fait pour la visio, charge par torch.hub au
  premier lancement, licence GPL-3 : charge a l'execution, pas livre dans le depot) ;
  `deeplab` en repli ; `auto` essaie le premier. Sans fond de remplacement ou en veille,
  aucun modele ne tourne.
- **Reglages** (`lib/camera.py`, pur, teste, lu par l'API ET le moteur) : fond `aucun`,
  `flou` (intensite), `prefait` (degrades dessines par le moteur et par l'ecran) ou
  `fichier` (image ou video importee dans `$NEUTRONCORE_STATE/camera_fonds/`) ; detourage
  `durete`, `marge`, `stabilite`, traduits en grandeurs par `parametres()` ; `veille`.
  Le flou ignore la personne (sinon ses couleurs bavent en halo).
- **API** `routers/camera.py` : GET /camera, POST /camera/demarrer|arreter, PUT
  /camera/reglages (fusion), GET /camera/apercu (JPEG, 204 sans image), POST /camera/fonds
  (formulaire), DELETE /camera/fonds/{nom} (jeton `camera_fond_supprimer`).
- **Ecran** `screens/Camera.tsx` (groupe maison), logique `lib/camera.ts` testee.
  Automatisations : `camera.power`, `camera.standby`, `camera.background`.
- Reste de l'ancien : routes `/media/obs/start|stop` de l'API (lancent l'ancien pipeline,
  avec `pkill`) et le dossier `obs-virtual-bg` (mot de passe OBS en clair dans
  `scripts/obs_control.py`) : a retirer une fois la nouvelle camera validee.
- Camera, apres le premier essai reel (2026-10-13) : l'image saccadait parce que la
  webcam (Elgato Facecam) ne donne que 20 images/s en mode 30, et 60 en mode 60 (mesure
  dans tous les formats). Capture en mode 60 (`CAMERA_FPS_CAPTURE`), sortie a 30 : le
  moteur attend une image NEUVE au lieu de retraiter la derniere (l'ancien compteur
  affichait 29,9 en repetant des images). `etat.json` donne `fps_webcam` et `ms_tour`.
  Apercu : demandes enchainees (une quinzaine d'images/s en local) au lieu d'une toutes
  les 250 ms. Boutons : anneau d'attente (`.tourne`) sur allumer/eteindre jusqu'a l'etat
  reel, sur le fond et la veille le temps que le moteur relise ses reglages.
- Camera, deuxieme passe du meme jour : pyfakewebcam convertissait chaque image ligne par
  ligne en Python (boucle sur 720 lignes) ; `SortieVirtuelle` fait la conversion YUYV sur
  la carte graphique et ecrit d'un bloc (cout d'un tour : 13 ms -> 8 ms, 60 images/s
  tenables avec detourage, ecart maximal entre deux images publie dans `ecart_max_ms`).
  Reglages `virtuelle` (publier ou non comme camera de l'ordinateur, a chaud) et
  `cadence` (30 ou 60). Apercu : GET /camera/flux (MJPEG, 30 images/s), lisible par une
  balise image grace a un jeton court `camera_flux` passe dans l'adresse (le filtre
  d'adresses s'applique aussi). Le nom « OBS Virtual Camera » vient de
  `/etc/modprobe.d` : le changer demande les droits administrateur.
- Camera, troisieme passe : la camera virtuelle etait BLOQUEE pour les applications
  (« Device or resource busy ») : pyfakewebcam laisse son descripteur ouvert quand son
  reglage de format echoue, et le moteur reessayait a chaque image ; dix descripteurs
  ouverts atteignent `max_openers` de v4l2loopback. `SortieVirtuelle` ouvre et regle le
  peripherique elle-meme, referme TOUJOURS en cas d'echec, ne reessaie que toutes les 2 s,
  et annonce la cadence (VIDIOC_S_PARM). Verifie avec ffmpeg : 60 images distinctes/s.
  Diagnostic : compter les descripteurs du moteur sur le peripherique dans /proc/<pid>/fd.
- L'apercu n'est fabrique que si un ecran le regarde : le flux tient a jour le fichier
  `spectateur` du dossier d'execution, le moteur le consulte deux fois par seconde.

## Plan de piece : ruban reglable comme les lampes (2026-10-13)
Non commite.
- Le ruban Hue (gradient lightstrip) a 7 segments pilotables, de tailles inegales (1, 1, 3,
  3, 3, 1, 1 pixels sur 13) : GET /plan/ruban-hue le lit sur le pont (API v2, ressource
  `entertainment` ; `lib/hue_strip.py` pur, teste). Le plan de HALO n'en avait que 3.
- PUT /plan accepte maintenant, par segment : position, angle, LONGUEUR et HAUTEUR (`z`,
  metres dans le fichier, cm cote app ; `None` = jamais reglee), et un NOMBRE different
  (1 a 40). Meme nombre : chaque segment reste a sa place dans le fichier et garde ses
  cles inconnues ; nombre different : la liste est reconstruite. `segments` et `length_m`
  suivent. HALO conserve la cle `z` (il fusionne par Object.assign) mais dessine encore
  le ruban a 1,80 m dans sa propre vue 3D.
- Ecran : `lib/plan.ts` (`segHeight`, `setSegHeight`, `setSegLength`, `addSeg`,
  `removeSeg`, `resampleStrip`, testes). `resampleStrip` redecoupe en gardant le trace.
  Vue 3d : glisser un segment regle sa hauteur (tout le ruban si la case est cochee).
- Applique le 2026-10-13 sur le plan reel : 7 segments ; copie d'avant dans
  `~/.config/halo_plan.json.avant-ruban-7`.

## Lumiere 3d (2026-10-13) — effets dans l'espace, pad, sets, vraies lampes par huebeat
Non commite. Ecran dedie `lumiere` (groupe maison) ; le plan de piece y renvoie par un bouton.
- **Moteur pur** `lib/spatialFx.ts` (teste) : un effet est une forme dans la piece ; chaque
  appareil prend ce qui passe a sa position. `apport` puis `evaluer` (effets superposes).
  Effets : onde de choc, mur de lumiere (3 sens), source mobile, maree, phare. Le temps est en
  PULSATIONS (float). Repere : cm, x/y centres, z depuis le sol.
- **Le meme calcul en Python** dans huebeat : `~/dev/ironman-hue/spatial_fx.py` (memes cas de
  test). Changer un effet = les DEUX fichiers, sinon le banc d'essai ment.
- **Lieux** `lib/spatialVenues.ts` : `pieceReelle(plan)` (vraies lampes), et deux scenes
  simulees FIXES (`salonEquipe`, `club`). Rendu `lib/spatialScene.ts` (three.js, sans decision).
- **Vraies lampes** : c'est huebeat qui les pilote (flux temps reel vers le pont, detection
  des temps). L'API ecrit `/tmp/lyra_hue_beat.spatial.json` (scene + position de chaque canal
  dans la piece) ; huebeat le relit 5 fois par seconde et, tant qu'il est actif, remplace ses
  layouts band/full par l'effet spatial. `{"actif": false}` lui rend la main.
  Position des canaux : `lib/spatial.positions_canaux` (zone Entertainment la plus fournie du
  pont, API v2) ; une lampe prend sa place du plan par son nom (`associer` : noms identiques
  d'abord), un canal du ruban le milieu de ses segments. Ici : 7 canaux, zone « Coin tele ».
- **Horloge** : `positionDansLeTemps` (TS) = `position_dans_le_temps` (Python). Chaque temps
  detecte repart d'un entier ; sans musique, l'effet tourne librement a 120. L'etat de huebeat
  donne `beat_count`, `beat_ts`, `bpm` ; l'ecran mesure le decalage d'horloge avec l'API.
- **Pad et sets** : `$NEUTRONCORE_STATE/spatial.json`, `lib/spatial.py` (valide, teste),
  `routers/spatial.py` (GET /spatial, PUT /spatial/scenes|sets/{id|new}, DELETE avec jeton
  `spatial_supprimer`, POST /spatial/reel). Scene : source en POURCENTAGE de la piece. Set :
  etapes `{scene, mesures}`. Scenes de depart a identifiants FIXES (`depart01`...).
  C'est l'ECRAN qui fait avancer un set (`etapeDuSet`) : ecran ferme, le set s'arrete sur sa
  scene. Enregistrer un set = `frappesEnSet` (frappes du pad arrondies a la mesure).
- **Trois pannes de huebeat trouvees en route** (aucune liee a ce volet) : hue-mcp le lancait
  avec son propre Python, sans numpy (-> `HUE_BEAT_PYTHON`, non commite dans hue-mcp) ;
  hue-mcp n'avait pas PyYAML, donc ne lisait pas `secrets.yaml` (-> dependance ajoutee) ;
  dans la config locale de Lyra, adresse du pont perimee et `beat_username` qui n'etait pas
  l'identifiant appaire avec `clientkey` (DTLS refuse : « bad record mac »).
- PIEGE : ne jamais retirer `/tmp/ironman_hue.pid` a la main. Je l'ai fait pendant le
  diagnostic : hue-mcp a cru huebeat arrete et en a lance un second ; deux instances sur la
  meme zone se marchent dessus, et arreter l'une coupe le flux de l'autre.
- Ajouts du soir : effet `raz` (raz de maree : le front s'eloigne du point source en plan,
  et derriere lui la lumiere remplit la hauteur depuis `depart` = bas, centre — la hauteur
  du point, vers le haut et le bas — ou haut ; une vague par mesure). Palette `arcenciel` :
  la couleur ne vient plus de l'effet mais de l'endroit (`arcEnCiel` : teinte selon la
  distance au point source, qui defile) ; huebeat recoit le drapeau `arc_en_ciel`. Le point
  source se pose aussi au double-clic sur le sol de la scene (`SpatialScene.onPlace`).
  Les trois existent en TS, en Python (huebeat) et dans la validation de l'API.
- Lumiere 3d, reglages communs et boule a la main : `commun` dans `spatial.json` (PUT
  /spatial/commun) = intensite generale, sensibilite, et forme de la pulsation (attaque,
  retombee, profondeur, plancher), appliques a TOUTES les scenes par `gainPulsation` /
  `gain_pulsation` (TS et Python, memes tests). Profondeur 0 par defaut : rien ne change
  tant qu'on n'y touche pas. La sensibilite regle la detection des temps de huebeat
  (curseur 0-100 -> multiplicateur 3,0-0,5 ; 68 = son reglage d'origine) et ne sert donc
  que sur les vraies lampes. Changer un reglage commun rejoue la scene en cours sur les lampes.
  Le point source se glisse a la souris dans la scene (boule : a sa hauteur ; fleche
  au-dessus : hauteur ; double clic : pose au sol) et se saisit en centimetres (mur gauche,
  mur de la tv, hauteur), stocke au dixieme de pour-cent de la piece. Les erreurs de console
  vues en test viennent d'evenements de pointeur fabriques (OrbitControls), pas d'un vrai usage.

## Lumiere 3d : lancement en un geste, peripherique du tempo (2026-10-13, nuit)
Non commite.
- **Grand bouton** `.lu-direct` (ecran lumiere) : POST /spatial/direct {scene} lance huebeat s'il ne
  tourne pas puis joue la scene en cours ; POST /spatial/arret arrete tout. L'ancien bouton
  « piloter les vraies lampes » restait grise tant que huebeat n'etait pas lance a part : c'est ce
  qui donnait l'impression qu'il ne marchait pas. L'ecran rouvert pendant que les lampes jouent
  reprend l'etat « en direct » (`reel` + `huebeat.actif`).
- **Peripherique du tempo** : GET /spatial renvoie `peripheriques` (sorties d'abord, puis micros ;
  `actif` = du son en ce moment) et `peripherique` ('' = reglage d'origine de huebeat). PUT
  /spatial/peripherique {nom} ecrit le choix (lu par `hue_beat.py` au demarrage) et relance huebeat
  s'il tourne. Un nom sans marque lisible est affiche « carte son interne ».
- **Scene « neutron »** : palette `neutron` (bleu reacteur, rouge armure, blanc), onde + phare, source
  a la position de la tele. Meme palette en Python et en TS.

## Lumiere 3d : silence, legendes animees, pad personnalisable (2026-10-14)
Non commite.
- **Rien ne joue = rien ne s'allume** : huebeat faisait tourner l'effet en roue libre a 120 sans son.
  `spatial_fx.gain_silence` (teste) : plein tant qu'il y a du son, fondu vers 0 apres 1,2 s de silence
  sur le peripherique ecoute, rallumage au premier son. L'etat de huebeat publie `silence`, relaye par
  GET /spatial ; l'ecran eteint alors aussi le banc d'essai et le dit. Ne vaut que pour les effets dans
  l'espace, pas pour les layouts habituels de huebeat.
- **Legende + apercu anime** de chaque reglage commun : `lib/spatialApercu.ts` (pur, teste : balayage
  mini -> maxi, lampe temoin calculee par le vrai `gainPulsation`, textes `LEGENDES`, bornes `BORNES`)
  et `components/lumiere/ApercuReglage.tsx` (bulle au survol ou au focus de « voir l'effet » ; la toile
  ne tourne que bulle ouverte). Ajouter un reglage commun = une entree dans `BORNES` et `LEGENDES`.
- **Pad** : « renommer » (nom du champ), fleches pour deplacer la touche (PUT /spatial/scenes/ordre
  {ordre}, `sp.ranger` : memes scenes exactement), palette `libre` = 1 a 6 couleurs `#rrggbb` portees
  par la scene (`couleurs`, `couleursDe` / `couleurs_de`). huebeat recevait deja des couleurs, pas un nom.
- Test fragile vu au passage (lyra-control-api) : `test_plafond_par_jour_applique` echoue dans les dix
  minutes apres minuit (son historique « il y a 10 min » tombe la veille). Non corrige.

## Lumiere 3d : mode 2d, blocs repliables, reglages communs fiables (2026-10-14, suite)
Non commite.
- **2d ou 3d** (champ `mode` d'une scene, `3d` par defaut) : en 3d la lumiere voyage depuis le point
  source, donc une lampe eloignee s'allume APRES le temps — c'est ce qui donnait l'impression d'un
  tempo decale par rapport au huebeat d'origine. En 2d (`evaluer2d` / `evaluer_2d`, memes tests) il
  n'y a pas de trajet : sur chaque temps les lampes s'allument d'un coup puis retombent selon la
  pulsation (attaque, retombee, plancher ; la « force » ne sert pas en 2d). `groupe` = `tous` ou
  `alterne` (une lampe sur deux, l'autre moitie au temps suivant : la scene Iron Man). Les voisins
  sont definis par `rangs` (appareils ranges de gauche a droite), calcule par huebeat a la lecture
  de la config et par `SceneView` pour le banc d'essai. La scene de depart « neutron » est en 2d alterne.
- **Reglages communs qui n'arrivaient plus aux lampes** : PUT /spatial/commun rejouait un souvenir en
  memoire (`_derniere`), perdu a chaque redemarrage de l'API. Il repart maintenant du fichier que
  huebeat lit (`sp.avec_commun`, teste). Sous un curseur, une ligne rose dit quand il est sans effet
  (attaque, retombee, plancher tant que la force de la pulsation est a 0, en 3d).
- **Blocs repliables** (`components/lumiere/Bloc.tsx`) : pad, sets, musique, pulsation, reglages de la
  scene ; etat retenu dans `neutroncore_lumiere_blocs`. Replies au depart : sets, musique, pulsation.
- huebeat ne relit pas son code a chaud : apres une modification de `spatial_fx.py`, il faut
  l'arreter et le relancer (grand bouton), sinon il joue l'ancienne version.

## Lumiere 3d : horloge au tempo, bloc « respiration » simplifie (2026-10-14, nuit)
Non commite.
- **Les lampes reagissaient a un temps sur trois** (mesure : 8 temps comptes en 18 s a 94 par minute).
  Deux causes. (1) `beat_count` de huebeat ne compte pas un temps plus faible que le fade en cours, et
  ce fade ne redescend jamais pendant que les effets dans l'espace jouent : compteur propre
  `spatial_count` (chaque detection, plus les temps qu'elle a manques : `temps_ecoules`). (2) Entre deux
  detections l'horloge attendait au bord du temps suivant : `position_dans_le_temps` continue maintenant
  au tempo mesure des qu'il est connu, et chaque detection la recale. Le banc d'essai faisait deja le
  metronome, d'ou l'ecart avec les lampes. Memes regles en TS ; GET /spatial rend `spatial_count` sous
  le nom `beat_count`.
- **Avance** : l'horloge des lampes est en avance de `HUE_BEAT_AVANCE_MS` (120 par defaut, 0 a 400) pour
  compenser capture, analyse, pont et ampoules. N'agit qu'une fois le tempo trouve.
- **2d sans gamma** : le niveau y est deja une enveloppe au carre ; le carre de plus retardait la montee.
- **Bloc « respiration et intensite »** : intensite, « la lumiere arrive », « la lumiere repart » ; en 3d
  s'ajoute la force de la respiration (toucher arrive ou repart quand elle est a 0 la met a 70, avec un
  message). Plancher et sensibilite sont dans « reglages fins ».

## Installation : elements facultatifs (verifie le 2026-10-14)
Non commite.
- Essai : l'API lancee dans un dossier vide (aucun projet, aucun reglage, aucun appareil) repond sur ses
  74 routes de lecture sans une seule erreur 500 ; les actions des elements absents echouent avec une
  phrase (« environnement Python de la camera introuvable », « pont Hue injoignable »...). Le tableau des
  elements facultatifs est dans le README.
- Deux retouches : au depart, « branches & PR » ne suit que les depots presents sous `DEV_ROOT`
  (`lire_reglages(etat, racine)`) ; GET /camera rend `installee` et l'ecran le dit.
- PIEGE : une copie de test de l'API n'est pas isolee de huebeat. `routers/spatial.py` lit et ecrit les
  fichiers communs `/tmp/lyra_hue_beat.*` : y appeler /spatial/arret ou /spatial/reel agit sur les vraies
  lampes. N'y faire que des lectures.
- Installeur de Lyra (`lyra/installer/core/catalog.yaml`) : chaque MCP est une case a cocher ; neutroncore
  et lyra-control-api n'y figurent pas (installation a la main, voir README).
- **Ce que huebeat entend** (2026-10-14) : `components/lumiere/Ecoute.tsx` sous la sensibilite, dans le bloc
  « musique ». huebeat publie six fois par seconde `/tmp/lyra_hue_beat.ecoute.json` (niveaux du son, seuil
  a depasser, temps pris, sur 3,6 s) tant qu'une scene de neutroncore joue ; GET /spatial/ecoute le valide
  (`sp.lire_ecoute`, teste) ; l'ecran le releve toutes les 180 ms (`echelleEcoute`, teste). Une barre rose
  passe le seuil mais est ecartee : huebeat ne prend pas deux temps a moins de 500 ms.
  Verifie sur des donnees simulees seulement, pas encore sur de la vraie musique.
- PIEGE corrige (2026-10-14) : `test_hue_beat_ctrl.py` (ironman-hue) effacait le VRAI fichier pid et le vrai
  fichier d'etat de huebeat pour simuler son absence. Lance pendant que huebeat tourne, hue-mcp le croyait
  arrete : plus moyen de l'arreter depuis l'app, et risque de seconde instance. Le test travaille maintenant
  sur des chemins a part. Si le fichier pid manque alors que le processus vit, le reecrire avec son pid.
- **Rien de pris = rien d'allume** (2026-10-14) : l'horloge au tempo comblait les temps manques sans limite,
  donc les lampes pulsaient encore avec la sensibilite a 0. `gain_sans_temps` (huebeat, teste) : quatre temps
  combles au plus, puis extinction en un temps ; jamais rien pris = eteint. Le drapeau `silence` de l'etat
  couvre maintenant les deux cas (aucun son, ou aucun temps pris).
- **Sensibilite automatique** (2026-10-14) : bouton « auto » a cote du curseur (`commun.auto`, PUT /spatial/commun).
  huebeat recalcule alors son multiplicateur quatre fois par seconde, d'un coup, d'apres ce qu'il vient
  d'entendre (`sensibilite_auto`, teste) : seuil a 40 % du chemin entre le niveau courant de la musique
  (mediane des sons audibles) et ses coups (ses 4 % les plus forts), donc independant du volume. Trop peu de
  son pour juger (silence, debut de piste) = reglage tres ouvert, pour prendre les premiers coups. Il le
  rejoint vite vers le bas, doucement vers le haut. Une premiere version par tatonnement (6 % par demi-seconde)
  mettait dix secondes a converger, oscillait et ratait les debuts : ne pas y revenir.
  Le releve d'ecoute porte `multiplicateur`, rendu par l'API en position de curseur (`sensibilite`) : le
  curseur, grise, montre ou le reglage s'est pose. Mesure sur de la musique : premier temps pris apres 2 s
  d'ecoute, curseur entre 68 et 74, 6 a 9 temps pris par fenetre de 3,6 s.
- **Horloge des effets refaite** (2026-10-14, nuit) : symptome « micro-eclairs, noir puis reprise ». Chaque coup
  detecte remettait la phase a zero ; avec l'horloge en avance de 120 ms, le flash etait deja parti et repartait.
  Desormais c'est l'horloge qui porte la lumiere (`avancer`), un coup la corrige sans la relancer (`recaler` :
  demi-correction s'il est sur la grille, ignore s'il est a contretemps, grille refaite au troisieme d'affilee).
  Son tempo est a part (`tempo_stable` : ecarts ramenes dans l'octave 80-160, mediane, un quart du chemin par
  coup) : `current_bpm` de huebeat sautait entre un tempo et son double. L'etat publie `spatial_pos`,
  `spatial_ts`, `spatial_bpm`, que GET /spatial rend sous `beat_count` (decimal), `beat_ts`, `bpm`.
  Mesure : 1 correction de plus d'un huitieme de temps sur 26 coups, contre une remise a zero a chaque coup.
- **Moins de clignotement quand peu de temps sont pris** : l'horloge comble 8 temps (au lieu de 4), l'extinction
  prend deux temps, et la lumiere revient en fondu d'une demi-seconde (`_presence` dans huebeat).
- `temps_ecoules` et `position_dans_le_temps` restent dans `spatial_fx.py` mais huebeat ne s'en sert plus.
- **Duree de vie d'une pulsation** (2026-10-14) : reglage commun `vie` (curseur 0-100 -> 1, 2, 4 ou 8 temps,
  `tempsDeVie` / `temps_de_vie`). Avant, une pulsation tenait dans UN temps (environ 0,55 s a 108 par minute) :
  meme « arrive » et « repart » au maximum ne donnaient que des flashs. `phaseDeVie` / `phase_de_vie` rendent le
  numero de la pulsation et sa phase ; arrive et repart se partagent cette duree. En 2d, le groupe allume (alterne)
  et la couleur changent a chaque pulsation, plus a chaque temps ; le stroboscope reste sur le temps. Un ancien
  fichier sans `vie` vaut un temps (comportement d'avant).
- **Aperçu et pause** (2026-10-14) : barre `.lu-transport` au-dessus de la pièce 3d. Hors direct, « aperçu de
  l'animation » joue la scène depuis le début au tempo réglé ici (l'aperçu est à l'arrêt au départ ; lancer un set
  ou un enregistrement le démarre). « pause » fige l'aperçu ; en direct elle fige AUSSI les lampes : POST
  /spatial/pause {pause} écrit `pause` dans le fichier lu par huebeat (`sp.avec_pause`), qui garde la position de
  l'horloge du moment (`_pause_beat`). L'horloge continue de suivre la musique : à la reprise, les lampes retombent
  sur le temps. Une retouche pendant la pause reste figée (`sp.garder_pause`) ; un nouveau lancement (/direct) non.
  GET /spatial rend `reel.pause`.
- **Pièce 3d et lampes mieux reliées** : l'aperçu en direct calcule l'heure exactement comme huebeat. Deux écarts
  corrigés : l'avance des lampes (`spatial_avance`, rendue `huebeat.avance`) n'était pas ajoutée, et sans tempo
  l'écran repartait en roue libre à 120 alors que huebeat attend le coup suivant (`positionDansLeTemps` = `avancer`).
  Restent non montrés dans l'aperçu : le fondu de retour de huebeat (`_presence`) et ses corrections entre deux
  relevés de l'API (toutes les 1,5 s).
- **Reglages propres a chaque effet** (2026-10-14) : une scene peut porter `reglages: {<effet>: {palette, couleurs,
  intensite, source, axe, depart, respiration: {attaque, retombee, profondeur, plancher, vie}, tempo}}` ; ce qui manque
  suit la scene (couleurs, intensite, point source) ou les reglages communs (respiration). `tempo` multiplie celui de
  la musique pour cet effet (`TEMPOS` : 0,25 0,5 1 2). Valide par `sp.valider_scene` (`_valider_surcharge`), envoye a
  huebeat en `couches` (`_couche_huebeat`, cm et 0..1). La respiration y reste PARTIELLE : huebeat la complete avec
  les reglages communs du moment (`couche_de`), sinon changer un reglage commun en jouant laisserait l'effet sur
  l'ancienne base. Calcul (`evaluer` TS et Python, memes tests) : la lumiere = somme des apports plafonnee x moyenne
  des forces (intensite x respiration) ponderee par les apports ; sans reglage propre on retrouve EXACTEMENT
  l'ancien calcul. Ecran : `components/lumiere/ReglagesEffet.tsx`, un panneau par effet actif dans « reglages de la
  scene » (3d seulement : en 2d il n'y a pas d'effets). Point source propose pour onde, source mobile, raz, phare.

## Preparation du push (2026-10-15)
- Demo : la lumiere 3d a son propre fichier de donnees `src/mock/data/lumiere.ts`, qui RETIENT les
  modifications du pad, des sets et des reglages communs (en memoire, jusqu'au rechargement). Le pad de
  depart recopie `lib/spatial.scenes_de_depart` de l'API (memes identifiants), plus un exemple de reglages
  propres a chaque effet sur « vague de fond ». Changer le pad de depart = les deux fichiers.
- Tutoriel : page « les sections » (les quatre groupes du menu et les nouveaux ecrans), entre l'accueil et
  le mode tele. Le texte de bureau doit tenir dans 900 px de haut : verifie a 1400x900 et 390x844.
- README : tableau des ecrans et elements facultatifs ranges par groupe du menu.

## Mix de scenes : 2d et 3d ensemble, par priorite (2026-10-20)
Non commite. Ecran lumiere, bloc avance « mixer des scenes » (`components/lumiere/MixEditeur.tsx`) ; une touche « mix » au pad.
- **Modele** : un mix = une liste ORDONNEE de couches `{scene: <id du pad>, canaux?: ["3","4"]}` (1 a 6). La premiere est la
  plus prioritaire. `canaux` absent = toutes les lampes ; sinon la couche ne joue que sur ces canaux de huebeat (le
  ruban a plusieurs canaux, regroupes par lampe dans l'editeur : `groupesDeLampes`). Stocke dans `spatial.json` (`mixes`),
  revalide a chaque lecture : une scene retiree du pad emporte sa couche, un mix sans couche disparait (`nettoyer_mixes`).
- **Regle de calcul** : la lumiere EMISE de chaque couche (gamma applique avant : 3d au carre, 2d lineaire) se superpose du
  bas vers le haut ; la couche du dessus MASQUE les dessous la ou elle eclaire (couverture = son canal le plus fort), les laisse
  voir la ou elle est faible ou eteinte. Jamais au-dela de 1. Une couche ne compte que pour les canaux qu'elle vise ; un canal que
  personne ne vise reste eteint. Scene seule : resultat identique a avant (le gamma est le meme, applique dans `sortie_lampe`).
  L'alternance 2d (`groupe: alterne`) se compte DANS le groupe vise (rangs recalcules sur les canaux de la couche).
- **Deux implementations, memes cas de test** : `spatial_fx.py` de huebeat (`sortie_lampe`, `superposer`, `sortie_mix`, test
  `test_spatial_mix.py`) et `src/lib/spatialMix.ts` (`sortieMix`, `superposer`, `spatialMix.test.ts`). Changer la regle = les DEUX.
  Preview : un appareil du banc d'essai se rattache au canal le plus proche dans le plan (`canalLePlusProche`, hauteur ignoree) ;
  le ciblage n'a de sens que dans « ma piece » (autres lieux : la couche joue partout). L'apercu superpose SANS le gamma des
  lampes (`lumiereMontree`) : une couche seule se voit exactement comme la meme scene seule (pas de saut de luminosite), mais dans
  un mix 2d + 3d la 3d parait un peu plus forte qu'en vrai (limite listee dans `LIMITES_APERCU`).
- **API** : `PUT /spatial/mixes/{id|new}` (couches = ids de scenes), `DELETE /spatial/mixes/{id}` (meme jeton que scenes et sets),
  `POST /spatial/reel` et `/spatial/direct` acceptent `{mix: {nom, couches: [{scene: <scene entiere>, canaux?}]}}` au lieu de
  `{scene}` (on joue aussi ce qui n'est pas enregistre). `lib/spatial.config_huebeat_mix` ecrit pour huebeat la config de la
  couche du dessus (reglages communs, `canaux` reduit a ceux qu'elle vise) + `mix: [config de chaque couche]` ; une couche dont
  aucune lampe n'est au plan est ecartee, s'il n'en reste qu'une c'est une scene seule. `avec_commun` met a jour TOUTES les couches.
- **huebeat** (`spatial_fx.lire_config`) : lit `mix` (6 couches au plus, une couche abimee est ecartee, pas le mix ; pas de mix
  imbrique). Ne relit pas son code a chaud : le relancer apres un changement de `spatial_fx.py`.
- **Lampes et ecran restent d'accord** : tant qu'un mix joue en direct, tout changement de son contenu (mix enregistre, scene
  retouchee ou supprimee) est renvoye aux lampes 400 ms apres (`mixEnvoye`) ; un mix retire du pad rend les lampes a la scene en
  cours ; l'ecran rouvert retrouve le mix par `reel.mix` + son nom (`est_mix` dans la config de huebeat). `_derniere` (API) retient
  le genre (scene ou mix) pour rejouer apres un changement de peripherique audio. `/spatial/direct` valide AVANT de lancer huebeat.
- **Ecran** : jouer un mix = `mixActif` ; retoucher une scene (`regler`) ou en activer une autre quitte le mix. Le brouillon en
  cours d'edition est montre dans la piece 3d sans rien envoyer aux lampes ; pour les lampes : enregistrer puis « jouer ».
  Les mix ne sont pas (encore) retenus dans un set enregistre, ni jouables depuis un set ou un moment.
- Mode demo : `src/mock/data/lumiere.ts` retient les mix en memoire (PUT/DELETE, nettoyage a la suppression d'une scene).
