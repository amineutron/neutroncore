import { useEffect, useState, type ReactNode } from 'react'
import { apiGet, apiPost, apiPut } from '../lib/api'
import { getSettings, saveSettings } from '../lib/settings'
import { Btn, Card, Chip } from './ui'

// Réglages de la capsule bureau (notification Quickshell des sessions Claude
// Code) : activation + 6 entrées personnalisables, chacune avec 5 exemples
// prêts à l'emploi et une valeur libre quand ça a un sens.

type NotifSettings = {
  enabled: boolean; accent: string; label: string; position: string
  style: string; open_ms: number; duration_ms: number; on_stop: boolean
  phone_enabled: boolean; phone_priority: number; phone_on_stop: boolean; phone_quiet: string
}
type PhoneInfo = { server: string; topic: string; configured: boolean }

const PRIORITIES: Preset<number>[] = [
  { v: 1, label: 'minimale', hint: 'sans son ni vibration' },
  { v: 2, label: 'basse', hint: 'discrète' },
  { v: 3, label: 'normale', hint: 'son par défaut' },
  { v: 4, label: 'haute', hint: 'son + vibration' },
  { v: 5, label: 'urgente', hint: 'passe le mode silencieux' },
]
const QUIETS: Preset<string>[] = [
  { v: '', label: 'jamais', hint: 'push à toute heure' },
  { v: '23:00-07:30', label: 'nuit', hint: '23:00 → 07:30' },
  { v: '22:00-08:00', label: 'nuit longue', hint: '22:00 → 08:00' },
  { v: '00:00-06:00', label: 'petites heures', hint: '00:00 → 06:00' },
  { v: '12:30-13:30', label: 'pause déjeuner', hint: '12:30 → 13:30' },
]

type Preset<T> = { v: T; label: string; hint: string }

const ACCENTS: Preset<string>[] = [
  { v: 'session', label: 'couleur de la fiche', hint: 'chaque session garde sa couleur (or par défaut)' },
  { v: '#f6c177', label: 'or', hint: 'accent neutroncore' },
  { v: '#eb6f92', label: 'rose', hint: 'très visible, même sur fond clair' },
  { v: '#82d69c', label: 'vert', hint: 'discret, « tout va bien »' },
  { v: '#6ea8fe', label: 'bleu', hint: 'froid, façon terminal' },
]
const LABELS: Preset<string>[] = [
  { v: '{repo} · attend ta réponse', label: 'dossier + état', hint: 'lyra · attend ta réponse' },
  { v: 'claude · {repo}', label: 'claude + dossier', hint: 'claude · lyra' },
  { v: '{name}', label: 'nom de la session', hint: 'Install sur VM' },
  { v: '{repo} ?', label: 'ultra court', hint: 'lyra ?' },
  { v: '{name} — {message}', label: 'nom + question', hint: 'Install sur VM — permission ?' },
]
const POSITIONS: Preset<string>[] = [
  { v: 'top-center', label: 'haut centre', hint: 'sous la barre, comme la simu' },
  { v: 'top-right', label: 'haut droite', hint: 'à côté des toasts classiques' },
  { v: 'bottom-center', label: 'bas centre', hint: 'au-dessus de la barre du bas' },
  { v: 'bottom-right', label: 'bas droite', hint: 'coin discret' },
  { v: 'center', label: 'centre écran', hint: 'impossible à rater' },
]
const STYLES: Preset<string>[] = [
  { v: 'glass', label: 'verre', hint: 'verre clair de la barre' },
  { v: 'dark', label: 'sombre', hint: 'surface sombre, texte clair' },
  { v: 'outline', label: 'contour', hint: 'transparent, bord à l’accent' },
  { v: 'accent', label: 'plein', hint: 'rempli de la couleur d’accent' },
  { v: 'minimal', label: 'minimal', hint: 'sombre, sans contour' },
]
const OPENS: Preset<number>[] = [
  { v: 0, label: 'jamais', hint: 'pilule seule, s’ouvre au survol' },
  { v: 1000, label: '1 s', hint: 'un coup d’œil' },
  { v: 1500, label: '1,5 s', hint: 'comme la simu' },
  { v: 4000, label: '4 s', hint: 'le temps de lire' },
  { v: -1, label: 'toujours ouverte', hint: 'carte dépliée en permanence' },
]
const DURATIONS: Preset<number>[] = [
  { v: 4000, label: '4 s', hint: 'furtif' },
  { v: 8000, label: '8 s', hint: 'par défaut' },
  { v: 15000, label: '15 s', hint: 'confortable' },
  { v: 30000, label: '30 s', hint: 'insistant' },
  { v: 0, label: 'jusqu’au clic', hint: 'reste tant que tu n’as pas cliqué' },
]

// Bloc repliable : chevron (plié ▸ / déplié ▾ dessiné en CSS) + catégorie ;
// le contenu s'affiche décalé sous la catégorie pour qu'on lise la hiérarchie.
function Fold({ open, onToggle, category, hint, children }: {
  open: boolean; onToggle: () => void; category: string; hint?: string; children: ReactNode
}) {
  return (
    <div className={`fold ${open ? 'open' : ''}`}>
      <button type="button" className="fold-head" onClick={onToggle} aria-expanded={open}>
        <span className="fold-chev" />
        <span className="fold-cat">{category}</span>
        {hint && <span className="fold-hint">{hint}</span>}
        <span className="fold-state">{open ? 'plier' : 'déplier'}</span>
      </button>
      {open && <div className="fold-body">{children}</div>}
    </div>
  )
}

function Presets<T extends string | number>({ title, presets, value, onPick, free }: {
  title: string; presets: Preset<T>[]; value: T; onPick: (v: T) => void
  free?: { placeholder: string; type?: 'text' | 'color'; parse: (s: string) => T | null }
}) {
  const [custom, setCustom] = useState('')
  const isPreset = presets.some((p) => p.v === value)
  return (
    <div className="cs-field" style={{ marginBottom: 12 }}>
      <span>{title}</span>
      <div className="notif-presets">
        {presets.map((p) => (
          <button type="button" key={String(p.v)} className={`notif-preset ${p.v === value ? 'on' : ''}`} onClick={() => onPick(p.v)} title={p.hint}>
            <b>{p.label}</b><i>{p.hint}</i>
          </button>
        ))}
      </div>
      {free && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 6 }}>
          <input
            type={free.type ?? 'text'} value={custom || (!isPreset ? String(value) : '')}
            placeholder={free.placeholder} onChange={(e) => setCustom(e.target.value)}
            style={free.type === 'color' ? { width: 34, height: 28, padding: 0 } : undefined}
          />
          <Btn sm onClick={() => { const v = free.parse(custom); if (v !== null) { onPick(v); setCustom('') } }}>utiliser</Btn>
          {!isPreset && <Chip tone="gold">valeur libre</Chip>}
        </div>
      )}
    </div>
  )
}

export function SessionNotifSettings() {
  const [s, setS] = useState<NotifSettings | null>(null)
  const [saved, setSaved] = useState('')
  const [browser, setBrowser] = useState(getSettings().sessionBrowserNotif)
  const [openAll, setOpenAll] = useState(false)
  const [openPhone, setOpenPhone] = useState(false)
  const [phone, setPhone] = useState<PhoneInfo | null>(null)

  useEffect(() => { apiGet<{ settings: NotifSettings; phone: PhoneInfo }>('/launcher/sessions/notif-settings').then((r) => { setS(r.settings); setPhone(r.phone) }).catch(() => setS(null)) }, [])

  async function patch(p: Partial<NotifSettings>) {
    if (!s) return
    const next = { ...s, ...p }
    setS(next)
    try {
      const r = await apiPut<{ settings: NotifSettings }>('/launcher/sessions/notif-settings', p)
      setS(r.settings); setSaved('enregistré'); setTimeout(() => setSaved(''), 1500)
    } catch (e) { setSaved(`échec : ${(e as Error).message}`) }
  }
  async function test() {
    try { await apiPost('/launcher/sessions/notif-test', {}); setSaved('capsule envoyée sur le PC') } catch (e) { setSaved(`échec : ${(e as Error).message}`) }
    setTimeout(() => setSaved(''), 2500)
  }
  async function phoneTest() {
    try { await apiPost('/launcher/sessions/phone-test'); setSaved('push envoyé au téléphone') } catch (e) { setSaved(`échec : ${(e as Error).message}`) }
    setTimeout(() => setSaved(''), 2500)
  }
  function toggleBrowser() {
    const v = !browser
    setBrowser(v); saveSettings({ sessionBrowserNotif: v })
  }

  return (
    <Card title="capsule de session" lite="notification sur le bureau du PC (barre quickshell)">
      <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 12 }}>
        Quand Claude attend ta réponse dans une session, une capsule apparaît sur le PC : pilule discrète
        qui respire, dépliée en carte au survol. Clic gauche = fenêtre de la session au premier plan, clic droit = fermer.
      </p>
      {!s && <span style={{ fontSize: 12, color: 'var(--faint)' }}>réglages indisponibles (API)…</span>}
      {s && (
        <>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 14 }}>
            <Btn sm solid={s.enabled} onClick={() => patch({ enabled: !s.enabled })}>{s.enabled ? 'capsule activée' : 'capsule désactivée'}</Btn>
            <Btn sm onClick={() => patch({ on_stop: !s.on_stop })}>{s.on_stop ? 'aussi quand la réponse est prête' : 'seulement quand Claude attend'}</Btn>
            <Btn sm onClick={test}>tester sur le PC</Btn>
            {saved && <Chip tone={saved.startsWith('échec') ? 'crit' : 'ok'}>{saved}</Chip>}
          </div>
          <div className="notif-summary">
            <Chip>couleur : {ACCENTS.find((p) => p.v === s.accent)?.label ?? String(s.accent)}</Chip>
            <Chip>libellé : {LABELS.find((p) => p.v === s.label)?.label ?? String(s.label)}</Chip>
            <Chip>{POSITIONS.find((p) => p.v === s.position)?.label ?? String(s.position)}</Chip>
            <Chip>style {STYLES.find((p) => p.v === s.style)?.label ?? String(s.style)}</Chip>
            <Chip>ouverture {OPENS.find((p) => p.v === s.open_ms)?.label ?? String(s.open_ms)}</Chip>
            <Chip>durée {DURATIONS.find((p) => p.v === s.duration_ms)?.label ?? String(s.duration_ms)}</Chip>
          </div>
          <Fold open={openAll} onToggle={() => setOpenAll((o) => !o)} category="personnalisation de la capsule" hint="6 réglages · 5 exemples chacun">
            <div>
          <Presets title="couleur d’accent" presets={ACCENTS} value={s.accent} onPick={(v) => patch({ accent: v })}
            free={{ placeholder: '#rrggbb', type: 'color', parse: (x) => (/^#[0-9a-f]{6}$/i.test(x) ? x.toLowerCase() : null) }} />
          <Presets title="libellé de la pilule ({repo} {name} {message})" presets={LABELS} value={s.label} onPick={(v) => patch({ label: v })}
            free={{ placeholder: 'ex : {repo} → {message}', parse: (x) => (x.trim() ? x.trim().slice(0, 60) : null) }} />
          <Presets title="position" presets={POSITIONS} value={s.position} onPick={(v) => patch({ position: v })} />
          <Presets title="style" presets={STYLES} value={s.style} onPick={(v) => patch({ style: v })} />
          <Presets title="ouverture automatique à l’arrivée" presets={OPENS} value={s.open_ms} onPick={(v) => patch({ open_ms: v })}
            free={{ placeholder: 'millisecondes', parse: (x) => (/^\d{1,5}$/.test(x) ? Number(x) : null) }} />
          <Presets title="durée d’affichage" presets={DURATIONS} value={s.duration_ms} onPick={(v) => patch({ duration_ms: v })}
            free={{ placeholder: 'millisecondes', parse: (x) => (/^\d{1,6}$/.test(x) ? Number(x) : null) }} />
            </div>
          </Fold>
        </>
      )}
      {s && (
        <div style={{ borderTop: '1px solid var(--line)', marginTop: 12, paddingTop: 12 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 8 }}>
            <b style={{ fontFamily: 'var(--mono)', fontSize: 12.5 }}>téléphone (push ntfy)</b>
            <Btn sm solid={s.phone_enabled} onClick={() => patch({ phone_enabled: !s.phone_enabled })}>{s.phone_enabled ? 'push activé' : 'push désactivé'}</Btn>
            <Btn sm onClick={() => patch({ phone_on_stop: !s.phone_on_stop })}>{s.phone_on_stop ? 'aussi quand la réponse est prête' : 'seulement quand Claude attend'}</Btn>
            <Btn sm onClick={phoneTest} disabled={!phone?.configured}>tester sur le téléphone</Btn>
          </div>
          <div className="notif-summary">
            <Chip tone={phone?.configured ? 'ok' : 'warn'}>{phone?.configured ? 'serveur configuré' : 'jeton ntfy absent'}</Chip>
            <Chip>priorité {PRIORITIES.find((p) => p.v === s.phone_priority)?.label ?? s.phone_priority}</Chip>
            <Chip>silence : {QUIETS.find((p) => p.v === s.phone_quiet)?.label ?? s.phone_quiet}</Chip>
          </div>
          <Fold open={openPhone} onToggle={() => setOpenPhone((o) => !o)} category="personnalisation du push téléphone" hint="priorité · heures de silence · abonnement">
            <div>
              <p style={{ fontSize: 11.5, color: 'var(--faint)', marginBottom: 10 }}>
                Sur le téléphone : app ntfy → « + » → topic <span className="mono" style={{ color: 'var(--gold)' }}>{phone?.topic}</span>,
                serveur <span className="mono" style={{ color: 'var(--gold)' }}>{phone?.server}</span>, identifiants du vault, livraison instantanée.
                Le clic sur la notification ouvre neutroncore directement sur la session.
              </p>
              <Presets title="priorité" presets={PRIORITIES} value={s.phone_priority} onPick={(v) => patch({ phone_priority: v })} />
              <Presets title="heures de silence" presets={QUIETS} value={s.phone_quiet} onPick={(v) => patch({ phone_quiet: v })}
                free={{ placeholder: 'HH:MM-HH:MM', parse: (x) => (/^\d\d:\d\d-\d\d:\d\d$/.test(x.trim()) ? x.trim() : null) }} />
            </div>
          </Fold>
        </div>
      )}
      <div style={{ borderTop: '1px solid var(--line)', marginTop: 10, paddingTop: 10 }}>
        <label className="cs-check">
          <input type="checkbox" checked={browser} onChange={toggleBrowser} />
          notification navigateur pour les sessions (utile sur le téléphone ; à couper sur le PC si la capsule est active)
        </label>
      </div>
    </Card>
  )
}
