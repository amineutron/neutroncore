// Textes pedagogiques des pastilles « ? » du hub des VMs. Donnees pures (vmHelp.test.ts verifie
// la forme) : chaque entree explique un champ ou un concept en phrases courtes.

export type HelpEntry = { t: string; p: string[]; table?: { head: string[]; rows: string[][] } }

export type CpuModel = { id: string; speed: number; move: number; compat: number; text: string }
export const LEVEL = ['', 'faible', 'limitée', 'moyenne', 'bonne', 'maximale'] as const

export const CPU_MODELS: CpuModel[] = [
  { id: 'host-passthrough', speed: 5, move: 1, compat: 5, text: 'La machine voit exactement le processeur réel de l\'hôte, avec toutes ses instructions (AVX2 et autres). C\'est le plus rapide, et le seul qui permette une virtualisation dans la VM (KVM imbriqué). En contrepartie la VM est liée à ce processeur : une archive importée sur un autre PC, ou un snapshot avec mémoire, peut refuser de démarrer.' },
  { id: 'host-model', speed: 4, move: 3, compat: 5, text: 'libvirt choisit le modèle nommé le plus proche de ton processeur et fige la liste de ses fonctions dans la configuration. Presque aussi rapide que le passthrough, et plus tolérant si la machine qui héberge la VM change un peu (même famille de processeurs).' },
  { id: 'x86-64-v2', speed: 3, move: 4, compat: 3, text: 'Profil générique d\'instructions courantes depuis ~2009 (SSE4.2). Il fonctionne sur presque tous les PC récents, avec une légère perte de vitesse. Bon choix pour une VM d\'examen exportée vers des ordinateurs que tu ne connais pas.' },
  { id: 'qemu64', speed: 2, move: 5, compat: 1, text: 'Processeur virtuel générique et très ancien : la VM se déplace n\'importe où. Mais sans les instructions modernes, elle est plus lente, et des distributions ou logiciels récents peuvent refuser de démarrer ou mal tourner. À réserver aux cas de compatibilité extrême.' },
]

export const HELP: Record<string, HelpEntry> = {
  kinds: { t: 'Les quatre types de machines', p: [
    'La couleur et la forme disent d\'où vient une machine et ce qu\'elle partage avec les autres.',
    'Modèle : base figée, en lecture seule, qui ne démarre pas.',
    'Clone lié (COW) : ne contient que ses différences avec la base.',
    'Copie intégrale : copie complète, indépendante.',
    'Autonome : installée de zéro, sans parent.'] },
  tpl: { t: 'Modèle', p: [
    'Machine figée qui sert de point de départ. Elle ne démarre plus : la lancer écrirait sur son disque et casserait les clones liés qui s\'appuient dessus.',
    'Pour la mettre à jour, redeviens machine normale (possible seulement s\'il n\'y a plus de clone lié), mets à jour, puis reconvertis en modèle.'] },
  cow: { t: 'Clone lié (COW)', p: [
    'Copy-On-Write : le clone ne copie pas le disque. Il garde un petit fichier de différences posé sur le disque du modèle, qui reste en lecture seule. Ce que la machine n\'a pas modifié est lu directement dans le modèle.',
    'Avantages : création en une seconde, quelques centaines de Mo au lieu de dizaines de Go. Dix clones coûtent une base et dix petits fichiers.',
    'Limites : tant qu\'un clone existe, on ne peut ni supprimer ni modifier son modèle. Si le disque du modèle est perdu, tous les clones le sont aussi. « Rendre indépendante » transforme un clone lié en copie intégrale.',
    'Idéal pour : TP identiques, essais jetables.'] },
  copy: { t: 'Copie intégrale', p: [
    'Le disque est copié octet par octet. La nouvelle machine ne dépend plus de la source.',
    'Avantages : tu peux supprimer ou modifier la source, déplacer la machine, l\'exporter seule.',
    'Limites : elle prend la taille complète du disque utilisé, et la copie prend du temps.',
    'Idéal pour : une machine qu\'on garde longtemps, une VM d\'examen, un état qu\'on veut figer.'] },
  own: { t: 'Machine autonome', p: ['Installée depuis une ISO ou une image : aucun lien avec une autre machine. Elle peut avoir ses snapshots, être clonée, ou devenir un modèle.'] },
  'clone-type': { t: 'Clone lié ou copie intégrale', p: [
    'Le clone lié est instantané et léger, mais il dépend du disque de la machine d\'origine. La copie intégrale est plus lente et plus lourde, mais indépendante.'] },
  prov: { t: 'Provenance', p: [
    'La chaîne complète d\'où vient la machine, de la plus ancienne source à elle.',
    'Trait plein : clone lié. Trait pointillé : copie intégrale, image ou archive.',
    'Elle est conservée même si un ancêtre est supprimé : il apparaît alors barré.'] },
  profile: { t: 'Profil normal ou examen', p: [
    'Un repère qui choisit le mode d\'export proposé par défaut.',
    'Normal : l\'archive est assainie à fond (comptes supprimés), pour partager sans rien laisser fuiter.',
    'Examen : on garde les comptes et privilèges pour que la machine soit prête à l\'emploi chez l\'étudiant ; seuls les identifiants propres à la machine sont régénérés.'] },
  'export-modes': { t: 'Modes d\'export', p: [
    'classic (normal) : supprime comptes, mots de passe, trousseaux et clés ssh. Un script de premier démarrage recrée l\'utilisateur et le mot de passe root.',
    'exam (examen) : garde comptes et privilèges, assainit machine-id, clés d\'hôte ssh, réseau et journaux.',
    'Dans tous les cas : test avant l\'export (disque intègre, assez de place) et test après (archive valide). La machine doit être éteinte.'] },
  import: { t: 'Importer une archive', p: ['Recrée une machine depuis une archive d\'export. Un nouvel identifiant (UUID) et une nouvelle adresse MAC sont générés pour éviter tout conflit avec la machine d\'origine.'] },
  state: { t: 'Pause, arrêt, arrêt forcé', p: [
    'Pause : le processeur est suspendu, la mémoire reste. Reprise instantanée, mais la RAM reste occupée.',
    'Arrêt : demande propre au système, comme « éteindre ». Libère tout.',
    'Forcer : coupure brutale, comme débrancher la machine. Des fichiers peuvent être corrompus.'] },
  'cpu-graph': { t: 'Activité en direct', p: ['Utilisation du processeur et de la mémoire. Une mémoire qui monte vers 80 % est normale : le système invité garde du cache.'] },
  'disk-qcow2': { t: 'Taille et espace utilisé', p: [
    'Le disque est un fichier qcow2 « à la demande » : sa taille maximale (ex. 40 Go) est fixée, mais il n\'occupe sur l\'hôte que ce qui a vraiment été écrit. Supprimer un fichier dans la VM ne réduit pas toujours le fichier côté hôte.',
    'Un clone lié n\'affiche que ses différences.'] },
  autostart: { t: 'Démarrage avec l\'hôte', p: ['La machine démarre automatiquement quand le PC s\'allume. À réserver aux services qui doivent toujours tourner : chaque VM occupe sa mémoire dès le démarrage.'] },
  'hw-vcpu': { t: 'vCPU', p: ['Nombre de cœurs virtuels vus par la machine. Plus n\'est pas toujours mieux : ce sont des threads de l\'hôte, et si la somme des VM en marche dépasse les cœurs de l\'hôte, elles se disputent le processeur. 2 à 4 suffisent pour la plupart des usages.'] },
  'hw-ram': { t: 'Mémoire', p: ['Réservée à la VM tant qu\'elle tourne. La somme des VM démarrées doit rester sous la mémoire de l\'hôte, sinon le démarrage est refusé. Changer la mémoire d\'une VM en marche demande un redémarrage.'] },
  'hw-disk': { t: 'Taille du disque', p: ['On peut agrandir, jamais réduire : réduire un disque risque de couper des données. Après l\'agrandissement, il faut aussi étendre la partition et le système de fichiers dans la VM (growpart, puis resize2fs ou xfs_growfs).'] },
  'cpu-model': { t: 'Modèle de processeur', p: [
    'Il décide quel processeur la machine croit avoir. Un modèle précis donne la vitesse, un modèle générique donne la portabilité.',
    'Pour tes VM locales : host-passthrough. Pour une VM d\'examen exportée vers d\'autres PC : x86-64-v2, voire qemu64 si tu vises de vieilles machines.'],
    table: { head: ['modèle', 'vitesse', 'déplaçable', 'logiciels'], rows: CPU_MODELS.map((c) => [c.id, LEVEL[c.speed], LEVEL[c.move], LEVEL[c.compat]]) } },
  'hw-fw': { t: 'Firmware : BIOS ou UEFI', p: ['Le programme de démarrage de la machine virtuelle. UEFI est le standard actuel : requis pour Secure Boot et recommandé pour tout système récent. BIOS (héritage) ne sert que pour de très vieux systèmes.', 'Changer après l\'installation peut empêcher le démarrage.'] },
  'hw-sb': { t: 'Secure Boot', p: ['Vérifie que le chargeur et le noyau sont signés avant de démarrer. Fedora, Ubuntu et Debian le gèrent ; un noyau ou des modules maison non signés seront refusés. Nécessite UEFI. Windows 11 le demande, avec le TPM.'] },
  'hw-tpm': { t: 'TPM 2.0 émulé', p: ['Puce de sécurité virtuelle. Windows 11 en a besoin ; sous Linux elle sert à chiffrer le disque avec déverrouillage automatique. Son état est un fichier à part : à ne pas oublier quand on déplace la machine.'] },
  'hw-boot': { t: 'Ordre de démarrage', p: ['La machine essaie le premier périphérique, puis le suivant. « disque » en premier une fois le système installé, « cdrom » pour lancer une ISO d\'installation, « réseau » pour un démarrage PXE.'] },
  'hw-net': { t: 'Réseau', p: [
    'nat : la VM sort sur Internet via l\'hôte et reçoit une adresse privée, invisible depuis le reste du réseau local.',
    'pont : la VM prend une adresse du réseau local comme un vrai PC, visible par les autres appareils.',
    'isolé : aucune sortie vers Internet ni vers le réseau local. Idéal pour un examen ou pour étudier un programme suspect.'] },
  'hw-mac': { t: 'Adresse MAC', p: ['Identifiant de la carte réseau virtuelle. Deux machines avec la même MAC sur un même réseau se perturbent : elle est régénérée à chaque clone et import.'] },
  'hw-display': { t: 'Affichage : spice ou vnc', p: ['SPICE est conçu pour les VM : presse-papiers partagé, redimensionnement automatique, audio, redirection USB.', 'VNC est plus simple et universel, utilisable avec n\'importe quel client, mais sans ces conforts.'] },
  'hw-usb': { t: 'Périphériques USB', p: ['Un périphérique de l\'hôte peut être donné à la VM : elle le voit comme branché dessus, et l\'hôte ne l\'a plus tant qu\'il est attribué.'] },
  'snap-what': { t: 'Snapshots et arbre', p: [
    'Un snapshot est un point de retour : tu peux revenir à l\'état du disque (et de la mémoire si tu l\'as demandé) à cet instant.',
    'Ils forment un arbre : si tu reviens en arrière puis crées un nouveau snapshot, il ouvre une nouvelle branche sans écraser l\'ancienne. Chaque couleur est une branche.',
    '« maintenant » est l\'état en cours, pas encore sauvegardé.'] },
  'snap-ram': { t: 'Disque seul ou avec mémoire', p: [
    'Disque seul : photo des fichiers, comme après une coupure de courant. Rapide et léger ; la VM redémarre proprement après la restauration.',
    'Avec mémoire : on sauvegarde aussi la RAM et les programmes ouverts. La restauration reprend exactement où on était, mais le snapshot est plus gros et dépend du modèle de processeur.'] },
  'snap-now': { t: 'Vous êtes ici', p: ['Le snapshot dont l\'état actuel dérive. Si tu as modifié des fichiers depuis, « maintenant » affiche « modifié » : restaurer annule ces modifications.'] },
  'snap-branch': { t: 'Nouvelle branche ici', p: ['Restaure d\'abord ce snapshot, puis crée un nouveau snapshot à partir de là. L\'ancienne suite reste intacte, à côté : utile pour tester deux configurations à partir du même point.'] },
  'snap-delete': { t: 'Supprimer un snapshot', p: ['Supprime seulement ce point de retour. Ceux qui en dépendaient sont rattachés à son parent : rien d\'autre ne disparaît. Une racine qui porte plusieurs branches ne peut pas être supprimée.'] },
  'lib-fmt': { t: 'Trois façons d\'obtenir un système', p: [
    'ISO d\'installation : un installateur à dérouler. Le plus flexible, le plus long (10 à 15 min).',
    'Image prête (qcow2) : un disque déjà installé, configuré au premier démarrage par cloud-init. Prête en ~30 s.',
    'virt-builder : un outil qui assemble l\'image à la demande et y injecte mot de passe root, clé ssh et nom d\'hôte. Prête en ~1 min.'] },
  'lib-search': { t: 'Recherche dans la bibliothèque', p: ['La liste se met à jour à chaque lettre. Plusieurs mots se cumulent : « debian kde » ne garde que les éditions qui contiennent les deux. La recherche porte sur le nom, l\'édition, l\'interface, les étiquettes et la description.'] },
  env: { t: 'Mon environnement', p: [
    'Applique sur la nouvelle machine ce que tu as sur ton PC : barre, raccourcis, terminal, lanceur et quelques outils. Les réglages sont copiés depuis tes dotfiles de l\'hôte (lecture seule, rien n\'est modifié chez toi).',
    'La barre, les raccourcis et le lanceur demandent une interface graphique : désactivés sur les éditions serveur. Hyprland a besoin d\'accélération graphique ; dans une VM il tourne en mode logiciel ou virtio-gpu, donc moins fluide que sur ton PC.',
    'Sur une image cloud, c\'est appliqué au premier démarrage. Sur une ISO, par un script lancé après l\'installation.'] },
  tasks: { t: 'Tâches', p: [
    'Toute action longue (export, import, clone, restauration, installation) devient une tâche nommée, avec ses étapes et son journal. Tu la suis ici, depuis la pastille en bas à droite, ou depuis la machine concernée.',
    'Elles apparaissent aussi dans l\'écran des tâches de fond.'] },
  'res-panel': { t: 'Répartition par machine', p: ['Qui consomme quoi sur l\'hôte : mémoire et vcpu réservés par les machines en marche, espace disque réellement utilisé (un clone lié ne compte que ses différences), ou charge processeur. La barre du haut montre la part de chaque machine par rapport à la capacité de l\'hôte.'] },
  pool: { t: 'Espace de stockage', p: ['Place utilisée dans le dossier des disques par les machines et les archives. Un clone lié ne compte que pour ses différences.'] },
  savings: { t: 'Espace économisé', p: ['Ce qu\'il aurait fallu en plus si tes clones liés étaient des copies intégrales : la taille de la base moins les différences de chaque clone.'] },
}

export const helpOf = (key: string): HelpEntry | null => HELP[key] ?? null
