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
  ambiance: {
    title: 'ambiance',
    intro: 'La maison : lumières, TV, home cinéma, écrans et scènes.',
    points: [
      ['scènes', 'Les carrés montrent un aperçu des couleurs et leur position dans la pièce.'],
      ['lumières', 'Cliquer une ampoule la bascule ; le curseur règle son intensité.'],
      ['tv et denon', 'Alimentation, volume, source, Ambilight. Le volume TV est redirigé vers le Denon.'],
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
