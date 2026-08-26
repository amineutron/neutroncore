import { useEffect, useState } from 'react'
import { apiGet, apiPost, withConfirm } from '../lib/api'
import { usePoll } from '../lib/poll'
import { Btn, Card, Chip, PageTitle, Eyebrow, Loader } from '../components/ui'

// L'API TV attend les modes JointSpace, pas nos libellés courts
const AMBILIGHT_MODES: Record<string, string> = {
  video: 'FOLLOW_VIDEO', audio: 'FOLLOW_AUDIO', lounge: 'LOUNGE_LIGHT', off: 'OFF',
}

type TvStatus = { power: string; volume: number; muted: boolean; ambilight_mode: string; denon_volume: number; denon_muted: boolean; denon_reachable: boolean }
type Monitor = { name: string; width: number; height: number; x: number; dpms: boolean }
type Screens = { monitors: Monitor[]; tv_ok: boolean; ambilight: { on: boolean; style: string }; ambihue: boolean | null }
type Light = { name: string; on: boolean; bri: number; reachable: boolean; color?: string }
type Scene = { id: string; name: string; group: string }
type Preview = { colors: string[]; lightstates: Record<string, string> }

/** Mini-plan de la pièce : positions entertainment (-1..1) colorées par la scène. */
function RoomPreview({ positions, lightstates, size = 52 }: {
  positions: Record<string, number[]>; lightstates: Record<string, string>; size?: number
}) {
  const ids = Object.keys(positions)
  if (ids.length === 0) return null
  const w = size, h = size * 0.72
  return (
    <svg className="room" width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
      <rect x={1} y={1} width={w - 2} height={h - 2} rx={5} fill="none" stroke="var(--line2)" strokeWidth={1} />
      {ids.map((id) => {
        const [x, , z] = positions[id]
        const cx = ((x + 1) / 2) * (w - 12) + 6
        const cy = ((1 - (z + 1) / 2)) * (h - 12) + 6
        const color = lightstates[id] || 'var(--off)'
        return <circle key={id} cx={cx} cy={cy} r={3.4} fill={color} opacity={lightstates[id] ? 1 : 0.45} />
      })}
    </svg>
  )
}

export function Ambiance() {
  const tv = usePoll<TvStatus>(() => apiGet('/tv/status'), 15000)
  const lights = usePoll<{ lights: Record<string, Light> }>(() => apiGet('/hue/lights'), 15000)
  const scenes = usePoll<{ scenes: Scene[] }>(() => apiGet('/hue/scenes'), 300000)
  const beat = usePoll<{ running: boolean }>(() => apiGet('/hue/beat/status'), 20000)
  const screens = usePoll<Screens>(() => apiGet('/screens'), 15000)
  const ironman = usePoll<{ active: boolean; state: string }>(() => apiGet('/ironman/status'), 30000)
  const positions = usePoll<{ positions: Record<string, number[]> }>(() => apiGet('/hue/positions'), 600000)
  const [busy, setBusy] = useState('')
  const [toast, setToast] = useState('')
  const [previews, setPreviews] = useState<Record<string, Preview>>({})
  const [activeScene, setActiveScene] = useState('')
  const [briDraft, setBriDraft] = useState<Record<string, number>>({})

  const sceneList = (scenes.data?.scenes ?? []).filter((s) => s.group === '81').slice(0, 7)

  // charge les aperçus couleur des scènes affichées (une fois chacune)
  useEffect(() => {
    sceneList.forEach((s) => {
      if (previews[s.id]) return
      apiGet<Preview>(`/hue/scenes/${s.id}/preview`)
        .then((p) => setPreviews((prev) => ({ ...prev, [s.id]: p })))
        .catch(() => setPreviews((prev) => ({ ...prev, [s.id]: { colors: [], lightstates: {} } })))
    })
  }, [sceneList.map((s) => s.id).join(',')]) // eslint-disable-line react-hooks/exhaustive-deps

  async function setBrightness(id: string, bri: number) {
    await apiPost(`/hue/light/${id}`, { bri, on: bri > 0 })
    lights.refresh()
  }

  const [lightsOpen, setLightsOpen] = useState(false)
  const [groupBri, setGroupBri] = useState(160)
  async function applyGroupBri() {
    await run('luminosité générale', () => apiPost('/hue/group', { group_id: '81', on: groupBri > 0, brightness: groupBri }), lights.refresh)
  }

  const lightsMode = ironman.data?.active
    ? 'scène iron man'
    : beat.data?.running
      ? 'huebeat'
      : screens.data?.ambilight?.on && screens.data?.ambihue
        ? 'ambilight + hue'
        : 'normal'

  // couleurs principales : uniques parmi les lumières allumées
  const mainColors = [...new Set(
    Object.values(lights.data?.lights ?? {}).filter((l) => l.on).map((l) => l.color || '#f6c177'),
  )].slice(0, 5)

  async function run(label: string, fn: () => Promise<{ success?: boolean } | unknown>, refresh?: () => void) {
    setBusy(label)
    try {
      const r = (await fn()) as { success?: boolean } | undefined
      if (r && r.success === false) setToast(`échec : ${label}`)
      else setToast(`ok : ${label}`)
      refresh?.()
    } catch (e) {
      setToast(`erreur : ${(e as Error).message}`)
    } finally {
      setBusy('')
      setTimeout(() => setToast(''), 3500)
    }
  }

  async function openHalo() {
    if (!window.confirm('Lancer l’application HALO sur le PC ?')) return
    await run('halo', async () => apiPost('/launcher/halo', undefined, await withConfirm('launcher_halo')))
  }

  const t = tv.data
  const lightList = Object.entries(lights.data?.lights ?? {})
  const onCount = lightList.filter(([, l]) => l.on).length

  return (
    <>
      <PageTitle help="ambiance" title="ambiance" desc="TV, ampli, lumières et scènes — la maison en un geste." />
      {toast && (
        <div style={{ position: 'fixed', bottom: 70, right: 20, zIndex: 50 }}>
          <Chip tone={toast.startsWith('ok') ? 'ok' : 'crit'}>{toast}</Chip>
        </div>
      )}
      <div
        className={`card lights-card ${lightsOpen ? 'open' : ''}`}
        style={{ marginBottom: 16, cursor: 'pointer' }}
        onClick={() => setLightsOpen((v) => !v)}
      >
        <h3>lumières<span className="lite">hue · {onCount} sur {lightList.length} allumées — survoler pour le détail</span>{lightsMode !== 'normal' && <span style={{ marginLeft: 10 }}><Chip tone="rose">contrôlées par {lightsMode}</Chip></span>}</h3>{lightsMode !== 'normal' && (<p style={{ fontSize: 11.5, color: 'var(--warn)', margin: '0 0 10px' }}>Les réglages manuels seront écrasés tant que « {lightsMode} » est actif — désactive-le d'abord pour reprendre la main.</p>)}
        {/* résumé : couleurs principales + luminosité générale */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }} onClick={(e) => e.stopPropagation()}>
          <span style={{ display: 'flex', gap: 7 }}>
            {mainColors.length > 0
              ? mainColors.map((c, i) => <span key={i} className="main-dot" style={{ background: c, boxShadow: `0 0 10px ${c}66` }} />)
              : <span className="main-dot" style={{ background: 'var(--off)' }} />}
          </span>
          <span className="mono" style={{ fontSize: 10, color: 'var(--faint)', letterSpacing: '.12em' }}>GÉNÉRAL</span>
          <input
            type="range" className="bri" style={{ flex: 1, minWidth: 140, maxWidth: 320 }}
            min={0} max={254} value={groupBri}
            aria-label="Luminosité générale"
            onChange={(e) => setGroupBri(Number(e.target.value))}
            onMouseUp={() => applyGroupBri()}
            onTouchEnd={() => applyGroupBri()}
          />
          <span className="val num" style={{ width: 38, textAlign: 'right' }}>{Math.round((groupBri / 254) * 100)} %</span>
        </div>
        {/* détail : disposition colorée + réglage par lumière (survol ou clic) */}
        <div className="reveal" onClick={(e) => e.stopPropagation()}>
          <div style={{ display: 'flex', justifyContent: 'center', padding: '14px 0 6px' }}>
            <RoomPreview
              positions={positions.data?.positions ?? {}}
              lightstates={Object.fromEntries(lightList.filter(([, l]) => l.on).map(([id, l]) => [id, l.color || '#f6c177']))}
              size={130}
            />
          </div>
          <div className="grid g2" style={{ gap: '0 28px' }}>
          {lights.data === null && <Loader label="chargement des lumières…" />}
          {lightList.map(([id, l]) => {
            const color = l.color || '#f6c177'
            const bri = briDraft[id] ?? l.bri
            return (
              <div className="light" key={id}>
                <span
                  className="bulb" style={l.on ? { background: color, boxShadow: `0 0 9px ${color}` } : { background: 'var(--off)' }}
                  onClick={() => run(`lumière ${l.name}`, () => apiPost(`/hue/light/${id}`, { on: !l.on }), lights.refresh)}
                  role="button" aria-label={`Basculer ${l.name}`}
                  title={l.on ? 'éteindre' : 'allumer'}
                />
                <span className="nm">{l.name}</span>
                <input
                  type="range" className="bri" min={0} max={254} value={l.on ? bri : 0}
                  aria-label={`Intensité ${l.name}`}
                  onChange={(e) => setBriDraft((d) => ({ ...d, [id]: Number(e.target.value) }))}
                  onMouseUp={() => briDraft[id] !== undefined && setBrightness(id, briDraft[id])}
                  onTouchEnd={() => briDraft[id] !== undefined && setBrightness(id, briDraft[id])}
                />
                <span className="val num" style={{ width: 38, textAlign: 'right' }}>
                  {l.on ? `${Math.round(((l.on ? bri : 0) / 254) * 100)} %` : 'off'}
                </span>
              </div>
            )
          })}
          </div>
        </div>
      </div>

      <Eyebrow>scènes</Eyebrow>
      {scenes.data === null && <Loader label="chargement des scènes hue…" />}
      <div className="scene-grid" style={{ marginBottom: 16 }}>
        <div
          className={`scene-sq ${ironman.data?.active || activeScene === 'ironman' ? 'on' : ''}`}
          onClick={() => { setActiveScene('ironman'); run('scène iron man', () => apiPost('/ironman/trigger')) }}
        >
          <div className="base">
            <div className="sw-row">
              {['#e04a4a', '#f6c177', '#3a6ea8'].map((c) => <span key={c} className="sw-dot" style={{ background: c }} />)}
            </div>
            <b>iron man<span style={{ color: 'var(--gold)' }}>.</span></b>
            {(ironman.data?.active || activeScene === 'ironman') && <span className="lbl-state">{busy === 'scène iron man' ? 'lancement' : 'active'}</span>}
          </div>
          <div className="room-wrap">
            <RoomPreview
              positions={positions.data?.positions ?? {}}
              lightstates={Object.fromEntries(Object.keys(positions.data?.positions ?? {}).map((id) => [id, '#e04a4a']))}
              size={78}
            />
            <b>iron man.</b>
          </div>
        </div>
        {sceneList.map((s) => {
          const p = previews[s.id]
          return (
            <div
              key={s.id}
              className={`scene-sq ${activeScene === s.id ? 'on' : ''}`}
              onClick={() => { setActiveScene(s.id); run(`scène ${s.name}`, () => apiPost('/hue/scene', { scene_id: s.id }), lights.refresh) }}
            >
              <div className="base">
                <div className="sw-row">
                  {(p?.colors.length ? p.colors : ['#5c5262']).slice(0, 4).map((c, i) => (
                    <span key={i} className="sw-dot" style={{ background: c }} />
                  ))}
                </div>
                <b>{s.name.toLowerCase()}</b>
                {activeScene === s.id && <span className="lbl-state">active</span>}
              </div>
              <div className="room-wrap">
                <RoomPreview positions={positions.data?.positions ?? {}} lightstates={p?.lightstates ?? {}} size={78} />
                <b>{s.name.toLowerCase()}</b>
              </div>
            </div>
          )
        })}
      </div>

      <div className="grid g3">
        <Card title="tv philips" lite="55oled705">
          <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
            <Chip tone={t?.power === 'On' ? 'ok' : undefined}>{t?.power === 'On' ? 'allumée' : 'éteinte'}</Chip>
            {t && <Chip tone="gold">ambilight {t.ambilight_mode.toLowerCase().replace('follow_', '')}</Chip>}
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Btn sm onClick={() => run('tvp', () => apiPost('/tv/power', { state: t?.power === 'On' ? 'off' : 'on' }), tv.refresh)} disabled={busy === 'tvp'}>
              {t?.power === 'On' ? 'éteindre' : 'allumer'}
            </Btn>
            <Btn sm onClick={() => run('tvm', () => apiPost('/tv/mute'), tv.refresh)}>muet</Btn>
          </div>
        </Card>
        <Card title="denon avr" lite="x1700h">
          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            <Chip tone={t?.denon_reachable ? 'ok' : 'crit'}>{t?.denon_reachable ? 'allumé' : 'injoignable'}</Chip>
            {t && <Chip>vol {t.denon_volume}</Chip>}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <Btn sm onClick={() => run('dv-', () => apiPost('/tv/denon/volume', { delta: -2 }), tv.refresh)}>vol −</Btn>
            <Btn sm onClick={() => run('dv+', () => apiPost('/tv/denon/volume', { delta: 2 }), tv.refresh)}>vol +</Btn>
            <Btn sm onClick={() => run('dm', () => apiPost('/tv/denon/mute'), tv.refresh)}>muet</Btn>
          </div>
        </Card>
        <Card title="huebeat" lite="sync musique">
          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            <Chip tone={beat.data?.running ? 'rose' : undefined}>{beat.data?.running ? 'actif' : 'arrêté'}</Chip>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {beat.data?.running
              ? <Btn sm danger onClick={() => run('beat', () => apiPost('/hue/beat/stop'), beat.refresh)}>stop</Btn>
              : <Btn sm solid onClick={() => run('beat', () => apiPost('/hue/beat/start', { palette: 'ironman' }), beat.refresh)}>démarrer</Btn>}
          </div>
        </Card>
      </div>

      <div className="grid g2" style={{ marginTop: 14 }}>
        <Card title="écrans du pc" lite="hyprland · dpms">
          {(screens.data?.monitors ?? []).map((m) => (
            <div className="light" key={m.name} style={{ cursor: 'pointer' }}
              onClick={() => run(`m${m.name}`, () => apiPost('/screens/dpms', { name: m.name, state: m.dpms ? 'off' : 'on' }), screens.refresh)}>
              <span className="bulb" style={m.dpms ? { background: '#82d69c', boxShadow: '0 0 8px #82d69c66' } : { background: 'var(--off)' }} />
              <span className="nm mono" style={{ fontSize: 12 }}>{m.name}</span>
              <span className="val">{m.width}×{m.height} · {m.dpms ? 'allumé' : 'éteint'}</span>
            </div>
          ))}
          {(screens.data?.monitors ?? []).length === 0 && <span style={{ color: 'var(--faint)', fontSize: 12 }}>Moniteurs indisponibles.</span>}
        </Card>
        <Card title="ambilight" lite={screens.data?.ambilight?.on ? `actif · ${screens.data.ambilight.style.toLowerCase().replace('follow_', '')}` : 'éteint'}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {(['video', 'audio', 'lounge', 'off'] as const).map((style) => (
              <Btn key={style} sm
                disabled={busy === `ambilight ${style}`}
                solid={screens.data?.ambilight?.style?.toLowerCase().includes(style) ?? false}
                onClick={() => run(`ambilight ${style}`, () => apiPost('/tv/ambilight', { mode: AMBILIGHT_MODES[style] }), screens.refresh)}>
                {busy === `ambilight ${style}` ? '…' : style === 'off' ? 'éteindre' : style}
              </Btn>
            ))}
          </div>
          <p style={{ fontSize: 11.5, color: 'var(--faint)', marginTop: 10 }}>
            ambilight+hue : {screens.data?.ambihue == null ? '—' : screens.data.ambihue ? 'actif' : 'inactif'}
          </p>
        </Card>
      </div>

      <Card title="gestion avancée — halo" style={{ marginTop: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 12.5, color: 'var(--muted)', flex: 1, minWidth: 220 }}>
            Couleurs Hue précises, plan 2D/3D de la pièce, segments de la bande LED, flux Ambilight live :
            tout ça vit dans HALO (app Quickshell du PC).
          </span>
          <Btn solid onClick={openHalo} disabled={busy === 'halo'}>ouvrir halo sur le pc</Btn>
        </div>
      </Card>

    </>
  )
}
