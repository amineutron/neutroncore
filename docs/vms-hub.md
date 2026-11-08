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
  `hardware_error`, `choices` (`cpu_models[{id,label,hint}]`, `firmware[...]`, `displays`, `boot_devices`), `limits.disk_grow_gb`,
  `needs_stop` (la liste de l'API fait foi : un champ qu'elle ne nomme pas se change a chaud).
- `POST /vms-console/{vm}/edit` (jeton `vm_edit_<vm>`) : seuls les champs modifies ; `secure_boot: true` emporte `firmware: 'uefi'`
  dans le meme envoi ; `boot_order` sans doublon ; `usb_attach|usb_detach` en `vvvv:pppp`. L'ecran lit `needs_restart`, `hot`,
  `changes` a la racine de la reponse ou sous `result` ; a defaut il affiche son propre resume.
- `GET /vms-console/{vm}/snapshots` : `current: string | null`.
- `POST /vms-console/deploy` : `{image, name, vcpus, ram_mb, disk_gb, network, profile, env}` ; `env` est seulement enregistre.

Ecarts et points a verifier avec le vrai backend : le piège « redemarrer » (la rangee attend d'avoir VU la machine quitter
« en marche » avant de dire « fait », ou 45 s) ; la provenance `image` d'une machine deployee est dessinee en pointille
comme copie et archive ; l'etat `paused` d'une VM dans `status` (le hub lit `state`).

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
npm run build:demo && npm run e2e:vms   # 20 scenarios dans un vrai Chrome, sans backend
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
4. `fedora.vm_console` (console graphique) : la console actuelle reste le catalogue de commandes.
5. Application de « mon environnement » sur la machine deployee : `env` est enregistre dans la fiche, pas applique.

## Limites connues

- Les durees et tailles de la bibliotheque sont indicatives (a recontroler au branchement reel).
- `steps` et `log` des travaux n'arrivent qu'a la fin du job (la sortie de l'outil est rendue d'un bloc).
- `host.pool_*` mesure le systeme de fichiers qui porte `VM_POOL_DIR`, pas le dossier des images.

## Pour tester a la main

Fusionner d'abord les deux branches (la branche backend a pris du retard sur `main` : rebase necessaire), puis
`npm run build` et redemarrer `lyra-control-api.service`. En attendant, `npm run build:demo` et l'artifact
« Machines neutroncore » montrent le comportement complet sur des donnees fictives.
