// Mises à jour de démonstration : quelques éléments de chaque source, relevé « il y a 40 min ».
// Les réglages et le relevé se modifient comme sur la vraie app, jusqu'au rechargement.
import type { MockHandler } from '../router'
import type { Item, Niveau, Reglages, SourceId, Tableau } from '../../lib/mises'

const ok = (detail: string, depot: string, digest = '') => ({ signature: 'verifiee' as const, detail, depot, origine: '', digest })
const secu = (niveau: Niveau, avis: string[] = [], cves: string[] = []) => ({ niveau, avis, cves })
const base = (p: Partial<Item> & Pick<Item, 'id' | 'source' | 'nom'>): Item => ({
  portee: p.source === 'dnf' || p.source === 'noyau' || p.source === 'firmware' ? 'systeme' : 'ordinateur',
  installe: null, disponible: null, ecart: 'correctif', retard_jours: null, securite: secu('aucune'),
  integrite: ok('', ''), proposition: { commande: '', action: null }, note: '', a_jour: false, en_retard: false, ...p,
})
const GPG = 'signature GPG des paquets controlee par dnf a l\'installation'

const ITEMS: Item[] = [
  base({ id: 'noyau:linux', source: 'noyau', nom: 'noyau linux', installe: '6.18.13-200.fc43', disponible: '6.18.14-200.fc43', retard_jours: 6, securite: secu('haute', ['FEDORA-2026-5286084b44'], ['CVE-2026-34078']),
    integrite: ok(GPG, 'updates'), note: 'redemarrage necessaire apres installation', redemarrage: true, en_retard: true,
    proposition: { commande: "sudo dnf upgrade --refresh 'kernel*' && systemctl reboot", action: null } }),
  base({ id: 'dnf:uv', source: 'dnf', nom: 'uv', installe: '0.12.9-1.fc43', disponible: '0.12.19-1.fc43', retard_jours: 19, securite: secu('haute', ['FEDORA-2026-056196047a'], ['CVE-2026-19445']),
    integrite: ok(GPG, 'updates'), proposition: { commande: 'sudo dnf upgrade uv', action: null }, en_retard: true }),
  base({ id: 'dnf:libnbd', source: 'dnf', nom: 'libnbd', installe: '1.24.2-1.fc43', disponible: '1.24.3-1.fc43', retard_jours: 81, securite: secu('basse', ['FEDORA-2026-045e6f85c6'], ['CVE-2026-62268']),
    integrite: ok(GPG, 'updates'), proposition: { commande: 'sudo dnf upgrade libnbd', action: null }, en_retard: true }),
  base({ id: 'dnf:ImageMagick', source: 'dnf', nom: 'ImageMagick', installe: '1:7.1.2.31-1.fc43', disponible: '1:7.1.2.32-1.fc43', integrite: ok(GPG, 'updates'),
    proposition: { commande: 'sudo dnf upgrade ImageMagick', action: null } }),
  base({ id: 'dnf:outil-tiers', source: 'dnf', nom: 'outil-tiers', installe: '2.0-1', disponible: '2.1-1',
    integrite: { signature: 'desactivee', detail: 'gpgcheck=0 : les paquets de ce depot ne sont PAS verifies ; depot en http (non chiffre)', depot: 'tiers', origine: 'http://exemple.test/rpm', digest: '' },
    proposition: { commande: 'sudo dnf upgrade outil-tiers', action: null } }),
  base({ id: 'flatpak:com.discordapp.Discord', source: 'flatpak', nom: 'Discord', installe: '0.0.120', disponible: '0.0.131', integrite: ok('commit ostree signe, verifie par flatpak', 'flathub', 'd81518a37ec3'),
    note: 'com.discordapp.Discord', proposition: { commande: 'flatpak update com.discordapp.Discord', action: { type: 'flatpak', cible: 'com.discordapp.Discord' } } }),
  base({ id: 'docker:lscr.io/linuxserver/radarr:latest', source: 'docker', nom: 'radarr:latest', installe: 'a2b03d75aa16', disponible: '19a24b6ca209', ecart: 'inconnu',
    integrite: { signature: 'non_verifiee', detail: 'digest du manifeste compare au registre ; aucune signature d\'image (pas de content trust)', depot: 'lscr.io', origine: 'lscr.io/linuxserver/radarr:latest', digest: 'sha256:19a24b6ca209' },
    note: 'le conteneur garde l\'ancienne image jusqu\'a sa recreation (docker compose up -d)',
    proposition: { commande: 'docker pull lscr.io/linuxserver/radarr:latest', action: { type: 'docker', cible: 'lscr.io/linuxserver/radarr:latest' } } }),
  base({ id: 'docker:lscr.io/linuxserver/sonarr:latest', source: 'docker', nom: 'sonarr:latest', installe: '55ac0e11b2aa', ecart: 'aucun', a_jour: true,
    integrite: { signature: 'non_verifiee', detail: 'digest du manifeste compare au registre ; aucune signature d\'image (pas de content trust)', depot: 'lscr.io', origine: '', digest: 'sha256:55ac0e11b2aa' } }),
  base({ id: 'npm:global:@bitwarden/cli', source: 'npm', nom: '@bitwarden/cli', installe: '2026.1.0', disponible: '2026.10.0', ecart: 'majeur', en_retard: true, note: 'global',
    integrite: { signature: 'non_verifiee', detail: 'registre npm (https, integrite sha512 verifiee par npm)', depot: 'npmjs.org', origine: 'global', digest: '' },
    proposition: { commande: 'sudo npm install -g @bitwarden/cli@latest', action: null } }),
  base({ id: 'pip:lyra:requests', source: 'pip', nom: 'requests', installe: '2.32.0', disponible: '2.32.5', note: 'lyra',
    integrite: { signature: 'non_verifiee', detail: 'PyPI (https, hash verifies par pip)', depot: 'pypi.org', origine: 'lyra', digest: '' },
    proposition: { commande: 'cd lyra && .venv/bin/pip install -U requests', action: null } }),
]

const statut = (detail = '') => ({ statut: 'ok', detail })
const vide = { total: 0, a_jour: 0, en_retard: 0, a_mettre_a_jour: 0, securite: 0 }
let items = ITEMS
let reglages: Reglages = { seuil_jours: 14, sources: ['dnf', 'noyau', 'flatpak', 'docker', 'npm', 'pip', 'firmware'], projets: null }
let releve = Math.floor(Date.now() / 1000) - 2400

function vue(): Tableau {
  const seuil = reglages.seuil_jours
  const fin = items.map((i) => ({ ...i, en_retard: i.en_retard || (i.retard_jours ?? 0) >= seuil }))
  const par = {} as Tableau['resume']['par_source']
  for (const s of ['dnf', 'noyau', 'flatpak', 'docker', 'npm', 'pip', 'firmware'] as SourceId[]) {
    const sel = fin.filter((i) => i.source === s)
    par[s] = { ...vide, total: sel.length, a_jour: sel.filter((i) => !i.disponible).length, en_retard: sel.filter((i) => i.en_retard).length,
      a_mettre_a_jour: sel.filter((i) => i.disponible).length, securite: sel.filter((i) => i.securite.niveau !== 'aucune').length,
      ...(s === 'firmware' ? { statut: 'ok', detail: 'aucune mise a jour proposee' } : statut()) }
  }
  return { releve_le: releve, items: fin, en_cours: false, reglages, resume: { par_source: par, a_mettre_a_jour: fin.filter((i) => i.disponible).length,
    en_retard: fin.filter((i) => i.en_retard).length, securite: fin.filter((i) => i.securite.niveau !== 'aucune').length,
    critiques: fin.filter((i) => ['haute', 'critique'].includes(i.securite.niveau)).length, redemarrage: fin.some((i) => i.redemarrage) } }
}

export const mises: [string, string, MockHandler][] = [
  ['GET', '/maj', () => vue()],
  ['POST', '/maj/releve', () => { releve = Math.floor(Date.now() / 1000); return { statut: 'lance' } }],
  ['GET', '/maj/reglages', () => ({ ...reglages, decouverts: ['lyra', 'neutroncore', 'worldmonitor'], sources_possibles: ['dnf', 'noyau', 'flatpak', 'docker', 'npm', 'pip', 'firmware'] })],
  ['PUT', '/maj/reglages', ({ body }) => { reglages = { ...reglages, ...(body as Partial<Reglages>) }; return reglages }],
  ['POST', '/maj/appliquer', ({ body }) => {
    const cible = (body as { cible?: string })?.cible
    items = items.map((i) => (i.proposition.action?.cible === cible ? { ...i, disponible: null, a_jour: true, en_retard: false, proposition: { ...i.proposition, action: null } } : i))
    return { statut: 'ok', commande: 'demo', sortie: [] }
  }],
]
