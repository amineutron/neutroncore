import { useEffect, useState } from 'react'
import { apiDelete, apiGet, apiPost, apiPut, withConfirm } from '../lib/api'
import { usePoll } from '../lib/poll'
import { confirmDialog, toast } from '../lib/dialog'
import { identifiant } from '../lib/reveil'
import {
  TYPES, bilanVolumes, cartesDe, niveauRetenu, nomsAppareils, phraseScene, pilotable, reglables, volumesHabituels,
  type Appareils, type Retour, type Scene, type Zone, type Zones,
} from '../lib/zonesAudio'
import { Card, Chip, Loader, PageTitle } from '../components/ui'
import { AppareilCard } from '../components/sono/AppareilCard'
import { SceneEditor } from '../components/sono/SceneEditor'
import { ZoneEditor } from '../components/sono/ZoneEditor'
import '../components/reveil/reveil.css'
import '../components/ctl.css'
import '../components/sono/sono.css'

function Curseur({ zone, plafond, actif, onCommit }: { zone: Zone; plafond: number; actif: boolean; onCommit: (v: number) => void }) {
  const [v, setV] = useState(zone.volume)
  useEffect(() => setV(zone.volume), [zone.volume])
  const max = Math.min(zone.volume_max, plafond)
  return (
    <div className="rv-vol">
      <input type="range" min={0} max={max} value={Math.min(v, max)} disabled={!actif} aria-label={`volume ${zone.nom}`}
        onChange={(e) => setV(Number(e.target.value))} onPointerUp={() => onCommit(v)} onKeyUp={() => onCommit(v)} />
      <output>{Math.min(v, max)}</output>
    </div>
  )
}

function GuideVide({ manques }: { manques: Appareils['manques'] }) {
  return (
    <div className="sn-vide">
      <b>aucun appareil audio détecté</b>
      <span>voici comment en faire apparaître :</span>
      <ul>{(manques.length ? manques : (Object.keys(TYPES) as (keyof typeof TYPES)[])).map((t) => <li key={t}>{TYPES[t].indice}</li>)}</ul>
    </div>
  )
}

export function ZonesAudio() {
  const zs = usePoll<Zones>(() => apiGet('/zones-audio'), 10000)
  const ap = usePoll<Appareils>(() => apiGet('/zones-audio/appareils'), 15000)
  const [zoneEnCours, setZoneEnCours] = useState<Zone | null>(null)
  const [sceneEnCours, setSceneEnCours] = useState<Scene | null>(null)
  const [statut, setStatut] = useState('')
  const d = zs.data
  if (!d) return <><PageTitle help="zonesaudio" title="sono" desc="Tes appareils audio, des zones et des ambiances de volume." />{zs.error ? <p className="rv-alerte">API injoignable : {zs.error}</p> : <Loader label="lecture de la sono…" />}</>

  const liste = ap.data?.appareils ?? []
  const noms = Object.fromEntries(d.zones.map((z) => [z.id, z.nom]))
  const agir = async (f: () => Promise<Retour | { success?: boolean; error?: string }>, ok: string) => {
    try {
      const r = await f()
      const dit = 'resultats' in r ? bilanVolumes(r, noms) : ''
      toast(r.success === false ? (dit || ('error' in r && r.error) || 'refusé') : dit || ok, r.success === false ? 'warn' : 'ok')
      return r.success !== false
    } catch (e) { toast((e as Error).message, 'crit'); return false } finally { zs.refresh() }
  }
  const nouvelleZone = () => setZoneEnCours({ id: identifiant('zone', d.zones.map((z) => z.id)), nom: '', appareil: '', groupe: false, volume_max: Math.min(40, d.plafond), volume: 20, appareils: [] })
  const nouvelleScene = () => setSceneEnCours({ id: identifiant('scene', d.scenes.map((s) => s.id)), nom: '', volumes: {} })
  const enregistrerScene = async (s: Scene, jouer: boolean) => {
    const bon = await agir(() => apiPut(`/zones-audio/scenes/${s.id}`, s), 'scène enregistrée')
    if (bon && jouer) await agir(() => apiPost<Retour>(`/zones-audio/scenes/${s.id}/appliquer`), 'scène jouée')
    if (bon) setSceneEnCours(null)
  }

  return (
    <>
      <PageTitle help="zonesaudio" title="sono" desc={`Tes appareils audio, des zones (groupes d’appareils) et des ambiances de volume. Volume plafonné à ${d.plafond}. Aucun contenu n’est diffusé d’ici.`} />
      <div className="nc-scope nc-stack">
        {!d.multi_appareil && d.zones.some((z) => z.appareil || cartesDe(z).some((i) => i.startsWith('cast:'))) && (
          <p className="rv-note">le serveur catt ne vise qu’un appareil (le sien) : les enceintes nommées sont refusées tant que ce réglage n’est pas activé.
            <button className="btn sm" style={{ marginLeft: 8, minHeight: 44 }} onClick={() => agir(() => apiPut('/zones-audio/reglages', { multi_appareil: true }), 'catt sait viser un appareil')}>mon catt sait viser un appareil</button></p>
        )}
        {d.ecartes.length > 0 && <p className="rv-note">éléments du fichier ignorés : {d.ecartes.join(' ; ')}</p>}

        <Card title="1. tes appareils audio" lite={ap.data ? `${liste.length} détecté${liste.length > 1 ? 's' : ''}` : 'recherche…'}>
          {!ap.data && !ap.error && <Loader label="recherche des appareils…" />}
          {ap.error && <p className="rv-note">lecture des appareils impossible : {ap.error}</p>}
          {ap.data && ap.data.vide && <GuideVide manques={ap.data.manques} />}
          {liste.length > 0 && <div className="sn-grille">{liste.map((a) => <AppareilCard key={a.id} appareil={a} />)}</div>}
          {ap.data && !ap.data.vide && ap.data.manques.length > 0 && <p className="sn-sous">pas vu : {ap.data.manques.map((t) => TYPES[t].label).join(', ')}.</p>}
          {ap.data && !ap.data.reseau_lu && <p className="sn-sous">la liste du réseau n’a pas répondu : les enceintes chromecast ne sont pas listées.</p>}
          <div className="sn-actions" style={{ marginTop: 8 }}>
            <button className="btn sm" style={{ minHeight: 44 }} onClick={() => ap.refresh()}>actualiser</button>
            <button className="btn sm" style={{ minHeight: 44 }} onClick={async () => { const r = await apiGet<{ texte: string; error?: string }>('/zones-audio/statut'); setStatut(r.texte || r.error || 'rien') }}>que joue l’enceinte par défaut ?</button>
          </div>
          {statut && <p className="rv-note" style={{ whiteSpace: 'pre-wrap' }}>{statut}</p>}
        </Card>

        <Card title="2. tes zones" lite={`${d.zones.length}`}>
          <p className="sn-sous">une zone = des appareils qui jouent ensemble (salon : ampli + enceinte).</p>
          {d.zones.length === 0 && <p className="nc-empty">aucune zone pour l’instant. crée « salon » en cochant ton ampli.</p>}
          <div className="rv-liste">
            {d.zones.map((z) => {
              const ids = cartesDe(z)
              const ok = ids.length ? reglables(ids, liste, d.multi_appareil).length > 0 : pilotable(z, d.multi_appareil)
              return (
                <div key={z.id} className="sn-zone">
                  <div className="sn-zone-tete">
                    <div><b>{z.nom}</b> {z.groupe && <Chip tone="gold">groupe</Chip>} {!ok && <Chip tone="warn">volume non réglable</Chip>}
                      <small>maximum {Math.min(z.volume_max, d.plafond)}{ids.length === 0 ? ` · ${z.appareil || 'appareil par défaut'} (à rattacher à des cartes : modifier)` : ''}</small></div>
                    <div className="sn-actions">
                      <button className="btn sm" onClick={() => setZoneEnCours(z)}>modifier</button>
                      <button className="btn sm" aria-label={`Supprimer ${z.nom}`} onClick={async () => {
                        if (await confirmDialog({ title: `retirer « ${z.nom} » ?`, danger: true, ok: 'retirer' })) await agir(async () => apiDelete(`/zones-audio/zones/${z.id}`, await withConfirm('zone_audio_supprimer')), 'zone retirée')
                      }}>×</button>
                    </div>
                  </div>
                  {ids.length > 0 && <div className="sn-puces">{nomsAppareils(ids, liste).map((n, i) => <span key={ids[i]} className="sn-puce">{n}</span>)}</div>}
                  <Curseur zone={z} plafond={d.plafond} actif={ok} onCommit={(v) => agir(() => apiPost<Retour>('/zones-audio/volume', { consignes: { [z.id]: niveauRetenu(z, v, d.plafond) } }), 'volume réglé')} />
                  <div className="sn-actions">
                    {(['pause', 'resume', 'stop'] as const).map((a) => (
                      <button key={a} className="btn sm" disabled={!ok} onClick={() => agir(() => apiPost<Retour>('/zones-audio/controle', { action: a, zones: [z.id] }), a)}>{a === 'resume' ? 'reprise' : a === 'stop' ? 'arrêt' : 'pause'}</button>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
          <button className="btn solid sn-gros" style={{ marginTop: 10 }} onClick={nouvelleZone}>+ nouvelle zone</button>
        </Card>
        {zoneEnCours && (
          <ZoneEditor zone={zoneEnCours} appareils={liste} plafond={d.plafond} multi={d.multi_appareil} onChange={setZoneEnCours} onClose={() => setZoneEnCours(null)}
            onSave={async () => { if (await agir(() => apiPut(`/zones-audio/zones/${zoneEnCours.id}`, zoneEnCours), 'zone enregistrée')) setZoneEnCours(null) }} />
        )}

        <Card title="3. tes ambiances de volume" lite="un geste pour plusieurs zones">
          {d.scenes.length === 0 && <p className="nc-empty">aucune ambiance. exemple : « soirée : salon 35, cuisine 20 ».</p>}
          <div className="rv-liste">
            {d.scenes.map((s) => (
              <div key={s.id} className="sn-scene">
                <b>{phraseScene(s.nom, s.volumes, noms)}</b>
                <div className="sn-actions">
                  <button className="btn solid sm" onClick={() => agir(() => apiPost<Retour>(`/zones-audio/scenes/${s.id}/appliquer`), 'ambiance jouée')}>jouer</button>
                  <button className="btn sm" onClick={() => setSceneEnCours(s)}>modifier</button>
                  <button className="btn sm" aria-label={`Supprimer ${s.nom}`} onClick={async () => agir(async () => apiDelete(`/zones-audio/scenes/${s.id}`, await withConfirm('zone_audio_supprimer')), 'ambiance supprimée')}>×</button>
                </div>
              </div>
            ))}
          </div>
          <div className="sn-actions" style={{ marginTop: 10 }}>
            <button className="btn solid sn-gros" disabled={!d.zones.length} onClick={nouvelleScene}>+ nouvelle ambiance</button>
            <button className="btn sn-gros" disabled={!d.zones.length} onClick={() => enregistrerScene({ id: identifiant('scene', d.scenes.map((s) => s.id)), nom: 'scène du moment', volumes: volumesHabituels(d.zones) }, false)}>garder les volumes habituels</button>
          </div>
        </Card>
        {sceneEnCours && (
          <SceneEditor scene={sceneEnCours} zones={d.zones} appareils={liste} plafond={d.plafond} onChange={setSceneEnCours} onClose={() => setSceneEnCours(null)}
            onSave={() => enregistrerScene(sceneEnCours, false)} onPlay={() => enregistrerScene(sceneEnCours, true)} />
        )}
      </div>
    </>
  )
}
