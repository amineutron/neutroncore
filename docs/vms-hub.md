# Hub des VMs (2026-11-08)

Refonte de l'ecran `vms` : accueil par familles de machines, provenance, snapshots en arbre interactif,
bibliotheque d'images, taches nommees, aide pedagogique « ? ». Lot 1 fusionne (PR #27) ; lot 2 sur la branche
`feat/vms-hub-2` (pause / reprise / redemarrage, materiel etendu, deploiement, snapshot courant), ecrit contre le
contrat de `lyra-control-api` decrit plus bas.

## Lot 2 : alimentation, materiel etendu, deploiement, snapshot courant

| Zone | Fichiers (neutroncore) | Role |
|---|---|---|
| Alimentation | `src/lib/vmPower.ts`, `vmHubApi.ts` (`Power`, `POWER_LABEL`, `powerVm`), `components/VmRow.tsx` | boutons selon l'etat : en marche = pause, redemarrer, arreter, forcer ; en pause = reprendre, forcer ; eteinte = demarrer. Jeton `vm_<action>_<vm>` sur `/auth/token`, `POST /services/vms/{vm}/{action}` |
| Materiel | `src/lib/vmHardware.ts` (pur), `components/vmhub/Hardware.tsx` | etat reel (`settings.hardware`), formulaire des 14 champs, un seul « appliquer » qui n'envoie que les champs modifies (`diffHardware`), regles du contrat (`validateHardware`), ordre de demarrage (`moveBoot`), resume de l'outil (`changes`, `needs_restart`) |
| Aide | `src/lib/vmHelp.ts` | `hw-fw`, `hw-tpm`, `hw-sb`, `hw-boot`, `hw-display`, `hw-usb`, `hw-grow`, `pause`, `needs-stop` |
| Deploiement | `DeployDialog.tsx`, `Library.tsx` | bouton actif quand `deployable: true` ; sinon la raison ; note « environnement enregistre dans la fiche, pas encore applique » |
| Snapshots | `SnapshotsHub.tsx` | `current` de l'API = cercle dore « vous etes ici » (repli : dernier cree, dit comme tel) |
| Demo | `src/mock/data/vmHub.ts` (alimentation, `powerDemo`), `vms.ts` (materiel par machine, edition des 14 champs, `current`) | `ubuntu-preprod` en uefi + tpm + secure boot, `kali-pentest` uefi + vnc + reseau isole, les autres en bios |

Contrat API attendu (lyra-control-api, ecrit en parallele) :

- `POST /services/vms/{vm}/{action}` : `start|stop|force_stop|pause|resume|reboot`, jeton `vm_<action>_<vm>`, reponse `{success, error}`.
- `GET /vms-console/{vm}` : `settings.hardware` (`cpu_model, firmware, secure_boot, tpm, boot_order, display, network, disks[], usb[]`),
  `hardware_error`, `choices` (`cpu_models`, `firmware`, `displays`, `boot_devices` : TOUS des tableaux `{id, label, hint}` ; `id` dans
  la charge utile, `label` a l'ecran, `hint` en aide), `limits` (`disk_grow_gb`, plus `usb_id` et `network` : regex en texte),
  `needs_stop` (la liste de l'API fait foi : un champ qu'elle ne nomme pas se change a chaud).
- `POST /vms-console/{vm}/edit` (jeton `vm_edit_<vm>`) : seuls les champs modifies ; `secure_boot: true` emporte `firmware: 'uefi'`
  dans le meme envoi ; `boot_order` sans doublon ; `usb_attach|usb_detach` en `vvvv:pppp`. La reponse ne porte que `{success, job}` :
  l'ecran affiche d'abord son propre resume (`describePayload`, « demandé »), puis lit `result` (`needs_restart`, `hot`, `changes`,
  `skipped`) dans le travail de `GET /vms-console/jobs` une fois fini (`summarizeJob`, « résultat de l'outil »).
- `GET /vms-console/{vm}/snapshots` : `current: string | null`.
- `GET /vms-console/library` : `creation_tool: bool` + `creation_reason` en tete (bandeau dans la bibliotheque quand l'outil manque),
  `deployable`/`reason` par entree.
- `POST /vms-console/deploy` : `{image, name, vcpus, ram_mb, disk_gb, network, profile, env}` ; travail `kind: "deploy"` ; la fiche de
  la machine a `origin: "own"`, `from: <image>`, `lineage: [{id, rel: "image", ext: true}]`, `env` facultatif (enregistre, pas applique).

Ecarts et points a verifier avec le vrai backend : le piège « redemarrer » (la rangee attend d'avoir VU la machine quitter
« en marche » avant de dire « fait », ou 45 s) ; la provenance `image` d'une machine deployee est dessinee en pointille
comme copie et archive ; l'etat `paused` d'une VM dans `status` (le hub lit `state`).

## Lot 3 : ecran (noVNC) et terminal serie (xterm.js)

Branche `feat/vm-view`. Deux dependances de production epinglees : `@novnc/novnc` 1.7.0, `@xterm/xterm` 6.0.0,
`@xterm/addon-fit` 0.11.0. Ce sont des clients de protocole (RFB, emulation de terminal), pas des bibliotheques
d'interface : la regle « aucune lib UI » du depot tient. Chargees a la demande (`import()`), donc hors du bundle
principal : `rfb-*.js` 187 Ko (56 Ko gzip), `vmTerminal-*.js` 333 Ko (84 Ko gzip) + 4 Ko de CSS.

| Zone | Fichiers (neutroncore) | Role |
|---|---|---|
| Logique pure | `src/lib/vmView.ts` (testee) | `wsUrl` (http -> ws, https -> wss, chemin de l'API a la racine meme sous /app/), `viewVerdict` (eteinte / en pause / spice / aucun affichage / vnc / indisponible, action et raison), `scaleFor`, `closeReason` (codes du pont), `normalizeState` (`shut off` -> `stopped`), `resizeMessage` |
| Acces reseau | `vmHubApi.ts` : `fetchView`, `viewToken` (chaine du jeton `vm_view_<vm>`), `addVncDisplay` (= `/edit {display:'vnc'}`) | le jeton va dans l'adresse du WebSocket (il ne peut pas porter d'en-tete) ; jamais la cle API |
| Sources | `vmViewSources.ts` (interface + choix), `vmViewVnc.ts` (noVNC), `vmViewSerial.ts` (WebSocket binaire), `vmTerminal.ts` (xterm + fit + theme depuis les tokens CSS), `src/mock/vmViewDemo.ts` (faux ecran anime, faux terminal) | les composants ne connaissent que l'interface ; la demo ne charge pas noVNC, le vrai build ne charge pas le mock |
| Composants | `components/vmhub/Screen.tsx` (onglet « écran »), `Serial.tsx` (sous-onglet « terminal » de la console) | connexion a la demande, un seul canvas monte, demontage propre, plein ecran avec la regle de l'encoche, Ctrl+Alt+Suppr, coller, clavier sur tactile |
| Aide | `vmHelp.ts` : `screen-vnc`, `serial`, `cad`, `fullscreen-kbd` ; `hw-display` complete (pourquoi VNC ici) | |

Contrat (lyra-control-api, livre) :

- `GET /vms-console/{vm}/view` -> `{success, state ('running' | 'shut off' | etat brut), display: 'vnc'|'spice'|'none', vnc: {host, port} | null, serial, reason}`.
- Jeton : `GET /vms-console/token?action=vm_view_<vm>`, 30 s, demande juste avant d'ouvrir le flux.
- `WS /vms-console/{vm}/vnc?token=` : pont RFB binaire, donne a noVNC avec `wsProtocols: ['binary']`. Le WebSocket est ouvert
  par neutroncore et confie a `RFB` (sinon le code de fermeture n'est pas lisible).
- `WS /vms-console/{vm}/serial?token=` : octets du terminal en binaire ; `{"resize":[cols,rows]}` en texte a l'ouverture et a chaque
  redimensionnement (ResizeObserver + addon fit).
- Codes de fermeture : `4401` jeton absent / faux / consomme — ferme AVANT l'acceptation, le navigateur ne voit qu'une poignee de main
  echouee (error puis close 1006) : un flux jamais ouvert est dit « jeton refusé ou expiré, réessaie » ; `4404` machine inconnue ;
  `4503` eteinte / pas de VNC local / serveur injoignable / serie impossible ; `4409` deja une vue de ce type (VNC et serie coexistent) ;
  `1009` trame trop grande ; `1000` fin normale (inactivite 10 min).
- Passer en VNC = `POST /vms-console/{vm}/edit {display:'vnc'}`, machine arretee (bouton grise avec la raison sinon).

Piege : l'animation d'entree `.vh-enter>*{animation:vhUp ... both}` (transform) fait de chaque bloc un contenant pour `position:fixed`,
meme finie : le plein ecran se calait sur la carte. `.vh-enter>*:has(.vh-plein){animation:none}` la retire aux ancetres du calque.

Corrections de la revue (commit `fix(vms): touch keyboard…`) :

- **Clavier tactile** : « clavier » focalise un `<textarea class="vh-kbd">` cache (hors ecran, `autocapitalize/autocorrect` off) ; ses
  `keydown` speciaux et raccourcis (`lib/vmKeys.ts`, pur et teste : Entree, Retour arriere, Tab, Echap, fleches, F1-F12,
  Ctrl/Alt/Meta + caractere) et son texte (`input` hors composition, `compositionend`) deviennent `rfb.sendKey(keysym, code, down)` ;
  keysym = point de code pour Latin-1, `0x01000000 | u` au-dela (memes valeurs que noVNC, dont le paquet n'exporte pas les tables).
  Le champ est vide apres chaque envoi. Le faux ecran de la demo affiche ce qu'il recoit (`data-typed`) : l'e2e verifie le chemin
  champ -> touche -> machine (texte, retour arriere, Entree).
- **Aucune session fuyante** : compteur de generation + `AbortSignal` passe aux sources ; quitter (ou « annuler ») pendant le jeton
  ou le chargement du client n'ouvre rien (`AbortedError`), une session arrivee trop tard est fermee aussitot ; `onDisconnect` ne
  vide `sess` que pour sa propre session.
- `credentialsrequired` -> deconnexion + « mot de passe VNC requis (non pris en charge) ». `ws: true` sur le proxy Vite (dev).
- **Bouton retour / Echap / fond** (`lib/useFullscreenOverlay.ts`) : le calque s'inscrit dans la garde de navigation
  (`lib/navGuard`) : au retour, App l'interroge, le calque se ferme et refuse la sortie, App rend l'entree d'historique consommee.
  Pas de `pushState` a nous : deux ecouteurs du meme `popstate` se disputeraient l'evenement. Echap ferme si le clavier n'est pas tenu
  par la machine ou le terminal ; `role="dialog" aria-modal`, `body{overflow:hidden}` pendant le plein ecran, `full` remis a faux quand
  la machine s'eteint.
- Terminal : `.catch` sur le chargement d'xterm (message + « recharger »), aucune ecriture apres `dispose`.
- Messages : fermeture par nous = « déconnecté » ; jamais ouvert = « connexion impossible : jeton refusé ou expiré (30 s), ou API
  injoignable ». Tests des sources avec un WebSocket factice (`__fixtures__/fakeWs.ts`, `vmViewVnc.test.ts`, `vmViewSerial.test.ts`).

Non verifie en reel (pas de vraie API lancee) : poignee de main noVNC contre le pont, `securityfailure`, `desktopname`, coller via
`clipboardPasteFrom`, clavier tactile (focus du champ cache de noVNC / textarea d'xterm), fermeture 4409 pendant une vue ouverte.
noVNC ecrit `noVNC requires a secure context` dans la console quand la page est en http hors localhost (tailnet) : c'est un avertissement,
l'authentification « None » de QEMU n'a pas besoin de crypto.subtle.

## Ce qui est livre

| Zone | Fichiers (neutroncore) | Role |
|---|---|---|
| Logique pure | `src/lib/vmHub.ts` | type de machine, familles, provenance, ressources, alertes, regles modele/suppression |
| | `vmSnapTree.ts` | arbre depuis `depth`/`parent`, disposition, zoom, clavier, suppression (iteratif, 20000 noeuds) |
| | `vmLibrary.ts`, `vmEnv.ts` | recherche reactive sans accents, filtres, surbrillance ; « mon environnement » |
| | `vmTasks.ts`, `vmHelp.ts`, `vmHubApi.ts` | taches nommees, textes d'aide, acces reseau |
| Composants | `src/components/vmhub/*` + `vmhub.css` | accueil, familles, panneau ressources, graphe, bibliotheque, taches, dialogues |
| Ecran | `src/screens/Vms.tsx` | six onglets : accueil, machines, bibliotheque, modeles, archives, taches |
| Demo | `src/mock/data/vmHub.ts` | overview, bibliotheque, travaux avec etapes et journal, modeles, import/export |

Backend (`lyra-control-api`, worktree `vms-hub`) : `lib/vm_meta.py` (fiches : profil, modele, provenance),
`vm_provenance.py`, `vm_overview.py`, `vm_library.py`, `vm_jobs.py`, `vm_snapshots.py`, `vm_edit.py`,
`routers/vms_hub.py`. Routes : `GET /vms-console/overview`, `/library`, `GET|PUT /meta/{vm}`,
`POST /{vm}/template`, `tree` dans `GET /{vm}/snapshots`, `title|kind|log|steps` dans les travaux.

## Verifier

```bash
npx vitest run                     # 2140+ tests, dont contrat avec le vrai backend
npm run bench:vms                  # budgets de temps (familles, ressources, arbre, recherche)
npm run build:demo && npm run e2e:vms   # 22 scenarios dans un vrai Chrome, sans backend
npm run check:demo                 # aucune donnee de la machine dans le bundle de demo
cd <worktree lyra-control-api> && <repo>/.venv/bin/python -m pytest -q   # 3360 tests
```

`E2E_OUT=/chemin` garde les captures d'ecran de l'e2e. `CHROME_BIN` change le navigateur.
Le test de contrat `src/lib/vmHubContract.test.ts` lit `src/lib/__fixtures__/vmhub.backend.json`, une reponse
REELLE du backend (demon simule) : a regenerer si l'API change.

## Ce qui depend encore du backend ou des outils MCP (fedora-agents)

Le front du lot 2 est ecrit contre le contrat ci-dessus. Cote serveur, il reste a livrer ou a verifier :

1. `fedora.vm_create_from_image` + `POST /vms-console/deploy` : tant que le demon ne connait pas l'outil, la
   bibliotheque recoit `deployable: false` et affiche `reason` ; la demo le montre a `true` partout.
2. `fedora.vm_pause`, `vm_resume`, `vm_reboot` derriere `POST /services/vms/{vm}/{action}`.
3. `fedora.vm_edit` etendu (14 champs) et `settings.hardware` dans `GET /vms-console/{vm}`.
4. Console graphique : l'onglet « écran » (noVNC) et le terminal serie sont ecrits contre les routes `view`, `vnc`, `serial` du
   lot 3 ; a verifier contre la vraie API (voir « Non verifie en reel »).
5. Application de « mon environnement » sur la machine deployee : `env` est enregistre dans la fiche, pas applique.

## Limites connues

- Les durees et tailles de la bibliotheque sont indicatives (a recontroler au branchement reel).
- `steps` et `log` des travaux n'arrivent qu'a la fin du job (la sortie de l'outil est rendue d'un bloc).
- `host.pool_*` mesure le systeme de fichiers qui porte `VM_POOL_DIR`, pas le dossier des images.

## Pour tester a la main

Fusionner d'abord les deux branches (la branche backend a pris du retard sur `main` : rebase necessaire), puis
`npm run build` et redemarrer `lyra-control-api.service`. En attendant, `npm run build:demo` et l'artifact
« Machines neutroncore » montrent le comportement complet sur des donnees fictives.
