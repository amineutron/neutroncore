# DJ Light sur les vraies lampes

Bouton « lancer sur les vraies lampes » (écran ambiance > dj light). Le calcul de la lumière reste dans le navigateur
(moteur DJ Light complet, même `evaluer` que la pièce 3d) ; seules les couleurs finales de chaque canal partent vers huebeat.

## Chaîne

```
son de l'ordinateur -> moteur audio de l'API (parec 25 ms, blocs de 23 ms, 30 images/s)
  -> SSE /djlight/flux -> navigateur : moteur TS + couleurs par canal (src/lib/djLampes.ts)
  -> WebSocket /djlight/lampes (routers/djlight_reel.py) -> socket UNIX -> huebeat (direct_feed.py) -> DTLS -> pont Hue
```

- Une trame = corps d'un paquet HueStream (`>BHHH` par canal : numéro, r, g, b 16 bits). L'API la valide (`lib/djlight_reel.py`) et
  la passe telle quelle ; huebeat la revalide et l'envoie **à l'arrivée** (pas d'attente de son émetteur à 30 Hz).
- Les images audio cadencent les lampes (pas l'animation de l'écran) : un onglet caché continue de recevoir des messages réseau.
- Un canal en retard abandonne la trame au lieu de la mettre en file (`liaison` : tampon du socket > 512 octets).
- Même rendu que `sortie_lampe` de huebeat : 3d = carré (gamma perceptuel), 2d = linéaire.

## Sécurité des lampes

- huebeat n'est lancé que par le bouton ; `POST /djlight/reel {actif: false}` (ou « arrêter ») le coupe et rend les lampes à leur état d'avant.
- Onglet fermé ou écran quitté : sans trame depuis 0,5 s, huebeat reprend son comportement habituel ; sans navigateur depuis 8 s,
  l'API arrête huebeat (`_rendre_les_lampes`). Un rechargement de page ne coupe donc rien.
- Un seul navigateur à la fois (le second reprend la main, le premier reçoit le code 4000). Clé API dans le premier message du WebSocket.
- Un huebeat lancé avant l'arrivée du flux direct (pas de socket) est relancé automatiquement.

## Latence mesurée (sans lampes)

`DJ_LATENCE=<dossier> DJ_API_DIR=<dossier de lyra-control-api> npx vitest run scripts/djLampes.latence.test.ts` : moteur audio (mire, temps réel) -> moteur TS -> WebSocket -> API -> faux huebeat.
600 images sur 20 s, 600 trames arrivées : émission du moteur -> arrivée chez huebeat **médiane 0,8 ms, p95 1,8 ms, max 5,5 ms**
(moteur TS + couleurs : 0,3 ms ; WebSocket + API + socket : 0,7 ms).

Le reste n'est pas du logiciel mesurable ici : capture (parec 25 ms) + bloc (23 ms) + cadence des images (jusqu'à 33 ms), puis pont
Hue et ampoules. Il se compense avec l'« avance » (analyse et latence) pour ce qui suit le tempo ; une réaction à un coup isolé ne
peut pas être avancée.

## Essai réel (2026-10-23)

Mise en route de huebeat 3 s ; 338 trames envoyées, 0 perdue ; état `direct: true` dans huebeat ; aperçu des couleurs envoyées lu
dans `/tmp/lyra_hue_beat.preview.json` ; canal fermé, lampes rendues par l'API au bout de 8 s, état identique à celui d'avant.

## Limites

- La lumière est calculée dans l'onglet : le garder ouvert (il peut être derrière une autre fenêtre).
- Mesure à l'œil de la latence jusqu'aux ampoules : à faire sur le morceau, en réglant l'avance.
- `vitesseOnde` n'est pas encore reporté dans `spatial_fx.py` (inutile ici : le calcul est fait côté navigateur).
