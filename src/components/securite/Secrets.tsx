import './securite.css'
import { useState } from 'react'
import { apiGet } from '../../lib/api'
import { usePoll } from '../../lib/poll'
import { dureeCourte, parFichier, phraseRotation, tonRotation, type EtatSecrets, type Trouvaille } from '../../lib/securite'
import { Btn, Card, Chip, Dot, Loader } from '../ui'

type Scan = { depots: { depot: string; fichiers: number; trouvailles: Trouvaille[] }[]; trouvailles: Trouvaille[] }

// Lecture seule : l'API ne renvoie jamais une valeur, seulement des emplacements et des ages.
export function Secrets() {
  const etat = usePoll<EtatSecrets>(() => apiGet('/securite/secrets'), 60000)
  const scan = usePoll<Scan>(() => apiGet('/securite/secrets/scan'), 300000)
  const [busy, setBusy] = useState(false)

  async function rescanner() {
    setBusy(true)
    try {
      await Promise.all([apiGet('/securite/secrets?frais=true'), apiGet('/securite/secrets/scan?frais=true')])
      etat.refresh()
      scan.refresh()
    } finally {
      setBusy(false)
    }
  }

  const e = etat.data
  if (!e) return <Loader label={etat.error ?? 'lecture des secrets…'} />
  const v = e.vaultwarden
  const fichiers = parFichier(scan.data?.trouvailles ?? [])

  return (
    <>
      <div className="grid g3" style={{ marginBottom: 14 }}>
        <Card title="vaultwarden" lite="service utilisateur">
          <div className="sec-row"><Dot s={v.actif ? 'ok' : v.installe ? 'crit' : 'off'} />
            <b>{v.installe ? (v.actif ? 'actif' : v.etat) : 'non installé'}</b>
            {v.relances > 0 && <Chip tone="warn">{v.relances} relances</Chip>}</div>
          {v.depuis && <div className="sec-muted" style={{ marginTop: 6 }}>depuis {v.depuis}</div>}
          <div className="sec-muted">la valeur d'un secret n'est jamais lue ici.</div>
        </Card>
        <Card title="rotations" lite="âge des blobs .cred">
          {e.rotations.length === 0 && <div className="sec-muted">aucun blob .cred trouvé</div>}
          {e.rotations.map((r) => (
            <div key={r.nom} style={{ marginBottom: 6 }}>
              <Chip tone={tonRotation(r.etat)}>{r.etat === 'due' ? 'due' : r.etat === 'bientot' ? 'bientôt' : 'à jour'}</Chip> <b>{r.libelle}</b>
              <div className="sec-muted">{phraseRotation(r)}</div>
            </div>
          ))}
        </Card>
        <Card title="secrets en dur" lite={`scan il y a ${dureeCourte(e.scan_il_y_a_s)}`}>
          <div className="sec-row"><Chip tone={e.resume.en_dur ? 'warn' : 'ok'}>{e.resume.en_dur}</Chip>
            <span>{e.resume.en_dur ? 'à migrer vers une variable ou la voûte' : 'rien de détecté'}</span></div>
          <div style={{ marginTop: 8 }}><Btn sm onClick={rescanner} disabled={busy}>{busy ? 'scan…' : 'rescanner'}</Btn></div>
        </Card>
      </div>

      <Card title="emplacements" lite="chemin:ligne, sans la valeur">
        {fichiers.length === 0 && <div className="sec-muted">aucun motif de clé ou de mot de passe dans les dépôts suivis.</div>}
        {fichiers.map((f) => (
          <div key={f.fichier} className="sec-row" style={{ marginBottom: 4, flexWrap: 'wrap' }}>
            <code className="num">{f.fichier}:{f.lignes.join(', ')}</code>
            <Chip tone="warn">{f.motif}</Chip>
          </div>
        ))}
        {scan.data && (
          <div className="sec-muted" style={{ marginTop: 8 }}>
            {scan.data.depots.length} dépôts, {scan.data.depots.reduce((n, d) => n + d.fichiers, 0)} fichiers suivis lus.
            Marqueur d'exception : écrire « nosecret » sur la ligne.
          </div>
        )}
      </Card>
    </>
  )
}
