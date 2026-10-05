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
- Ouvert : supprimer le stash de hue-mcp ; le smoke MCP quotidien a vu la panne 2 jours sans alerter -> le brancher sur ntfy.
