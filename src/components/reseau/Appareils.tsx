import { useEffect, useState } from 'react'
import { apiDelete, apiPut, withConfirm } from '../../lib/api'
import { confirmDialog, toast } from '../../lib/dialog'
import {
  ETIQUETTES, ecrireFiltres, estInconnu, filtrer, libelleCategorie, lireFiltres, phraseResume, titreAppareil, vuIl,
  type Appareil, type EtatReseau, type Filtres,
} from '../../lib/reseau'
import { Btn, Card, Chip, Dot } from '../ui'

function Edition({ a, fait }: { a: Appareil; fait: (ok: boolean) => void }) {
  const [nom, setNom] = useState(a.nom || a.hote || a.fabricant.slice(0, 40))
  const [etiquette, setEtiquette] = useState(a.etiquette)
  const valider = async () => {
    try {
      await apiPut(`/reseau/connus/${encodeURIComponent(a.mac)}`, { nom, etiquette })
      toast(`${nom} enregistré`)
      fait(true)
    } catch (e) { toast(e instanceof Error ? e.message : 'refusé', 'crit') }
  }
  return (
    <form className="rs-edit" onSubmit={(e) => { e.preventDefault(); void valider() }}>
      <input type="text" value={nom} maxLength={40} placeholder="nom" aria-label="nom de l’appareil" onChange={(e) => setNom(e.target.value)} autoFocus />
      <input type="text" value={etiquette} maxLength={24} list="rs-etiquettes" placeholder="étiquette" aria-label="étiquette" onChange={(e) => setEtiquette(e.target.value)} />
      <Btn sm solid onClick={() => void valider()} disabled={!nom.trim()}>enregistrer</Btn>
      <Btn sm onClick={() => fait(false)}>annuler</Btn>
    </form>
  )
}

function Ligne({ a, relire }: { a: Appareil; relire: () => void }) {
  const [edition, setEdition] = useState(false)
  const marquer = async () => {
    try {
      await apiPut(`/reseau/connus/${encodeURIComponent(a.mac)}`, { nom: '' })
      toast('marqué comme connu')
      relire()
    } catch (e) { toast(e instanceof Error ? e.message : 'refusé', 'crit') }
  }
  const oublier = async () => {
    if (!(await confirmDialog({ title: `oublier ${titreAppareil(a)} ?`, body: 'Il redeviendra un appareil inconnu et sera annoncé de nouveau à son prochain passage.', ok: 'oublier', danger: true }))) return
    try {
      await apiDelete(`/reseau/connus/${encodeURIComponent(a.mac)}`, await withConfirm('reseau_oublier'))
      relire()
    } catch (e) { toast(e instanceof Error ? e.message : 'refusé', 'crit') }
  }
  return (
    <div className={`rs-ligne ${estInconnu(a) ? 'inconnu' : ''} ${a.present ? '' : 'absent'}`}>
      <Dot s={a.present ? 'ok' : 'off'} />
      <div className="rs-qui">
        <b>{titreAppareil(a)}</b>
        {a.etiquette && <Chip tone="gold">{a.etiquette}</Chip>}
        {estInconnu(a) && <Chip tone="rose">inconnu</Chip>}
        {!a.connu && libelleCategorie(a) && <Chip>{libelleCategorie(a)}</Chip>}
        {a.connu && !a.nom && <Chip>connu</Chip>}
        <small>{a.ip || '—'}{(a.ips?.length ?? 0) > 1 ? ` (+${(a.ips?.length ?? 1) - 1})` : ''} · {a.fabricant || 'fabricant inconnu'} · <code>{a.mac}</code></small>
      </div>
      <span className="rs-vu">{a.present ? 'en ligne' : vuIl(a.derniere_vue)}</span>
      <div className="rs-actions">
        {!edition && !a.connu && <Btn sm onClick={() => void marquer()}>c’est connu</Btn>}
        {!edition && <Btn sm onClick={() => setEdition(true)}>{a.connu ? 'modifier' : 'nommer'}</Btn>}
        {a.connu && !edition && <Btn sm danger onClick={() => void oublier()}>oublier</Btn>}
      </div>
      {edition && <Edition a={a} fait={(ok) => { setEdition(false); if (ok) relire() }} />}
    </div>
  )
}

export function Appareils({ etat, relire }: { etat: EtatReseau; relire: () => void }) {
  const [f, setF] = useState<Filtres>(() => lireFiltres(typeof localStorage === 'undefined' ? null : localStorage))
  useEffect(() => { ecrireFiltres(typeof localStorage === 'undefined' ? null : localStorage, f) }, [f])
  const liste = filtrer(etat.appareils, f)
  const bascule = (k: 'inconnus' | 'presents' | 'masquerAleatoires', label: string) => (
    <label className="rs-filtre"><input type="checkbox" checked={f[k]} onChange={() => setF({ ...f, [k]: !f[k] })} /> {label}</label>
  )
  return (
    <Card title="appareils du réseau local" lite={phraseResume(etat.resume)}>
      <div className="rs-filtres">
        {bascule('inconnus', 'inconnus seulement')}
        {bascule('presents', 'en ligne seulement')}
        {bascule('masquerAleatoires', 'masquer les adresses privées')}
        <input type="search" value={f.recherche} placeholder="chercher (nom, ip, fabricant)" aria-label="chercher un appareil" onChange={(e) => setF({ ...f, recherche: e.target.value })} />
      </div>
      <datalist id="rs-etiquettes">{ETIQUETTES.map((e) => <option key={e} value={e} />)}</datalist>
      {!etat.oui_charge && <p className="rs-note">Table des fabricants introuvable : les noms de marque ne s’affichent pas.</p>}
      {liste.length === 0 && <p className="rs-note">{etat.appareils.length ? 'Aucun appareil ne correspond aux filtres.' : 'Aucun appareil vu pour l’instant.'}</p>}
      {liste.map((a) => <Ligne key={a.mac} a={a} relire={relire} />)}
      <p className="rs-note">Relevé passif : la table de voisinage de cette machine, sans aucun scan. Un appareil qui n’a pas parlé au PC récemment peut manquer. Les noms viennent de la résolution du système (mDNS, DNS inverse) quand l’appareil en a un. Une adresse privée est en général un téléphone : « c’est connu » ou nomme-la.</p>
    </Card>
  )
}
