import { useState } from 'react'
import { pieceLabel } from '../../lib/atelier'
import type { Axe, Coupe } from '../../lib/atelierScene'

const VUE_NOMS = ['iso', 'face', 'dos', 'gauche', 'droite', 'dessus', 'dessous']
const OUVERTES = 'neutroncore_atelier_outils'
type SectionId = 'vue' | 'eclate' | 'selection' | 'export'

function lireOuvertes(): SectionId[] {
  try { const v = JSON.parse(localStorage.getItem(OUVERTES) ?? '["vue"]') as unknown; return Array.isArray(v) ? (v as SectionId[]) : ['vue'] } catch { return ['vue'] }
}

// Outils de la vue 3D, rangés en sections repliables : chaque en-tête dit l'état du réglage,
// on n'ouvre que ce dont on a besoin. Les sections ouvertes sont retenues d'une visite à l'autre.
export function ViewerTools(p: {
  vue: string; onVue: (v: string) => void; onCadrer: () => void
  haut: 'y' | 'z'; onHaut: (h: 'y' | 'z') => void; edges: boolean; onEdges: (on: boolean) => void
  explode: number; explodeAround: boolean; onExplode: (facteur: number, around: boolean) => void
  coupe: Coupe; onCoupe: (c: Coupe) => void
  selection: string[]; multi: boolean; onMulti: (on: boolean) => void
  measuring: boolean; onMeasuring: (on: boolean) => void; onShowAll: () => void
  exports?: React.ReactNode
}) {
  const [ouvertes, setOuvertes] = useState<SectionId[]>(lireOuvertes)
  const bascule = (id: SectionId) => {
    const next = ouvertes.includes(id) ? ouvertes.filter((x) => x !== id) : [...ouvertes, id]
    setOuvertes(next)
    try { localStorage.setItem(OUVERTES, JSON.stringify(next)) } catch { /* préférence de confort */ }
  }
  const { coupe, selection } = p
  const setAxe = (axe: string) => p.onCoupe(axe ? { axe: axe as Axe, position: coupe?.position ?? 0.5, inverse: coupe?.inverse ?? false } : null)
  const etatEclate = [p.explode > 0 ? `éclaté ${Math.round(p.explode * 100)} %` : '', coupe ? `coupe ${coupe.axe}` : ''].filter(Boolean).join(' · ') || 'fermé, sans coupe'
  const etatSelection = [selection.length ? `${selection.length} pièce${selection.length > 1 ? 's' : ''}` : 'aucune pièce', p.multi ? 'multiple' : '', p.measuring ? 'mesure' : ''].filter(Boolean).join(' · ')
  const sections: { id: SectionId; titre: string; etat: string; actif: boolean; corps: React.ReactNode }[] = [
    {
      id: 'vue', titre: 'vue', etat: `${p.vue} · vertical ${p.haut}${p.edges ? '' : ' · sans arêtes'}`, actif: false,
      corps: <>
        <div className="at-seg" role="group" aria-label="Angle de vue">
          {VUE_NOMS.map((v) => <button key={v} type="button" className={p.vue === v ? 'on' : ''} aria-pressed={p.vue === v} onClick={() => p.onVue(v)}>{v}</button>)}
        </div>
        <div className="at-row">
          <button type="button" className="btn sm" onClick={p.onCadrer} title="Cadrer la sélection, ou tout">{selection.length ? 'cadrer la sélection' : 'tout cadrer'}</button>
          <label className="at-champ" title="Si l'objet apparaît couché ou debout sur la tranche : choisis l'axe qui pointe vers le haut dans le modèle">vertical
            <select value={p.haut} aria-label="Axe vertical du modèle" onChange={(e) => p.onHaut(e.target.value as 'y' | 'z')}>
              <option value="y">axe y</option><option value="z">axe z</option>
            </select>
          </label>
          <label className="at-check"><input type="checkbox" checked={p.edges} onChange={(e) => p.onEdges(e.target.checked)} /> arêtes</label>
        </div>
      </>,
    },
    {
      id: 'eclate', titre: 'éclaté et coupe', etat: etatEclate, actif: p.explode > 0 || coupe !== null,
      corps: <>
        <label className="at-champ large" title="Écarte les pièces les unes des autres : plus on pousse, plus elles s'éloignent">éclaté
          <input type="range" min={0} max={3} step={0.02} value={p.explode} aria-label="Éclaté" onChange={(e) => p.onExplode(Number(e.target.value), p.explodeAround)} />
          <em>{Math.round(p.explode * 100)} %</em>
          {p.explode > 0 && <button type="button" className="btn sm" onClick={() => p.onExplode(0, false)}>refermer</button>}
        </label>
        <label className="at-check"><input type="checkbox" checked={p.explodeAround} disabled={selection.length === 0} onChange={(e) => p.onExplode(p.explode, e.target.checked)} />
          éclater autour de la sélection{selection.length ? ` (${selection.map(pieceLabel).slice(0, 2).join(', ')}${selection.length > 2 ? '…' : ''})` : ''}</label>
        <div className="at-row">
          <label className="at-champ">coupe
            <select value={coupe?.axe ?? ''} aria-label="Axe de coupe" onChange={(e) => setAxe(e.target.value)}>
              <option value="">aucune</option><option value="x">largeur (x)</option><option value="y">hauteur (y)</option><option value="z">épaisseur (z)</option>
            </select>
          </label>
          {coupe && <label className="at-check"><input type="checkbox" checked={coupe.inverse} onChange={(e) => p.onCoupe({ ...coupe, inverse: e.target.checked })} /> garder l'autre côté</label>}
        </div>
        {coupe && (
          <label className="at-champ large">position
            <input type="range" min={0} max={1} step={0.01} value={coupe.position} aria-label="Position de la coupe" onChange={(e) => p.onCoupe({ ...coupe, position: Number(e.target.value) })} />
            <em>{Math.round(coupe.position * 100)} %</em>
          </label>
        )}
      </>,
    },
    {
      id: 'selection', titre: 'sélection et mesure', etat: etatSelection, actif: p.multi || p.measuring,
      corps: <div className="at-row">
        <button type="button" className={`btn sm ${p.multi ? 'solid' : ''}`} aria-pressed={p.multi} onClick={() => p.onMulti(!p.multi)} title="Chaque pièce touchée s'ajoute à la sélection (au clavier : Ctrl ou Maj)">sélection multiple</button>
        <button type="button" className={`btn sm ${p.measuring ? 'solid' : ''}`} aria-pressed={p.measuring} onClick={() => p.onMeasuring(!p.measuring)} title="Touche deux points sur les pièces : la distance s'affiche">mesurer</button>
        <button type="button" className="btn sm" onClick={p.onShowAll} title="Toutes les pièces redeviennent visibles">tout réafficher</button>
      </div>,
    },
    ...(p.exports ? [{ id: 'export' as const, titre: 'image et vidéos', etat: 'capture, notice filmée, présentation', actif: false, corps: <div className="at-row">{p.exports}</div> }] : []),
  ]
  return (
    <div className="at-tools">
      {sections.map((s) => {
        const open = ouvertes.includes(s.id)
        return (
          <section key={s.id} className={`at-outil ${open ? 'open' : ''} ${s.actif ? 'actif' : ''}`}>
            <button type="button" className="at-outil-head" aria-expanded={open} onClick={() => bascule(s.id)}>
              <span className="at-outil-chev" aria-hidden />
              <b>{s.titre}</b>
              <i>{s.etat}</i>
            </button>
            {open && <div className="at-outil-body">{s.corps}</div>}
          </section>
        )
      })}
    </div>
  )
}
