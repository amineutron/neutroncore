import { BRI_MAX, K_MAX, K_MIN, dureeLisible, type Rampe } from '../../lib/rampes'
import { changerDuree, monteeReguliere, versRampe, type Lecture, type Reveil, type ReveilListe } from '../../lib/reveil'
import { courbesPourReveil, peutServirAuReveil } from '../../lib/rampesAssistant'
import { JOURS_COURTS, PRESETS_JOURS, heureValide, phraseReveil, problemeReveil, type Horaire } from '../../lib/reveilAssistant'
import { Card } from '../ui'
import { NumField } from '../NumField'
import { Apercu } from './Apercu'
import { CourbeEditeur } from './CourbeEditeur'
import { SelecteurLampes, type Lampes } from './SelecteurLampes'
import './reveil.css'
import './assistant.css'

const MOMENTS: Record<string, string> = { fin: 'quand la lumière est à fond', debut: 'dès que la lumière commence à monter' }
const ECRANS: Record<string, string> = { worldmonitor: 'worldmonitor', tele: 'le tableau du mode télé' }
const nomEcran = (e: string) => ECRANS[e] ?? `l’écran « ${e} »`

/** L'assistant : le réveil se règle en phrases à trous, et une phrase d'aperçu dit ce qui se passera. */
export function AssistantReveil({ r, horaire, liste, lampes, lecture, rampes, onChange, onHoraire, onRampes }: {
  r: Reveil; horaire: Horaire | null; liste: ReveilListe; lampes: Lampes; lecture: Lecture | null; rampes: Rampe[]
  onChange: (r: Reveil) => void; onHoraire: (h: Horaire | null) => void; onRampes: () => void
}) {
  const noms = Object.fromEntries(Object.entries(lampes).map(([id, l]) => [id, l.name]))
  const tele = r.tele
  const reglerTele = (p: Partial<Reveil['tele']>) => onChange({ ...r, tele: { ...tele, ...p } })
  const h = horaire
  const jours = h?.jours ?? []
  const montees = rampes.filter(peutServirAuReveil)
  const choixTele = !tele.actif ? 'rien' : tele.ecran
  const probleme = problemeReveil(r, h)
  const basculeJour = (j: number) => h && onHoraire({ ...h, jours: jours.includes(j) ? jours.filter((x) => x !== j) : [...jours, j].sort() })
  const utiliserMontee = (id: string) => {
    const m = rampes.find((x) => x.id === id)
    if (id === 'reguliere') return onChange(monteeReguliere(r))
    if (m) onChange({ ...r, courbe: courbesPourReveil(m, r.duree_min) })
  }

  return (
    <Card title={`mon réveil : ${r.nom || 'sans nom'}`} lite={r.lampes.length ? undefined : 'choisis au moins une lampe'}>
      <label className="rv-champ as-nom">nom du réveil
        <input type="text" maxLength={60} value={r.nom} onChange={(e) => onChange({ ...r, nom: e.target.value })} placeholder="ex : semaine" />
      </label>

      <div className="as-etape">
        <span className="as-num">1</span>
        <div className="as-corps">
          <p className="as-phrase">Je veux me réveiller
            {h
              ? <> à <input type="time" aria-label="heure du réveil" value={heureValide(h.heure) ? h.heure : ''} onChange={(e) => onHoraire({ ...h, heure: e.target.value })} className="as-champ" /> :</>
              : <> quand je lance l’aube moi-même.</>}
          </p>
          {h && (
            <div className="rv-filtres" role="group" aria-label="jours du réveil">
              {PRESETS_JOURS.map((p) => <button key={p.id} type="button" className="btn sm" aria-pressed={p.jours.length === jours.length && p.jours.every((j) => jours.includes(j))} onClick={() => onHoraire({ ...h, jours: p.jours })}>{p.nom}</button>)}
              <span className="as-jours">{JOURS_COURTS.map((n, j) => <button key={n} type="button" className="as-jour" aria-pressed={jours.includes(j)} onClick={() => basculeJour(j)}>{n}</button>)}</span>
            </div>
          )}
          <label className="as-coche"><input type="checkbox" checked={h !== null} onChange={(e) => onHoraire(e.target.checked ? { heure: '07:30', jours: [0, 1, 2, 3, 4] } : null)} /> me réveiller automatiquement à heure fixe</label>
        </div>
      </div>

      <div className="as-etape">
        <span className="as-num">2</span>
        <div className="as-corps">
          <p className="as-phrase">La lumière monte doucement pendant
            <NumField value={r.duree_min} min={liste.limites.duree_min} max={liste.limites.duree_max} label="durée en minutes" onCommit={(m) => onChange(changerDuree(r, m))} /> minutes
            {h && heureValide(h.heure) ? ', pour être à fond à l’heure choisie.' : '.'}
          </p>
          <SelecteurLampes lampes={lampes} choisies={r.lampes} max={8} onChange={(l) => onChange({ ...r, lampes: l })} />
          <label className="rv-champ">façon dont la lumière monte
            <select value="" onChange={(e) => e.target.value && utiliserMontee(e.target.value)} aria-label="façon dont la lumière monte">
              <option value="">garder la montée actuelle</option>
              <option value="reguliere">montée régulière (la plus naturelle)</option>
              {montees.map((m) => <option key={m.id} value={m.id}>ma montée « {m.nom} »</option>)}
            </select>
          </label>
          <button type="button" className="btn sm" onClick={onRampes}>créer ou modifier une montée de lumière</button>
        </div>
      </div>

      <div className="as-etape">
        <span className="as-num">3</span>
        <div className="as-corps">
          <p className="as-phrase">Puis
            <select className="as-champ" aria-label="ce qui se passe ensuite" value={choixTele}
              onChange={(e) => e.target.value === 'rien' ? reglerTele({ actif: false }) : reglerTele({ actif: true, ecran: e.target.value })}>
              <option value="rien">rien d’autre</option>
              {liste.ecrans.map((e) => <option key={e} value={e}>{nomEcran(e)} sur la télé</option>)}
            </select>.
          </p>
          {tele.actif && !liste.worldmonitor_branche && tele.ecran === 'worldmonitor' && <p className="rv-note">worldmonitor n’est pas encore branché sur la télé : elle montrera le tableau du mode télé.</p>}
        </div>
      </div>

      <div className="as-apercu" aria-live="polite">
        <b>ce qui va se passer</b>
        <p>{phraseReveil(r, h, noms)}</p>
      </div>
      <details className="as-plus">
        <summary>voir la lumière monter (sans toucher aux lampes)</summary>
        <Apercu rampe={versRampe(r)} noms={noms} lecture={lecture} />
      </details>
      <details className="as-plus">
        <summary>réglages avancés</summary>
        <div className="rv-grille" style={{ marginTop: 8 }}>
          <label className="rv-champ">lumière maximale ({Math.round((r.plafond_bri / BRI_MAX) * 100)} %)
            <input type="range" min={10} max={BRI_MAX} value={r.plafond_bri} onChange={(e) => onChange({ ...r, plafond_bri: Number(e.target.value) })} />
          </label>
          {tele.actif && <label className="rv-champ">la télé s’allume
            <select value={tele.moment} onChange={(e) => reglerTele({ moment: e.target.value as 'fin' | 'debut' })}>{liste.moments.map((m) => <option key={m} value={m}>{MOMENTS[m] ?? m}</option>)}</select>
          </label>}
          {tele.actif && tele.moment === 'fin' && <label className="rv-champ">minutes avant la fin de la montée
            <NumField value={tele.avant_fin_min} min={0} max={r.duree_min} label="minutes avant la fin" onCommit={(m) => reglerTele({ avant_fin_min: m })} />
          </label>}
          {tele.actif && <label className="rv-champ">entrée hdmi du pc
            <select value={tele.source} onChange={(e) => reglerTele({ source: e.target.value })}>{liste.sources.map((s) => <option key={s} value={s}>{s}</option>)}</select>
          </label>}
        </div>
        <p className="help-txt">Tire les points pour dessiner la montée : en haut, la lumière est forte ; à droite, c’est la fin ({dureeLisible(r.duree_min * 60)}).</p>
        <CourbeEditeur titre="luminosité" points={r.courbe.bri} duree={r.duree_min * 60} lo={0} hi={BRI_MAX} max={24} couleur="var(--gold)" pas={5}
          formatV={(v) => `${Math.round((v / BRI_MAX) * 100)} %`} curseur={lecture?.id === r.id ? lecture.t : null}
          onChange={(bri) => onChange({ ...r, courbe: { ...r.courbe, bri } })} />
        <CourbeEditeur titre="chaleur de la lumière (bas : rouge-orange, haut : blanc)" points={r.courbe.kelvin} duree={r.duree_min * 60} lo={K_MIN} hi={K_MAX} max={24} couleur="var(--rose)" pas={100}
          formatV={(v) => `${Math.round(v)} K`} curseur={lecture?.id === r.id ? lecture.t : null}
          onChange={(kelvin) => onChange({ ...r, courbe: { ...r.courbe, kelvin } })} />
      </details>
      {probleme && <p className="rv-note" role="status">pour enregistrer : {probleme}</p>}
    </Card>
  )
}
