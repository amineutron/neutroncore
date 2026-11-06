# DJ Light : banc d'essai

Note de 0 a 100 chaque fonction de DJ Light, une par une puis toutes ensemble, sur de la musique reelle ou sur le
morceau simule. Ecrit le 2026-10-21 ; les reglages des detecteurs ont ete choisis avec lui.

## Ce que mesure le banc

Code : `src/lib/djBench.ts` (mesures pures). Tests : `src/lib/djBench.test.ts` (garde-fou sur le morceau simule, dont
la verite est connue : 124 bpm, un drop toutes les 31 s) et `scripts/djBench.live.test.ts` (capture reelle).

Fonctions prises une par une (chacune sur la sortie du detecteur, sans les autres) :

| fonction | comment elle est notee |
|---|---|
| capture | images par seconde, plus grand ecart entre deux images |
| volume, volume lent, sous-graves, basses, mediums, aigus, chaleur, largeur | le signal se promene-t-il franchement (etendue p5-p95), est-il centre, colle-t-il aux bornes ? |
| grosse caisse, caisse claire, charleston | precision, rappel et mesure F contre des pics de flux spectral calcules autrement (+-4 images) |
| tempo | accord avec un peigne de periodes sur le flux ; si cette reference est ambigue, note sur la stabilite seulement (plafond 70) |
| tonalite | accord avec la gamme du passage entier ; si elle est peu nette (confiance < 0,55), note sur la stabilite seulement |
| break, montee, drop | precision et rappel des drops, fausses alertes, part du temps passee en break ou montee |

Le tout ensemble (profil « club », 5 lampes, 60 images par seconde, pile complete) : lumiere qui vit, synchro avec la
grosse caisse (lumiere finale et sortie des couches, avec leur latence), absence de scintillement, coherence des
couleurs, apport des couches (suivi de la grosse caisse et part de lumiere gardee par rapport au profil « a zero »),
cout par image, scene du drop.

Une reference calculee n'est pas la verite : elle sert a voir si deux methodes independantes s'accordent.

## Le lancer

```bash
# morceau simule + non-regression
npx vitest run src/lib/djBench.test.ts

# musique reelle : enregistrer du son brut (44,1 kHz, la frequence de l'analyseur), le rejouer dans l'analyseur
parec --format=s16le --channels=2 --rate=44100 --device=<sortie>.monitor > musique.pcm
python rejouer.py musique.pcm images.jsonl        # Analyseur + Decimateur de lib/djlight_dsp.py
DJ_BENCH_FILE=images.jsonl DJ_BENCH_OUT=rapport.md npx vitest run scripts/djBench.live.test.ts

# balayer des reglages (un dossier de .jsonl, un fichier par reglage x extrait)
DJ_BENCH_DIR=dossier DJ_BENCH_OUT=table.md npx vitest run scripts/djBench.sweep.test.ts
```

Rejouer le meme PCM permet de changer l'analyseur et de comparer sur exactement le meme son.

## Ce que le banc a trouve et fait corriger

Premier passage sur de la vraie musique ecoutee bas (mediane -35 LUFS) : 65 pour les fonctions seules, 78 pour l'ensemble.

| defaut | cause | correction |
|---|---|---|
| charleston jamais detecte (0 attaque) | plancher de niveau absolu 1e-3, energie mediane de la bande 5e-5 | plancher relatif au niveau fort de la bande + minimum absolu tres bas (`PART_NIVEAU`) |
| volume 15 % et chaleur 17 % : rangees presque immobiles, drop jamais vu | echelles fixes (-40..-6 LUFS, 250..4000 Hz) | echelles qui suivent le morceau (10e-95e centile sur 90 s, `Echelle`), idem largeur stereo |
| tempo fige sur 120 en se disant « trouve » | `bpmSur` vrai meme quand `suivreTempo` refusait la mesure (plus de 33 % d'ecart) | premier calage direct, saut apres 8 desaccords de suite ; raffinement en plusieurs passes, depart sur la periode moyenne, confiance sur la tenue de la grille |
| 172 par minute lu 164 | quantification a 30 images/s : ecarts de 10 et 11 images, regression sans points | idem |
| 63 a 76 % du temps en « montee » | basses relatives (sous 0,14 la moitie du temps) ; 5 caisses claires en 2,5 s = n'importe quelle batterie | break = creux de 5 LU sur le LUFS court terme ; montee = caisses qui s'accelerent (x2), 16 s au plus |
| coupure franche (silence puis retour) non vue | creux de 3 s exige | coupure de plus de 18 LU : retour d'une demi-seconde suffit |
| tonalite qui saute (3,4 changements/min) | oubli 8 s, delai 2 s | oubli 12 s, delai 3 s, marge 0,06 (0,85/min) |
| profil « club » 3,4 fois plus sombre que sans couche | trois multiplicateurs (60 %, 50 %, profondeur 85 %) | 75 %, 75 %, profondeur 10-55 % |
| caisse claire et grosse caisse trop prudentes | plancher de flux 0,65 et 0,45 (le facteur `k` ne joue pas) | 0,30 pour les trois, choisi sur deux extraits |

Etat final : 90 / 90 pour les fonctions seules, 92 / 87 pour l'ensemble (deux extraits de 90 s).

## Deuxieme tour (2026-10-21, soir) : cycle de la musique, onde rapide, avance

Trois blocs, chacun avec son interrupteur et ses reglages (ecran > « analyse et latence », gardes dans le navigateur ; un bloc
eteint se comporte comme avant) :

- **Cycle** (`src/lib/djCycle.ts`) : une mesure de 3 ou 4 temps se repete ; on cherche le tempo qui se retrouve apres un temps, une
  mesure, deux, quatre (autocorrelation du flux spectral sur 8 a 24 s). Reglages : mesure trouvee seule / 3 / 4, duree analysee,
  confiance, tempo mini / maxi / prefere. Donne aussi le premier temps de la mesure (signal `temps1`) et cale l'horloge dessus.
  Departage un tempo de son double par la cadence des grosses caisses (plus de 1,5 par temps = trop lent) et garde de l'inertie
  (le tempo suivi garde 10 % d'avance, le double ou les deux tiers demandent 6 s pour le remplacer).
- **Onde plus rapide** (`vitesseOnde` dans `spatialFx.ts`, aussi une cible de couche « vitesse de l'onde ») : l'onde traverse la
  piece x fois plus vite et son front s'elargit (jusqu'a 2,2 fois) pour que la piece ne paraisse pas terne. x1 ou absent = l'onde
  d'origine exactement. A reporter dans `spatial_fx.py` (huebeat) avant de brancher les vraies lampes.
- **Avance** : la lumiere part N ms avant le temps de l'horloge (0 a 300) pour absorber capture, analyse, reseau et affichage.

Aussi corrige : l'horloge visuelle des effets demarrait a 0 au lieu de l'horloge des grosses caisses (decalage de phase constant et
arbitraire) ; un recalage de plusieurs temps est maintenant etale sur ~0,2 s.

Resultats (`scripts/djBench.totaux.test.ts`, 7 sons : 2 extraits de ta musique, le morceau simule, 4 rythmes de tempo et de mesure
connus ; « tout eteint » = cycle, onde et avance coupes) :

| | fonctions seules | ensemble |
|---|---|---|
| tout eteint | 80 | 82 |
| reglages de depart | 81 | 90 |

Rythmes connus (`scripts/djBench.matrice.test.ts`, 8 tempos x 2 mesures x 3 taux de grosses caisses absentes) : tempo juste a 3 % pres
47/48 avec le cycle contre 45/48 avec les grosses caisses seules ; mesure juste 47/48 ; premier temps juste 93 % (0 % avant le calage).
Retard de la lumiere sur les images du moteur (rythme a 128, instants exacts) : 67 ms avec l'onde d'origine, 17 ms a x6, -33 ms avec
60 ms d'avance. Le total estime (images + 110 ms de chemin du son a l'ecran) passe de 177 ms a 77 ms.

Sur ta musique le cycle trouve 159 bpm (extrait 1, les grosses caisses disaient 161) et 154,2 bpm (extrait 2, ou elles ne trouvaient
rien de stable). Un passage de 6 s a 106 bpm (2/3 de 159) reste dans l'extrait 1 : le cycle y est constant, c'est une vraie ambiguite.

## Limites

- Deux extraits d'une meme ecoute : risque de reglage sur un genre. Refaire le balayage avec d'autres musiques.
- Tempo et tonalite : sur ces extraits la reference est ambigue, donc notes sur la stabilite seulement. Le tempo du
  second extrait reste instable (120,5 en fin, ecart-type 7,8) : les grosses caisses y sont irregulieres.
- Grosse caisse 75-78 et caisse claire 69-80 : bien, pas excellent.
- Le retard de la lumiere ne se mesure bien que sur des rythmes aux instants connus : sur de la musique reelle les pics de
  reference sont approximatifs (+-30 ms). Les 110 ms de chemin amont (capture, analyse, image, affichage) sont une estimation
  a confirmer a l'oreille ; la sortie audio de la tele ou de l'ampli retarde le son d'autant, d'ou le curseur d'avance.
- Le tempo a 3 temps et tres peu de grosses caisses, au-dela de 170 par minute, est encore pris pour sa moitie dans quelques cas.
- Ne mesure ni le reseau, ni le pont Hue, ni huebeat, ni les vraies lampes.
