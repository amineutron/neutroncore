# Journal des sessions

## 2026-08-30 — casts fantomes sur la TV Philips (session « neutroncore-1e »)

- Objectif : comprendre pourquoi la TV etait interrompue en boucle par un cast et corriger.
- Diagnostic : logcat TV (« Launch request from sender », peer = ce PC) + `ss -tnp :8009` ->
  processus `media_hubd.py` du hub musique Quickshell (`$DEV_ROOT/ricing`, hors de ce depot).
  `cast_connect` passait par `catt.api.CattDevice.controller` dont `prep_app()` lance le
  Default Media Receiver a chaque reconnexion (retry 15 s).
- Fait (dans `$DEV_ROOT/ricing`, non versionne) : `media_hub.py` / `media_hubd.py` en pychromecast
  lecture seule + garde `cast_media_ready`, 3 tests de regression, daemon relance, receiver ferme.
- Dans ce depot : rien de nouveau ; `src/screens/Ambiance.tsx` avait deja une modif en attente
  (token X-Confirm `ironman_trigger` sur la scene Iron Man) — non commitee.
- Ouvert : commit de la modif Ambiance ; `$DEV_ROOT/ricing` n'est pas un depot git (pas d'historique du fix).

## 2026-09-24 — sessions Claude tuees au restart de l'API, VMs via Lyra (session « dev-6c »)

- Objectif : comprendre pourquoi des sessions Claude disparaissaient avec leur terminal, puis remettre l'affichage des VMs d'aplomb.
- Cause : les kitty lances par le lanceur vivaient dans le cgroup de `lyra-control-api` (KillMode=control-group), tues a chaque restart ; l'arret bloquait 45 s sur les flux SSE (SIGABRT + coredump).
- API (`lyra-control-api`) : `_spawn` via `systemd-run --user --scope`, `timeout_graceful_shutdown=5` ; VMs via le demon (`lib/vms.py`, `fedora.vm_status/vm_start/vm_stop`), `GET /services/vms` a la demande (cache 10 s), `POST /services/vms/{vm}/{start|stop|force_stop}` avec jeton `vm_<action>_<vm>` (`auth_router.action_allowed`) ; virsh retire de `services_checker` (il lisait qemu:///session, vide).
- Front : `lib/vms.ts`, `components/VmRow.tsx` (deux clics, compte a rebours, animations, « forcer l'arret » apres 60 s), `Outils.tsx`, `LyraPanel.tsx` (plus de poll /services toutes les 6 s), `usePoll(..., enabled)`.
- Verifie en reel sur `test-vm` (demarrage, arret ignore, arret force) ; 3 commits pousses, CI neutroncore verte.
- Ouvert : 6 coredumps de l'API (~850 Mo) a supprimer en sudo dans le dossier coredump de systemd (`coredumpctl`) ; `vm_status` coute 3-7 s (tests SSH) — un mode liste leger cote fedora-setup accelererait l'ecran.

## 2026-09-30 — couleur de l'ambiance en echec, checks GitHub (session « neutroncore-12 »)

- Objectif : reparer le nuancier de l'ecran ambiance (`POST /hue/group/color` -> `success:false`), puis verifier les tests rouges sur GitHub.
- Cause : `$DEV_ROOT/hue-mcp` etait reste sur la branche de PR `upstream/address-by-name` alors que son venv avait mcp 2.2 (lock de `main`) -> import `mcp.server.fastmcp` en echec, serveur Hue mort depuis le restart du demon du 27/09, tous les outils `hue.*` « inconnus ».
- Fait (hors de ce depot) : hue-mcp repasse sur `main` + `uv sync --frozen`, demon Lyra relance (28 outils hue, smoke MCP OK, couleur OK). Patch manuel intermediaire mis en stash (doublon de `main`).
- GitHub : aucun workflow rouge sur son dernier run ; les echecs visibles (catt, hue, mcp-tracking, pylips, roadmap traffic, releases fedora-agents v1.2.1 / pylips v0.2.0) avaient deja ete corriges ou relances.
- Dans ce depot : aucun changement de code.
- Suite (2026-10-06) : alerte ntfy du smoke MCP (`OnFailure=` -> `lyra-mcp-smoke-alert.service`, `scripts/smoke_alert.py` teste, commit lyra `74010e8`) ; drop-in local `ntfy.conf` -> fichier d'env de l'API ; CVE brace-expansion corrigee (lockfile) ; consigne : CI complete rejouee avant chaque push.
- Ouvert : `git stash drop` dans `$DEV_ROOT/hue-mcp` (bloque par les permissions, a faire a la main) ; IP Tailscale reelle en valeur par defaut dans `config.py` de lyra-control-api (prive).

## 2026-10-06 — dettes ouvertes, valeurs privees (session « neutroncore upgrade IDEA »)

- Objectif : solder les dettes du journal avant d'ouvrir de nouveaux volets ; plus de secret, d'IP reelle ni de chemin absolu dans le code.
- qBittorrent : le 502 n'etait pas un credential manquant. Blob corrige a 13:52, API demarree a 13:46 avec l'ancien mot de passe en memoire (verifie hors ligne contre le hash PBKDF2 de `qBittorrent.conf`). Fix durable cote API : `lib/creds.py`, blob relu a chaque login.
- `lyra-control-api` : IP tailnet retiree des defauts (`NTFY_URL`, `APP_PUBLIC_URL`), adresses d'appareils et identifiant Tuya sortis de `config.py` vers le fichier d'env, chemins HALO derives de `DEV_ROOT`, unite systemd en `%h`. Test de garde `tests/test_config_secrets.py`. 329 tests verts, API redemarree, routes cles en 200.
- Dans ce depot : audit sans resultat (seules des adresses de documentation 100.64.0.1 et `/home/user` dans la demo).
- Dialogues maison : les 17 `window.confirm` / `window.alert` passent par `lib/dialog.ts` + `components/Dialogs.tsx` (modale a promesse, case a cocher pour « supprimer aussi les fichiers », messages non bloquants). Apres revue : Entree n'est pas interceptee et le focus demarre sur « annuler » pour une action destructive, une meme question ne s'empile pas deux fois, le retour ferme le dialogue du dessus et rend l'entree d'historique consommee.
- Regle a la main par l'utilisateur : stash doublon de hue-mcp supprime, coredumps purges.
- Lot 1 des volets (branche `feat/remote-missing-services` dans les deux depots) : telecommande TV, onglet manquants, demarrage/arret des services. Cote API : liste fermee des touches, `series_id` et titre de serie dans /arr/missing, drapeau `controllable`. Verifie dans la demo (1366 et 390 px) et par curl sur l'API reelle ; aucune touche envoyee a la vraie TV, aucun service arrete.
- Lot 2 (branche `feat/palette-notifications` dans les deux depots) : alertes typees `kind`/`key`, centre de notifications avec veilleur cote API, palette de commandes Ctrl+K avec favoris et raccourcis sur l'accueil. Verifie dans la demo et sur l'API reelle (3 alertes en cours journalisees au premier releve).
- Lot 3 (branche `feat/room-plan-routines` dans les deux depots) : ecran plan de piece branche sur le plan HALO, bascules HALO (ambilight + hue, couleurs de la TV en direct), routines avec catalogue ferme et planification. Verifie dans la demo ; sur l'API reelle, une routine d'essai sans effet (attente 1 s) creee, lancee et supprimee, et un plan invalide refuse sans toucher au fichier HALO. Aucun plan reel modifie, aucune routine reelle lancee sur les appareils.
- Ouvert : l'IP tailnet reste dans l'historique git de lyra-control-api (depot prive) ; `recover-qbittorrent.sh` de media-server garde un chemin absolu (depot avec des modifications en cours, non touche).
