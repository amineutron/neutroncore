# Hub des VMs (2026-11-08)

Refonte de l'ecran `vms` : accueil par familles de machines, provenance, snapshots en arbre interactif,
bibliotheque d'images, taches nommees, aide pedagogique « ? ». Non commite (branche `worktree-s1108-041024`
cote neutroncore, `feat/vms-hub` cote `lyra-control-api`).

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
npx vitest run                     # 1810+ tests, dont contrat avec le vrai backend
npm run bench:vms                  # budgets de temps (familles, ressources, arbre, recherche)
npm run build:demo && npm run e2e:vms   # 16 scenarios dans un vrai Chrome, sans backend
cd <worktree lyra-control-api> && <repo>/.venv/bin/python -m pytest -q   # 3360 tests
```

`E2E_OUT=/chemin` garde les captures d'ecran de l'e2e. `CHROME_BIN` change le navigateur.
Le test de contrat `src/lib/vmHubContract.test.ts` lit `src/lib/__fixtures__/vmhub.backend.json`, une reponse
REELLE du backend (demon simule) : a regenerer si l'API change.

## Ce qui n'existe pas encore (outils MCP a ajouter dans fedora-agents)

Le hub montre ces fonctions mais les desactive avec la raison, ou les laisse en lecture seule :

1. `fedora.vm_create_from_image` : deploiement depuis la bibliotheque (cloud, virt-builder, ISO) ; le bouton
   « deployer » est grise (`deployable: false`) tant qu'il n'existe pas. La route `POST /vms-console/deploy`
   appelee par `DeployDialog` est a creer en meme temps.
2. `fedora.vm_pause`, `vm_resume`, `vm_reboot`.
3. `fedora.vm_edit` etendu : modele de processeur, firmware, TPM, secure boot, ordre de demarrage, USB,
   reseau, affichage, agrandissement du disque. Le guide du modele de processeur est en lecture seule.
4. `fedora.vm_console` (console graphique) : la console actuelle reste le catalogue de commandes.
5. Application de « mon environnement » sur la machine deployee (dotfiles en lecture seule).

## Limites connues

- `head` de l'arbre de snapshots : l'API ne dit pas quel snapshot est le courant ; l'ecran prend le dernier cree.
  `virsh snapshot-current` regle cela (a ajouter a `vm_snapshot list`).
- Les durees et tailles de la bibliotheque sont indicatives (a recontroler au branchement reel).
- `steps` et `log` des travaux n'arrivent qu'a la fin du job (la sortie de l'outil est rendue d'un bloc).
- `host.pool_*` mesure le systeme de fichiers qui porte `VM_POOL_DIR`, pas le dossier des images.

## Pour tester a la main

Fusionner d'abord les deux branches (la branche backend a pris du retard sur `main` : rebase necessaire), puis
`npm run build` et redemarrer `lyra-control-api.service`. En attendant, `npm run build:demo` et l'artifact
« Machines neutroncore » montrent le comportement complet sur des donnees fictives.
