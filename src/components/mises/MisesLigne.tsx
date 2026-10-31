import { useState } from 'react'
import { apiPost, withConfirm } from '../../lib/api'
import { confirmDialog, toast } from '../../lib/dialog'
import { labelSource, lienAvis, phraseSignature, retardPhrase, toneNiveau, toneSignature, type Item } from '../../lib/mises'
import { Btn, Chip } from '../ui'

function Avis({ ids }: { ids: string[] }) {
  return (
    <>
      {ids.map((id) => {
        const lien = lienAvis(id)
        return lien ? <a key={id} className="mi-avis" href={lien} target="_blank" rel="noreferrer">{id}</a> : <code key={id}>{id}</code>
      })}
    </>
  )
}

// Une mise à jour : résumé sur une ligne, détail (intégrité, sécurité, commande) au clic.
export function MisesLigne({ it, onApplied }: { it: Item; onApplied: () => void }) {
  const [ouvert, setOuvert] = useState(false)
  const [occupe, setOccupe] = useState(false)
  const act = it.proposition.action

  async function appliquer() {
    if (!act) return
    const ok = await confirmDialog({
      title: `mettre à jour ${it.nom} ?`,
      body: act.type === 'docker'
        ? `télécharge l'image ${act.cible}. Le conteneur garde l'ancienne version jusqu'à sa recréation.`
        : `lance « flatpak update ${act.cible} ». Fais-le quand l'application est fermée.`,
      ok: 'mettre à jour',
    })
    if (!ok) return
    setOccupe(true)
    try {
      await apiPost('/maj/appliquer', { type: act.type, cible: act.cible }, await withConfirm(`maj_${act.type}_${act.cible}`))
      toast(`${it.nom} : mise à jour faite`)
      onApplied()
    } catch (e) { toast((e as Error).message, 'crit') } finally { setOccupe(false) }
  }

  return (
    <div className={`mi-ligne ${ouvert ? 'open' : ''}`}>
      <button className="mi-resume" onClick={() => setOuvert(!ouvert)} aria-expanded={ouvert}>
        <span className="mi-nom">{it.nom}</span>
        <Chip>{labelSource(it.source)}</Chip>
        <span className="mi-ver">{it.installe ?? '?'} {it.disponible ? `-> ${it.disponible}` : '(à jour)'}</span>
        <span className={`mi-retard ${it.en_retard ? 'warn' : ''}`}>{retardPhrase(it)}</span>
        {it.securite.niveau !== 'aucune' && <Chip tone={toneNiveau(it.securite.niveau) as 'crit' | 'warn' | 'gold'}>sécurité {it.securite.niveau}</Chip>}
        <Chip tone={toneSignature(it.integrite.signature) || undefined}>{phraseSignature(it.integrite.signature)}</Chip>
      </button>
      {ouvert && (
        <div className="mi-detail">
          <p><b>intégrité</b> : {it.integrite.detail}{it.integrite.depot && <> (dépôt <code>{it.integrite.depot}</code>)</>}</p>
          {it.integrite.digest && <p><b>empreinte</b> <code>{it.integrite.digest}</code></p>}
          {it.integrite.origine && <p className="mi-meta">origine : {it.integrite.origine}</p>}
          {it.securite.avis.length > 0 && <p><b>avis</b> <Avis ids={it.securite.avis} /></p>}
          {it.securite.cves.length > 0 && <p><b>CVE</b> <Avis ids={it.securite.cves.slice(0, 12)} />{it.securite.cves.length > 12 && ` +${it.securite.cves.length - 12}`}</p>}
          {it.note && <p className="mi-meta">{it.note}</p>}
          {it.disponible && (
            <div className="mi-actions">
              <code className="mi-cmd">{it.proposition.commande}</code>
              <Btn sm onClick={() => { void navigator.clipboard?.writeText(it.proposition.commande); toast('commande copiée') }}>copier</Btn>
              {act ? <Btn sm solid disabled={occupe} onClick={() => void appliquer()}>{occupe ? 'en cours…' : 'mettre à jour'}</Btn>
                : <span className="mi-meta">à lancer à la main (droits administrateur ou code de projet)</span>}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
