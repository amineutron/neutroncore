import { useEffect, useRef, useState } from 'react'
import { apiGet, apiPut, setApiKey } from '../lib/api'
import { getSettings, saveSettings, THEMES, type Settings } from '../lib/settings'
import { Mascot, MASCOTS } from '../components/Mascot'
import { Bar, Btn, Card, Chip, PageTitle, Eyebrow } from '../components/ui'
import { SessionNotifSettings } from '../components/SessionNotifSettings'

const ANIMS: { id: Settings['lyraAnim']; label: string; desc: string }[] = [
  { id: 'pulse', label: 'badge pulsé', desc: 'Le compteur bat sur la bulle (discret)' },
  { id: 'shake', label: 'secousse', desc: 'La bulle se dandine tant que non lu' },
  { id: 'ring', label: 'onde', desc: 'Des anneaux rose-or émanent de la bulle' },
  { id: 'toast', label: 'bandeau', desc: 'Un petit message glisse à côté de la bulle' },
]

function Toggle({ label, desc, value, onChange }: {
  label: string; desc: string; value: boolean; onChange: (v: boolean) => void
}) {
  return (
    <div className="light" style={{ cursor: 'pointer' }} onClick={() => onChange(!value)}>
      <span className="bulb" style={value ? { background: 'var(--gold)', boxShadow: '0 0 8px var(--gold-soft)' } : { background: 'var(--off)' }} />
      <span className="nm">{label}<br /><span style={{ fontSize: 11, color: 'var(--muted)' }}>{desc}</span></span>
      <span className="val">{value ? 'activé' : 'désactivé'}</span>
    </div>
  )
}

type LyraSettings = { voice: string; speaker_id: number; speed: number; voices: string[]; note: string }

function AudioSection() {
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([])
  const [level, setLevel] = useState(0)
  const [testing, setTesting] = useState(false)
  const stopRef = useRef<(() => void) | null>(null)
  const [s, setS] = useState(getSettings)
  const set = (patch: Partial<Settings>) => setS(saveSettings(patch))

  async function loadDevices() {
    try {
      // demande la permission pour obtenir les libellés
      const tmp = await navigator.mediaDevices.getUserMedia({ audio: true })
      tmp.getTracks().forEach((t) => t.stop())
      setDevices(await navigator.mediaDevices.enumerateDevices())
    } catch {
      setDevices([])
    }
  }
  useEffect(() => { loadDevices() }, [])
  useEffect(() => () => stopRef.current?.(), [])

  async function testMic() {
    if (testing) { stopRef.current?.(); return }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: s.audioInput ? { deviceId: { exact: s.audioInput } } : true,
      })
      const ctx = new AudioContext()
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 512
      ctx.createMediaStreamSource(stream).connect(analyser)
      const buf = new Uint8Array(analyser.frequencyBinCount)
      let raf = 0
      const tick = () => {
        analyser.getByteTimeDomainData(buf)
        let max = 0
        for (const v of buf) max = Math.max(max, Math.abs(v - 128))
        setLevel(Math.min(100, (max / 128) * 260))
        raf = requestAnimationFrame(tick)
      }
      tick()
      setTesting(true)
      stopRef.current = () => {
        cancelAnimationFrame(raf)
        stream.getTracks().forEach((t) => t.stop())
        ctx.close()
        setTesting(false)
        setLevel(0)
        stopRef.current = null
      }
    } catch {
      window.alert('Micro inaccessible — vérifie les permissions du navigateur.')
    }
  }

  async function testOutput() {
    const ctx = new AudioContext()
    const dest = ctx.createMediaStreamDestination()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    gain.gain.value = 0.15
    osc.frequency.value = 660
    osc.connect(gain).connect(dest)
    const audio = new Audio()
    audio.srcObject = dest.stream
    const anyAudio = audio as HTMLAudioElement & { setSinkId?: (id: string) => Promise<void> }
    if (s.audioOutput && anyAudio.setSinkId) {
      try { await anyAudio.setSinkId(s.audioOutput) } catch { window.alert('Sortie configurée introuvable — son joué sur la sortie par défaut.') }
    }
    osc.start()
    audio.play()
    setTimeout(() => { osc.stop(); ctx.close() }, 600)
  }

  const inputs = devices.filter((d) => d.kind === 'audioinput' && d.deviceId !== 'default')
  const outputs = devices.filter((d) => d.kind === 'audiooutput' && d.deviceId !== 'default')

  return (
    <Card title="audio" lite="micro et sortie pour le mode vocal" style={{ marginTop: 14 }}>
      {devices.length === 0 && <Btn sm onClick={loadDevices}>autoriser et lister les périphériques</Btn>}
      {devices.length > 0 && (
        <>
          <div className="light">
            <span className="bulb" style={{ background: 'var(--gold)' }} />
            <span className="nm">entrée (micro)</span>
            <select value={s.audioInput} onChange={(e) => set({ audioInput: e.target.value })}
              style={{ maxWidth: 220, background: 'var(--surface2)', color: 'var(--text)', border: '1px solid var(--line2)', borderRadius: 6, padding: '4px 8px', fontFamily: 'var(--mono)', fontSize: 11 }}>
              <option value="">défaut système</option>
              {inputs.map((d) => <option key={d.deviceId} value={d.deviceId}>{d.label || 'micro'}</option>)}
            </select>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 2px' }}>
            <Btn sm solid={testing} onClick={testMic}>{testing ? 'arrêter le test' : 'tester le micro'}</Btn>
            <div style={{ flex: 1, maxWidth: 320 }}><Bar pct={level} tone={level > 70 ? 'warn' : undefined} /></div>
            <span className="num" style={{ fontSize: 11, color: 'var(--muted)', width: 34 }}>{Math.round(level)}</span>
          </div>
          <div className="light">
            <span className="bulb" style={{ background: 'var(--gold)' }} />
            <span className="nm">sortie (haut-parleurs)</span>
            <select value={s.audioOutput} onChange={(e) => set({ audioOutput: e.target.value })}
              style={{ maxWidth: 220, background: 'var(--surface2)', color: 'var(--text)', border: '1px solid var(--line2)', borderRadius: 6, padding: '4px 8px', fontFamily: 'var(--mono)', fontSize: 11 }}>
              <option value="">défaut système</option>
              {outputs.map((d) => <option key={d.deviceId} value={d.deviceId}>{d.label || 'sortie'}</option>)}
            </select>
          </div>
          <div style={{ padding: '8px 2px' }}><Btn sm onClick={testOutput}>tester la sortie (bip)</Btn></div>
          <p style={{ fontSize: 10.5, color: 'var(--faint)' }}>
            Si le périphérique choisi est absent à l'utilisation, Lyra te préviendra dans le chat et repassera sur le défaut système.
            Note : la dictée navigateur utilise l'entrée système ; ce choix sert aux tests et au futur pipeline vocal Lyra.
          </p>
        </>
      )}
    </Card>
  )
}

function LyraSection() {
  const [ls, setLs] = useState<LyraSettings | null>(null)
  const [q, setQ] = useState('')
  const [saved, setSaved] = useState('')

  useEffect(() => {
    apiGet<LyraSettings>('/lyra/settings').then(setLs).catch(() => setLs(null))
  }, [])

  async function save(patch: Partial<Pick<LyraSettings, 'voice' | 'speaker_id' | 'speed'>>) {
    const r = await apiPut<{ success: boolean }>('/lyra/settings', patch)
    if (r.success) {
      setLs((prev) => (prev ? { ...prev, ...patch } : prev))
      setSaved('enregistré')
      setTimeout(() => setSaved(''), 2500)
    }
  }

  if (!ls) return null
  const rows: { key: string; label: string; control: React.JSX.Element }[] = [
    {
      key: 'voix tts piper',
      label: 'voix (TTS Piper)',
      control: (
        <select value={ls.voice} onChange={(e) => save({ voice: e.target.value })}
          style={{ background: 'var(--surface2)', color: 'var(--text)', border: '1px solid var(--line2)', borderRadius: 6, padding: '4px 8px', fontFamily: 'var(--mono)', fontSize: 11 }}>
          {ls.voices.map((v) => <option key={v} value={v}>{v.replace('fr_FR-', '')}</option>)}
        </select>
      ),
    },
    {
      key: 'speaker locuteur voix',
      label: 'locuteur (speaker id)',
      control: (
        <input type="number" min={0} max={10} value={ls.speaker_id}
          onChange={(e) => save({ speaker_id: Number(e.target.value) })}
          style={{ width: 56, background: 'var(--surface2)', color: 'var(--text)', border: '1px solid var(--line2)', borderRadius: 6, padding: '4px 8px', fontFamily: 'var(--mono)', fontSize: 11 }} />
      ),
    },
    {
      key: 'vitesse parole speed',
      label: 'vitesse de parole',
      control: (
        <span style={{ display: 'flex', gap: 6 }}>
          {[0.8, 1.0, 1.2, 1.5].map((v) => (
            <button key={v} className={`btn sm ${Math.abs(ls.speed - v) < 0.01 ? 'solid' : ''}`} onClick={() => save({ speed: v })}>x{v}</button>
          ))}
        </span>
      ),
    },
  ].filter((r) => !q.trim() || r.key.includes(q.toLowerCase()) || r.label.includes(q.toLowerCase()))

  return (
    <Card title="lyra" lite="réglages du daemon vocal" style={{ marginTop: 14 }}>
      <div className="lyra-input" style={{ margin: '0 0 10px', padding: '5px 12px' }}>
        <input placeholder="chercher un réglage…" value={q} aria-label="Recherche réglage" onChange={(e) => setQ(e.target.value)} />
      </div>
      {rows.map((r) => (
        <div className="light" key={r.key}>
          <span className="bulb" style={{ background: 'var(--gold)' }} />
          <span className="nm">{r.label}</span>
          {r.control}
        </div>
      ))}
      {rows.length === 0 && <span style={{ fontSize: 12, color: 'var(--faint)' }}>Aucun réglage pour « {q} ».</span>}
      <p style={{ fontSize: 11, color: 'var(--faint)', marginTop: 8 }}>{saved || ls.note}</p>
    </Card>
  )
}

export function Parametres() {
  const [s, setS] = useState<Settings>(getSettings)
  const [fxPreview, setFxPreview] = useState(false)
  const set = (patch: Partial<Settings>) => setS(saveSettings(patch))

  function previewFx() {
    setFxPreview(true)
    setTimeout(() => setFxPreview(false), 3500)
  }

  return (
    <>
      <PageTitle help="parametres" title="paramètres" desc="Thème, affichage, notifications — tout est gardé sur cet appareil." />

      <Eyebrow>thème — 4 sombres, 3 clairs</Eyebrow>
      <div className="swatches" style={{ marginBottom: 20, gridTemplateColumns: 'repeat(7, 1fr)' }}>
        {THEMES.map((t) => (
          <div key={t.id} className="swatch" style={{ cursor: 'pointer', borderColor: s.theme === t.id ? 'var(--gold)' : undefined }}
            onClick={() => set({ theme: t.id })}>
            <div className="c" style={{ background: t.sw[0], display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
              <span style={{ width: 14, height: 14, borderRadius: '50%', background: `linear-gradient(120deg, ${t.sw[2]}, ${t.sw[1]})` }} />
            </div>
            <div className="l"><b>{t.label}</b>{t.dark ? 'sombre' : 'clair'}{s.theme === t.id ? ' · actif' : ''}</div>
          </div>
        ))}
      </div>

      <div className="grid g2">
        <Card tour="affichage" title="affichage">
          <Toggle label="posters dans les demandes" desc="Vignettes TMDB pendant la recherche de films/séries"
            value={s.posters} onChange={(v) => set({ posters: v })} />
          <Toggle label="densité compacte" desc="Espacements réduits — plus d'infos à l'écran"
            value={s.compact} onChange={(v) => set({ compact: v })} />
          <div className="light">
            <span className="bulb" style={{ background: 'var(--gold)' }} />
            <span className="nm">écran de démarrage</span>
            <select
              value={s.startScreen}
              onChange={(e) => set({ startScreen: e.target.value })}
              style={{ background: 'var(--surface2)', color: 'var(--text)', border: '1px solid var(--line2)', borderRadius: 6, padding: '4px 8px', fontFamily: 'var(--mono)', fontSize: 11 }}
            >
              {['accueil', 'films', 'demandes', 'dl', 'taches', 'projets', 'ambiance', 'lanceur', 'outils'].map((id) => (
                <option key={id} value={id}>{id}</option>
              ))}
            </select>
          </div>
        </Card>
        <Card title="comportement">
          <Toggle label="notifications navigateur" desc="Réponses Lyra quand le panneau est réduit ou l'app en fond"
            value={s.notifications} onChange={(v) => {
              set({ notifications: v })
              if (v && 'Notification' in window && Notification.permission === 'default') Notification.requestPermission()
            }} />
          <Toggle label="rafraîchissement éco" desc="Intervalles de polling x3 — moins de requêtes (batterie, Tailscale)"
            value={s.ecoPoll} onChange={(v) => set({ ecoPoll: v })} />
          <Toggle label="sessions claude code sur l'accueil" desc="Glyphes des sessions ouvertes — une mascotte y réagit en direct (travaille, attend, veille, fermeture)"
            value={s.homeSessions} onChange={(v) => set({ homeSessions: v })} />
          <div className="light" style={{ cursor: 'pointer' }}
            onClick={() => { if (window.confirm('Oublier la clé API sur cet appareil ?')) { setApiKey(''); location.reload() } }}>
            <span className="bulb" style={{ background: 'var(--crit)' }} />
            <span className="nm">déconnecter cet appareil<br /><span style={{ fontSize: 11, color: 'var(--muted)' }}>Efface la clé API du navigateur</span></span>
          </div>
        </Card>
      </div>

      <Card tour="mascottes" title="mascottes" lite="les modèles de lyra, en direct" style={{ marginTop: 14 }}>
        <Toggle label="afficher les mascottes" desc="Chaîne sur l'accueil + miniatures dans le chat, animées selon l'activité réelle"
          value={s.mascots} onChange={(v) => set({ mascots: v })} />
        {s.mascots && (
          <div className="light" style={{ marginTop: 4 }}>
            <span className="bulb" style={{ background: 'var(--gold)' }} />
            <span className="nm">vitesse d'animation</span>
            <span style={{ display: 'flex', gap: 6 }}>
              {[0.5, 1, 2, 3].map((v) => (
                <button key={v} className={`btn sm ${s.mascotSpeed === v ? 'solid' : ''}`} onClick={() => set({ mascotSpeed: v })}>
                  x{v}
                </button>
              ))}
            </span>
          </div>
        )}
        {s.mascots && (
          <div className="grid g2" style={{ marginTop: 12 }}>
            {(['fast', 'slow'] as const).map((kind) => {
              const on = kind === 'fast' ? s.mascotFastOn : s.mascotSlowOn
              const name = kind === 'fast' ? s.mascotFast : s.mascotSlow
              return (
                <div key={kind}>
                  <Toggle
                    label={kind === 'fast' ? 'petit modèle — lyra (rapide)' : 'grand modèle — ephaistos / hestia'}
                    desc={kind === 'fast' ? 'llama : dialogue et réactivité' : 'qwen coder : analyse et exécution des outils'}
                    value={on}
                    onChange={(v) => set(kind === 'fast' ? { mascotFastOn: v } : { mascotSlowOn: v })}
                  />
                  {on && (
                    <div style={{ display: 'flex', gap: 14, alignItems: 'center', padding: '10px 2px' }}>
                      <Mascot kind={kind} name={name} state="work" size={11} />
                      <select
                        value={name}
                        onChange={(e) => set(kind === 'fast' ? { mascotFast: e.target.value } : { mascotSlow: e.target.value })}
                        style={{ background: 'var(--surface2)', color: 'var(--text)', border: '1px solid var(--line2)', borderRadius: 6, padding: '5px 8px', fontFamily: 'var(--mono)', fontSize: 11 }}
                      >
                        {MASCOTS[kind].map((m) => <option key={m.name} value={m.name}>{m.name}</option>)}
                      </select>
                      <span style={{ fontSize: 11, color: 'var(--faint)' }}>{MASCOTS[kind].find((m) => m.name === name)?.role}</span>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </Card>

      <Card title="animation de notification lyra" lite="quand un message arrive et que le chat est fermé" style={{ marginTop: 14 }}>
        <div className="grid g2">
          {ANIMS.map((a) => (
            <div key={a.id} className="light" style={{ cursor: 'pointer' }} onClick={() => set({ lyraAnim: a.id })}>
              <span style={{ position: 'relative', width: 34, height: 34, flex: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span
                  className={`lyra-fab ${a.id === 'shake' ? 'anim-shake' : a.id === 'ring' ? 'anim-ring' : ''}`}
                  style={{ position: 'static', width: 30, height: 30, boxShadow: 'none' }}
                >
                  <span className="core" style={{ width: 13, height: 13 }} />
                  {a.id === 'pulse' && <span className="lyra-badge" style={{ position: 'absolute', top: -3, right: -3 }}>2</span>}
                  {a.id === 'toast' && <span className="lyra-badge" style={{ position: 'absolute', top: -3, right: 'auto', left: -26, borderRadius: 5 }}>msg</span>}
                </span>
              </span>
              <span className="nm">{a.label}<br /><span style={{ fontSize: 11, color: 'var(--muted)' }}>{a.desc}</span></span>
              <span className="val">{s.lyraAnim === a.id ? 'actif' : ''}</span>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 10, borderTop: '1px solid var(--line)', paddingTop: 4 }}>
          <Toggle
            label="effet plein écran (plus voyant)"
            desc="En plus de l'animation choisie : les bords de la fenêtre pulsent rose-or tant que non lu"
            value={s.lyraScreenFx}
            onChange={(v) => { set({ lyraScreenFx: v }); if (v) previewFx() }}
          />
          <button className="btn sm" onClick={previewFx} style={{ marginTop: 6 }}>prévisualiser l'effet</button>
        </div>
      </Card>
      {fxPreview && <div className="screen-fx" />}
      <div style={{ marginTop: 14 }}><SessionNotifSettings /></div>

      <AudioSection />
      <LyraSection />

      <Card tour="demarrage" title="démarrage & aide" style={{ marginTop: 14 }}>
        <Toggle
          label="animation de lancement"
          desc="Séquence complète : à la première ouverture, ou après plus de 4 h d'absence"
          value={s.bootAnim} onChange={(v) => set({ bootAnim: v })} />
        <Toggle
          label="animation de retour"
          desc="Salut court quand tu rouvres l'app peu de temps après"
          value={s.welcomeAnim} onChange={(v) => set({ welcomeAnim: v })} />
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
          <Btn sm onClick={() => {
            localStorage.setItem('neutroncore_force_intro', 'boot')
            location.reload()
          }}>revoir le lancement</Btn>
          <Btn sm onClick={() => {
            localStorage.setItem('neutroncore_force_intro', 'welcome')
            location.reload()
          }}>revoir le retour</Btn>
          <Btn sm onClick={() => {
            localStorage.removeItem('neutroncore_tour_v1')
            location.reload()
          }}>revoir le tutoriel</Btn>
        </div>
        <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 10 }}>
          Sur chaque écran, le bouton ? à côté du titre explique la page en détail.
        </p>
      </Card>

      <Card title="à propos" style={{ marginTop: 14 }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Chip tone="gold">neutroncore</Chip>
          <Chip>backend lyra-control-api :9876</Chip>
          <Chip>PWA installable</Chip>
          <Chip>{THEMES.find((t) => t.id === s.theme)?.dark ? 'thème sombre' : 'thème clair'}</Chip>
        </div>
      </Card>
    </>
  )
}
