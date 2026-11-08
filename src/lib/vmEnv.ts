// « Mon environnement » : appliquer sur une nouvelle machine la barre, les raccourcis, le terminal,
// le lanceur et quelques outils de l'hote. Pur (vmEnv.test.ts) : la selection et les regles.
// L'application elle-meme se fait cote hote (dotfiles en lecture seule) quand l'outil existera.

export type EnvChoice = { bar: boolean; keys: boolean; launcher: boolean; term: boolean; tools: boolean }
export const ENV_TOOLS = ['git', 'neovim', 'ripgrep', 'fzf', 'btop'] as const
export const ENV_DEFAULT: EnvChoice = { bar: true, keys: true, launcher: true, term: true, tools: true }

/** Gestionnaire de paquets par distribution du catalogue. */
export const PACKAGE_MANAGER: Record<string, string> = {
  alpine: 'apk add', debian: 'apt install', ubuntu: 'apt install', kali: 'apt install',
  fedora: 'dnf install', rocky: 'dnf install', arch: 'pacman -S',
}

export const ENV_LABEL: Record<keyof EnvChoice, string> = {
  bar: 'barre', keys: 'raccourcis', launcher: 'lanceur', term: 'terminal', tools: 'outils',
}
const NEEDS_UI: (keyof EnvChoice)[] = ['bar', 'keys', 'launcher']

/** Choix effectif : barre, raccourcis et lanceur demandent une interface graphique. */
export function effectiveEnv(choice: EnvChoice, ui: boolean): EnvChoice {
  return ui ? { ...choice } : { ...choice, bar: false, keys: false, launcher: false }
}

export function envLabels(c: EnvChoice): string {
  return (Object.keys(ENV_LABEL) as (keyof EnvChoice)[]).filter((k) => c[k]).map((k) => ENV_LABEL[k]).join(', ')
}

/** Paquets a installer selon le choix effectif (nom des paquets, independant de la distribution). */
export function envPackages(c: EnvChoice): string[] {
  return [...(c.bar ? ['quickshell'] : []), ...(c.keys ? ['hyprland'] : []), ...(c.term ? ['kitty'] : []), ...(c.launcher ? ['wofi'] : []), ...(c.tools ? ENV_TOOLS : [])]
}

export function envCommand(c: EnvChoice, dist: string): string {
  const pk = envPackages(c)
  return pk.length ? `${PACKAGE_MANAGER[dist] ?? 'apt install'} ${pk.join(' ')}` : ''
}

/** Rien a appliquer : on n'ajoute alors aucune etape. */
export const envIsEmpty = (c: EnvChoice): boolean => !envLabels(c)

export const needsUi = (k: keyof EnvChoice): boolean => NEEDS_UI.includes(k)
