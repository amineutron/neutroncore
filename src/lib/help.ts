// Contenu des panneaux d'aide (bouton "?" du titre de chaque écran).
// Style TUI : des lignes courtes, pas de paragraphes.

export type HelpTopic = {
  title: string
  intro: string
  points: [string, string][]   // [libellé, explication]
  tip?: string
}

export const HELP: Record<string, HelpTopic> = {
  accueil: {
    title: 'accueil',
    intro: "Le briefing du homelab : ce qui va, ce qui cloche, ce qui tourne.",
    points: [
      ['palette', 'Ctrl+K ouvre la recherche de commandes : aller à un écran, lancer une scène, ouvrir Claude dans un projet. L’étoile épingle une commande dans les raccourcis.'],
      ['notifications', 'La cloche garde la trace des alertes (apparition, résolution) et des sessions Claude, même après coup.'],
      ['le réacteur', "L'anneau central compte les alertes en cours. Vert et calme = rien à faire."],
      ['à traiter', 'Services tombés, disque plein, timers en échec — ce qui demande une action.'],
      ['les tuiles', 'Cliquables : chaque tuile ouvre la page correspondante.'],
      ['les mascottes', "État réel des deux modèles Lyra : la petite (dialogue) et la grande (analyse)."],
    ],
    tip: "Le bouton télé en haut passe l'app en affichage dense, lisible depuis le lit.",
  },
  agenda: {
    title: 'agenda',
    intro: 'Les rendez-vous du homelab et les tiens : sauvegardes planifiées, rappels, événements perso.',
    points: [
      ['couleurs', 'Or = aujourd\'hui, vert = fait, rouge = en échec ou manqué, gris = passé sans résultat.'],
      ['automatiques', 'Borg, Timeshift et le disque tournant : leur état vient du journal systemd, pas d\'une supposition.'],
      ['fiche', 'Cliquer un événement ouvre le détail, avec un lien vers le journal de la sauvegarde.'],
      ['vues', 'Semaine, mois ou liste : ton choix est retenu. Dans le mois, cliquer un jour le déplie sous sa semaine, avec ses propres filtres.'],
      ['échecs', 'Relancer la sauvegarde (elle passe « réparé » si ça marche), ignorer l\'échec (réversible) ou ignorer tous les anciens. Un échec ignoré ou relancé quitte « à traiter ».'],
      ['disque tournant', 'Bouton « lancer la sauvegarde » quand le disque USB est branché : progression et journal en direct, l\'agenda se met à jour à la fin.'],
      ['rappels', 'Un événement marqué « rappel » apparaît dans « à traiter » le jour même tant qu\'il n\'est pas fait.'],
      ['barre du haut', 'Le calendrier Quickshell affiche les événements du jour, lus depuis la même API.'],
    ],
    tip: 'Les filtres par catégorie se combinent : garde seulement « sauvegardes » pour un suivi 3-2-1.',
  },
  films: {
    title: 'films & séries',
    intro: 'La bibliothèque Radarr et Sonarr, avec les sorties à venir.',
    points: [
      ['filtres', 'Basculer entre films et séries, filtrer par état de téléchargement.'],
      ['fiche', 'Cliquer une affiche ouvre le détail : qualité, taille, disponibilité.'],
      ['calendrier', 'Les prochains épisodes attendus dans les sept jours.'],
      ['manquants', 'Films et épisodes suivis mais absents du disque, avec relance de la recherche.'],
      ['suppression', 'Double confirmation obligatoire, et jeton de sécurité côté serveur.'],
    ],
  },
  demandes: {
    title: 'demandes',
    intro: 'Demander un film ou une série, et suivre ce qui a été refusé automatiquement.',
    points: [
      ['recherche', 'La liste se filtre à la frappe. Les posters aident à choisir la bonne version.'],
      ['séries', 'Choix des saisons, de la qualité et de la langue avant validation.'],
      ['watchlist', 'Garder un titre de côté sans lancer la demande tout de suite.'],
      ['refus auto', 'Les demandes abandonnées par le nettoyeur, avec la raison exacte.'],
    ],
  },
  dl: {
    title: 'téléchargements',
    intro: 'Les torrents en cours, les sous-titres et le pipeline média.',
    points: [
      ['vitesse et ETA', 'Rafraîchis toutes les cinq secondes tant que la page est visible.'],
      ['bloqués', 'Un torrent sans source depuis trop longtemps est signalé.'],
      ['sous-titres', 'État de Bazarr et des traductions IA en cours.'],
      ['suppression', 'Double confirmation : le fichier part aussi du disque.'],
    ],
  },
  taches: {
    title: 'tâches de fond',
    intro: 'Tout ce qui tourne en arrière-plan : Lyra, conversions, scripts, timers.',
    points: [
      ['temps restant', 'Estimé sur la progression réelle, il décroît et se corrige tout seul.'],
      ['détail', "Cliquer une tâche déplie le pourcentage exact, l'heure de départ et les derniers logs."],
      ['journal', 'Les dernières lignes de toutes les sessions, les plus récentes en haut.'],
      ['timers', 'Les tâches planifiées systemd et leur prochaine exécution.'],
    ],
    tip: 'Les tâches longues de Lyra apparaissent aussi dans le chat, encart « tâche en cours ».',
  },
  projets: {
    title: 'projets & mises à jour',
    intro: "L'état de tes dépôts et ce qui attend d'être mis à jour.",
    points: [
      ['projets suivis', "Une ligne par projet, repliable. La barre s'épaissit quand tu déplies ; les points colorés sur la ligne sont les moments qui demandent une action de toi (rose plein = attend toi, rose creux = te concerne bientôt, or = en cours, rouge = bloqué). La mascotte avance avec le projet et dit où il en est. La vérité est sur GitHub, lue par project-tracker toutes les 10 minutes."],
      ['git', 'Branche courante, fichiers modifiés, commits en avance ou en retard.'],
      ['dépendances', 'Paquets npm et pip dépassés, par projet.'],
      ['système', 'Mises à jour dnf, séparées entre sûres et risquées (redémarrage).'],
      ['docker', 'Images du stack média plus récentes que celles installées.'],
    ],
  },
  automatisations: {
    title: 'automatisations',
    intro: 'Ce que la maison fait toute seule, et les routines qu’on lance d’un geste. Chacune se compose de blocs.',
    points: [
      ['quand', 'Le déclencheur : une heure, un intervalle, une alerte, une ressource qui dépasse un seuil, un téléchargement fini, une demande, un événement de l’agenda, une session Claude, un service, la TV, les lumières, un événement envoyé par un script… ou « à la main » pour une routine.'],
      ['si', 'Des conditions facultatives, « toutes » ou « au moins une », chacune inversable avec « pas ». Si un appareil ne répond pas, on ne sait pas : dans le doute, rien ne se lance, ni « alors » ni « sinon ».'],
      ['alors / sinon', 'Les actions dans l’ordre ; la branche « sinon » tourne quand les conditions ne sont pas remplies. Par action : continuer ou arrêter la suite si elle échoue, et réessayer.'],
      ['demander à lyra', 'Écris une commande (« allume la télé »), touche « analyser » : Lyra montre l’outil qu’elle utiliserait, et c’est cet appel précis qui est enregistré. Une phrase par action ; seules les commandes TV, lumières, ampli et diffusion passent, jamais une action qui demande une confirmation.'],
      ['messages', 'Les notifications acceptent des variables : {titre} (ce qui a déclenché), {heure}, {jour}, {nom}… Le compte rendu de chaque passage est réglable : quand, où, et avec quel texte.'],
      ['diagramme', 'L’éditeur a deux vues sur la même automatisation : « blocs » (formulaire) et « diagramme » (le flux de gauche à droite, on touche un bloc pour le régler).'],
      ['passages', 'Touche une automatisation : son diagramme se colore d’après le passage choisi, détaillé étape par étape (durée, essais, erreur).'],
      ['agenda', 'Les automatisations horaires apparaissent dans l’agenda, avec le résultat de chaque passage.'],
    ],
    tip: '« essayer » lance les actions tout de suite, sans regarder ni le déclencheur ni les conditions.',
  },
  lumiere: {
    title: 'lumière 3d',
    intro: 'Des effets de lumière pensés dans l’espace : une forme se déplace dans la pièce, et chaque lampe prend ce qui passe là où elle est.',
    points: [
      ['lieux', '« ma pièce » montre tes vraies lampes, à leur place du plan. Les deux autres sont des scènes simulées, fixes, pour voir un effet avec bien plus de lumières.'],
      ['point source', 'Beaucoup d’effets partent d’un point : l’onde de choc, le phare, le raz de marée. Glisse la boule dorée dans la scène, glisse la flèche au-dessus pour sa hauteur, double-clique sur le sol pour l’y poser, ou règle-le aux curseurs.'],
      ['respiration', '« respiration et intensité » vaut pour toutes les scènes : l’intensité, puis la vitesse à laquelle la lumière arrive et repart sur chaque temps. En 3d s’ajoute la force de la respiration. Le reste est dans « réglages fins ».'],
      ['pad', 'Chaque touche est une scène : des effets superposés et leurs réglages. « garder comme scène » ajoute les réglages en cours au pad.'],
      ['musique', 'Si huebeat tourne, tout est calé sur les temps qu’il détecte dans la musique. Sinon, le tempo se règle ici, au curseur ou en le tapant.'],
      ['vraies lampes', 'Le grand bouton « lancer sur les vraies lampes » fait tout d’un geste : il démarre huebeat (une dizaine de secondes) puis joue la scène en cours dans la pièce. Le retoucher arrête tout.'],
      ['2d ou 3d', 'Dans « réglages de la scène » : en 2d toutes les lampes réagissent d’un coup sur le temps (ensemble, ou une sur deux en alternance) ; en 3d la lumière voyage depuis le point source, donc une lampe éloignée s’allume plus tard.'],
      ['blocs', 'Chaque bloc se replie d’un clic sur son titre, pour ne garder ouverts que ceux qui te servent.'],
      ['rien à suivre', 'Les lampes ne s’allument que si la détection prend des temps : en silence, ou si la sensibilité est trop basse pour la musique, elles s’éteignent en fondu et se rallument au premier temps pris. L’horloge comble seule jusqu’à huit temps manqués.'],
      ['réglages', 'Chaque réglage a sa légende ; passe la souris sur « voir l’effet » pour le regarder aller du minimum au maximum sur une lampe témoin.'],
      ['pad', 'Une touche se renomme, se déplace (flèches) et se met à jour ; la palette « libre » lui donne tes propres couleurs.'],
      ['ce que huebeat entend', 'Dans « musique », sous la sensibilité : chaque barre est un instant de musique, la ligne rose le seuil à dépasser, les barres dorées les temps pris. Bouge la sensibilité et regarde la ligne monter ou descendre.'],
      ['sensibilité automatique', 'Le bouton « auto » à côté de la sensibilité laisse huebeat chercher seul le seuil où les coups ressortent : il le baisse quand plus rien n’est pris, le remonte quand tout passe. Utile sur une musique irrégulière.'],
      ['tempo suivi', '« tempo suivi sur » choisit ce que huebeat écoute : le son joué sur une sortie (télé, casque) ou un micro. Changer pendant que les lampes jouent relance huebeat dessus.'],
      ['durée d’une pulsation', 'Dans « respiration et intensité » : une pulsation peut durer un temps (un flash) jusqu’à deux mesures (une vague qui monte puis repart). « arrive » et « repart » se partagent cette durée.'],
      ['aperçu et pause', '« aperçu de l’animation » joue la scène sur la pièce 3d, au tempo réglé ici. « pause » la fige ; en direct, elle fige aussi les vraies lampes, et la reprise retombe sur le temps de la musique.'],
      ['chaque effet à part', 'Dans « réglages de la scène », chaque effet d’une touche a son panneau : couleurs, intensité, point source, respiration et tempo propres (de quatre fois plus lent à deux fois plus vite). Ce qui n’est pas coché suit la scène. Exemple dans « vague de fond » : une marée lente sous une source mobile qui respire.'],
      ['sets', '« enregistrer un set » retient ce que tu joues au pad et combien de mesures dure chaque scène. « lancer » le rejoue.'],
    ],
    tip: 'Un set n’avance que tant que cet écran reste ouvert : c’est lui qui passe d’une scène à la suivante.',
  },
  camera: {
    title: 'caméra',
    intro: 'Ta webcam passe par neutroncore : tu y es détouré et posé sur un autre fond, et les applications de visio voient le résultat comme une caméra ordinaire.',
    points: [
      ['allumer', '« allumer » ouvre la webcam et alimente la caméra virtuelle. Dans l’application de visio, choisis « OBS Virtual Camera ». « éteindre » rend la webcam.'],
      ['veille', '« mettre en veille » remplace ton image par une carte d’attente : la caméra reste allumée pour la visio, mais on ne te voit plus.'],
      ['fond', 'Caméra telle quelle, ton vrai décor flouté, un fond préfait, ou une image ou une vidéo que tu importes. Le changement est immédiat.'],
      ['détourage', '« durcissement » règle le bord (doux ou net), « marge » rogne ou élargit le contour, « stabilité » calme le scintillement. L’aperçu montre l’effet en direct.'],
    ],
    tip: 'Sans fond de remplacement, rien n’est détouré et la carte graphique n’est pas sollicitée.',
  },
  atelier: {
    title: 'atelier 3d',
    intro: 'Les pièces du projet de modélisation : la vue 3D, les contrôles, les itérations de la boucle d’agents et ce qu’il faut acheter.',
    points: [
      ['vue 3d', 'Glisser pour tourner, molette ou pincer pour zoomer, clic droit ou deux doigts pour déplacer. « cadrer » recentre sur la sélection : on tourne alors autour d’elle.'],
      ['pièces', 'Trois états : affichée, fantôme (on devine la pièce) et cachée. Touche une pièce dans la vue pour la régler sur place, ou règle une famille entière (les vis, les cales) dans la liste.'],
      ['sélection', 'Dans la liste, chaque nom touché rejoint la sélection ; Maj + clic prend toute la plage, « toutes » une famille entière. Dans la vue : Ctrl, Maj ou « sélection multiple ». « focus » garde la sélection nette et passe le reste en fantôme.'],
      ['éclaté', 'Le curseur écarte les pièces, de presque rien à très loin. « éclater autour » garde la sélection en place et écarte ses voisines. Coupe par un plan, arêtes et mesure sont dans « réglages ».'],
      ['contrôles', 'Le bandeau donne les décomptes ; déplié, il explique d’abord ce qui est à corriger, en clair, avec « voir la pièce » et « demander la correction ». La liste complète et le détail du calcul restent accessibles.'],
      ['itérations', 'Chaque itération garde son verdict et la demande qui l’a lancée. Écris une demande, avec les pièces sélectionnées et des itérations en référence si tu veux. La conversation avec les agents vit dans la languette « boucle », sur le flanc droit.'],
      ['matériaux', 'Les pièces à acheter, avec un indice de prix et un nom à copier dans une recherche. L’impression n’est pas comptée.'],
      ['montage', 'Un geste par carte, avec son image. Le geste choisi se rejoue en boucle dans la vue : pause, 0,5 ×, 1 ×, 2 ×. « vidéo de montage » filme toute la notice, « vidéo de présentation » un film de l’objet fini.'],
      ['projets', '« nouveau projet » crée un projet vide à concevoir. « retirer… » demande deux fois : le retirer de l’atelier seulement, ou déplacer aussi ses fichiers dans une corbeille.'],
    ],
    tip: 'La demande précise toute seule les pièces sélectionnées : sélectionne les deux pièces d’une jonction avant d’écrire.',
  },
  plan: {
    title: 'plan de pièce',
    intro: 'La pièce vue de dessus : où sont les lampes, la TV et le ruban LED. C’est le plan que HALO utilise.',
    points: [
      ['déplacer', 'Glisse une lampe pour la replacer. Un carreau fait un mètre.'],
      ['ruban led', 'Glisse le ruban : il se déplace d’un bloc. Touche un segment pour régler son angle, ou le replacer seul.'],
      ['vue 3d', 'Le bouton « 3d » montre la pièce en volume. Glisse le fond pour tourner autour, glisse une lampe de haut en bas pour régler sa hauteur.'],
      ['hauteur', 'Touche une lampe : le curseur règle sa hauteur depuis le sol.'],
      ['enregistrer', 'Rien n’est écrit avant « enregistrer ». HALO recharge le plan tout seul.'],
      ['halo', 'Associer l’Ambilight aux lampes Hue, voir les couleurs de la TV en direct, ouvrir HALO sur le PC.'],
    ],
    tip: 'Le ruban se règle ici segment par segment (hauteur, angle, longueur, ajout, retrait) ; « reprendre le découpage du ruban hue » lui donne ses vrais segments. La TV se règle dans HALO.',
  },
  ambiance: {
    title: 'ambiance',
    intro: 'La maison : lumières, TV, home cinéma, écrans et scènes.',
    points: [
      ['scènes', 'Les carrés montrent un aperçu des couleurs et leur position dans la pièce.'],
      ['lumières', 'Cliquer une ampoule la bascule ; le curseur règle son intensité.'],
      ['tv et denon', 'Alimentation, volume, source, Ambilight. Le volume TV est redirigé vers le Denon.'],
      ['télécommande', 'Flèches, validation, lecture, applications et entrée de l’ampli. Un clic dans la carte active les flèches du clavier.'],
      ['iron man', 'La scène complète : trente-trois secondes de lumière et de son synchronisés.'],
    ],
  },
  lanceur: {
    title: 'lanceur',
    intro: 'Ouvrir un dossier ou un terminal Claude Code directement sur le PC.',
    points: [
      ['favoris', 'Les dossiers épinglés, modifiables depuis cette page.'],
      ['navigation', 'Parcourir l\'arborescence pour ajouter un nouveau favori.'],
      ['claude code', 'Ouvre un terminal dans le dossier choisi, session prête.'],
      ['halo', 'Lance l\'interface bureau, avec confirmation.'],
    ],
  },
  outils: {
    title: 'outils & vms',
    intro: 'Machines virtuelles, sauvegardes et raccourcis vers les interfaces web.',
    points: [
      ['services', 'Un clic démarre ou arrête un service pilotable, après confirmation.'],
      ['vms', 'État, stockage local ou externe, démarrage et arrêt.'],
      ['clone système', 'Duplique ton PC en VM. Mode léger par défaut : sans projets, modèles ni secrets.'],
      ['sauvegardes', 'Borg et Timeshift : dernière exécution, prochaine planifiée.'],
      ['liens', 'Accès direct à Plex, Radarr, Sonarr, qBittorrent et les autres.'],
    ],
    tip: 'Une VM sur disque externe est signalée : elle ne démarrera pas si le disque est débranché.',
  },
  tests: {
    title: 'tests',
    intro: 'Lancer les suites de test et lire leur résultat sans quitter l\'app.',
    points: [
      ['cibles', 'Cocher une ou plusieurs cibles, ou tout laisser vide pour tout lancer.'],
      ['synthèse', 'Chips colorées après chaque run : vert réussi, ambre à surveiller, rouge à corriger.'],
      ['sortie', 'Cliquer « sortie » affiche le détail complet du run.'],
      ['un à la fois', 'Les suites sont gourmandes : un seul run peut tourner.'],
    ],
    tip: 'Le smoke MCP tourne aussi tout seul chaque matin à 08h45.',
  },
  parametres: {
    title: 'paramètres',
    intro: "Tout ce qui change l'apparence et le comportement de l'app, gardé sur cet appareil.",
    points: [
      ['thèmes', 'Sept ambiances, quatre sombres et trois claires.'],
      ['affichage', 'Densité, écran de démarrage, posters dans les demandes.'],
      ['lyra', 'Mascottes, animations de notification, périphériques audio.'],
      ['démarrage', "Rejouer l'animation de lancement, ou revoir le tutoriel."],
    ],
  },
}
