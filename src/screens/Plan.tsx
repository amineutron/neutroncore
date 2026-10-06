import { useEffect, useState } from 'react'
import { apiGet, apiPost, apiPut, withConfirm } from '../lib/api'
import { confirmDialog, toast } from '../lib/dialog'
import { heightFromFloor, isDirty, moveLight, resizeRoom, setHeight, toPayload, type Plan as RoomPlanData, type RoomDims } from '../lib/plan'
import { usePoll } from '../lib/poll'
import { NumField } from '../components/NumField'
import { RoomPlan, type Measured } from '../components/RoomPlan'
import { setNavGuard } from '../lib/navGuard'
import { Btn, Card, Chip, Loader, PageTitle } from '../components/ui'

type Light = { name: string; on: boolean; color?: string }
type Screens = { ambilight: { on: boolean; style: string }; ambihue: boolean | null; tv_ok: boolean }
const AXES: { axis: keyof RoomDims; label: string }[] = [
  { axis: 'w', label: 'largeur' }, { axis: 'h', label: 'profondeur' }, { axis: 'd', label: 'hauteur' },
]

// Plan de la pièce partagé avec HALO (source de vérité : son fichier de plan).
// HALO surveille ce fichier : un enregistrement ici se voit aussitôt chez lui.
export function Plan() {
  const [saved, setSaved] = useState<RoomPlanData | null>(null)
  const [draft, setDraft] = useState<RoomPlanData | null>(null)
  const [error, setError] = useState('')
  const [selected, setSelected] = useState<string | null>(null)
  const [busy, setBusy] = useState('')
  const [live, setLive] = useState(false)
  const lights = usePoll<{ lights: Record<string, Light> }>(() => apiGet('/hue/lights'), 15000)
  const screens = usePoll<Screens>(() => apiGet('/screens'), 20000)
  const measured = usePoll<Measured & { ok: boolean }>(() => apiGet('/screens/measured'), 3000, live)

  async function load() {
    setError('')
    try {
      const p = await apiGet<RoomPlanData>('/plan')
      if (!p.roomDims || !p.configs) throw new Error('plan HALO introuvable')
      // dimensions nulles ou absentes : le dessin n'aurait aucune taille
      if (![p.roomDims.w, p.roomDims.h, p.roomDims.d].every((v) => Number.isFinite(v) && v > 0)) throw new Error('plan HALO invalide (dimensions)')
      setSaved(p); setDraft(p)
    } catch (e) { setError((e as Error).message) }
  }
  useEffect(() => { void load() }, [])

  const dirty = saved !== null && draft !== null && isDirty(saved, draft)
  // prévenir avant de quitter la page avec un plan modifié
  useEffect(() => {
    if (!dirty) return
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault() }
    window.addEventListener('beforeunload', warn)
    // changement d'écran ou bouton retour : App demande confirmation (lib/navGuard)
    setNavGuard(() => confirmDialog({ title: 'quitter sans enregistrer ?', body: 'Le plan a été modifié. Les changements seront perdus.', ok: 'quitter', cancel: 'rester', danger: true }))
    return () => { window.removeEventListener('beforeunload', warn); setNavGuard(null) }
  }, [dirty])

  async function save() {
    if (!draft) return
    setBusy('save')
    try {
      const r = await apiPut<{ success: boolean; error?: string }>('/plan', toPayload(draft))
      if (!r.success) throw new Error(r.error ?? 'refusé')
      setSaved(draft)
      toast('plan enregistré — HALO le recharge tout seul')
    } catch (e) { toast(`plan non enregistré : ${(e as Error).message}`, 'crit') } finally { setBusy('') }
  }
  async function toggleAmbihue() {
    const on = !screens.data?.ambihue
    setBusy('ambihue')
    try {
      const r = await apiPost<{ success: boolean; error?: string }>('/screens/ambihue', { on })
      toast(r.success ? `ambilight + hue : ${on ? 'associés' : 'dissociés'}` : `échec : ${r.error || 'la TV ne répond pas'}`, r.success ? 'ok' : 'crit')
      screens.refresh()
    } catch (e) { toast(`échec : ${(e as Error).message}`, 'crit') } finally { setBusy('') }
  }
  async function openHalo() {
    if (!await confirmDialog({ title: 'lancer HALO ?', body: 'L’application s’ouvre sur le PC.', ok: 'lancer' })) return
    try { await apiPost('/launcher/halo', undefined, await withConfirm('launcher_halo')); toast('HALO lancé sur le PC') }
    catch (e) { toast(`échec : ${(e as Error).message}`, 'crit') }
  }

  // couleur des lampes allumées, quand le plan les identifie par leur numéro Hue
  const colors = Object.fromEntries(Object.entries(lights.data?.lights ?? {}).filter(([, l]) => l.on).map(([id, l]) => [id, l.color || '#f6c177']))
  const sel = selected && draft ? draft.configs[selected] : null

  return (
    <>
      <PageTitle help="plan" title="plan de pièce" desc="Où sont les lampes dans la pièce — le plan que HALO utilise pour ses effets." />
      {error && <div style={{ marginBottom: 12 }}><Chip tone="crit">plan indisponible : {error}</Chip> <Btn sm onClick={load}>réessayer</Btn></div>}
      {!draft && !error && <Loader label="lecture du plan HALO…" />}
      {draft && (
        <div className="grid pl-layout">
          <Card title="vue de dessus" lite={dirty ? 'modifié — non enregistré' : `${Math.round(draft.roomDims.w)} × ${Math.round(draft.roomDims.h)} cm`}>
            <RoomPlan plan={draft} colors={colors} selected={selected} measured={live && !measured.error && measured.data?.ok ? measured.data : null}
              onSelect={setSelected} onMove={(id, xy) => setDraft((d) => (d ? moveLight(d, id, xy) : d))} />
            <div className="pl-actions">
              <Btn solid disabled={!dirty || busy === 'save'} onClick={save}>{busy === 'save' ? 'enregistrement…' : 'enregistrer'}</Btn>
              <Btn disabled={!dirty} onClick={() => { setDraft(saved); setSelected(null) }}>annuler les changements</Btn>
              <span className="pl-hint">glisse une lampe pour la déplacer · un carreau = 1 m</span>
            </div>
          </Card>
          <div className="pl-side">
            <Card title={sel ? sel.name.toLowerCase() : 'lampe'} lite={sel ? 'sélectionnée' : 'touche une lampe du plan'}>
              {sel && selected ? (
                <>
                  <label className="pl-field">hauteur depuis le sol
                    <span className="num">{heightFromFloor(sel.pos.z, draft.roomDims)} cm</span>
                  </label>
                  <input type="range" className="bri" min={0} max={Math.round(draft.roomDims.d)} step={5}
                    value={heightFromFloor(sel.pos.z, draft.roomDims)} aria-label={`Hauteur de ${sel.name}`}
                    onChange={(e) => setDraft((d) => (d ? setHeight(d, selected, Number(e.target.value)) : d))} />
                  <p className="pl-note">position : {Math.round(sel.pos.x + draft.roomDims.w / 2)} cm du mur gauche, {Math.round(sel.pos.y + draft.roomDims.h / 2)} cm du mur de la tv</p>
                </>
              ) : <p className="pl-note">Sa hauteur et sa position précise s'affichent ici.</p>}
            </Card>
            <Card title="pièce" lite="en centimètres">
              {AXES.map(({ axis, label }) => (
                <label className="pl-field" key={axis}>{label}
                  <NumField value={Math.round(draft.roomDims[axis])} min={100} max={3000} step={10}
                    label={`${label} de la pièce en centimètres`}
                    onCommit={(v) => setDraft((d) => (d ? resizeRoom(d, axis, v) : d))} />
                </label>
              ))}
            </Card>
            <Card title="halo" lite={screens.data?.tv_ok ? 'tv joignable' : 'tv injoignable'}>
              <div className="pl-toggles">
                <Btn sm solid={Boolean(screens.data?.ambihue)} disabled={busy === 'ambihue' || screens.data?.ambihue == null} onClick={toggleAmbihue}>
                  {busy === 'ambihue' ? '…' : `ambilight + hue : ${screens.data?.ambihue == null ? 'inconnu' : screens.data.ambihue ? 'associés' : 'dissociés'}`}
                </Btn>
                <Btn sm solid={live} onClick={() => setLive((v) => !v)}>couleurs de la tv en direct : {live ? 'oui' : 'non'}</Btn>
                {live && (measured.error || measured.data?.ok === false) && <Chip tone="warn">la tv ne renvoie pas ses couleurs</Chip>}
                <Btn sm onClick={openHalo}>ouvrir halo sur le pc</Btn>
              </div>
              <p className="pl-note">Le ruban LED et la TV se règlent dans HALO : ils sont affichés ici, sans être modifiables.</p>
            </Card>
          </div>
        </div>
      )}
    </>
  )
}
