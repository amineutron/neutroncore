import './resume.css'
import { heureValide, type CatalogueSection, type Reglages } from '../../lib/resume'
import { CityPicker } from './CityPicker'
import { SectionList } from './SectionList'
import { Card } from '../ui'

// Formulaire des réglages du résumé : contrôlé par le brouillon du parent (useResumeDraft).
export function ResumeEditor({ value, catalogue, introMax, onChange }: {
  value: Reglages; catalogue: CatalogueSection[]; introMax: number; onChange: (r: Reglages) => void
}) {
  const set = (patch: Partial<Reglages>) => onChange({ ...value, ...patch })
  return (
    <div className="rs-editor">
      <Card title="contenu" lite="activer, ordonner, limiter">
        <SectionList value={value.sections} catalogue={catalogue} onChange={(sections) => set({ sections })} />
      </Card>
      <Card title="introduction et heure">
        <label className="rs-field">
          <span>texte d'introduction <small>{value.intro.length}/{introMax} · {'{salutation}'} {'{date}'} {'{jour}'} {'{heure}'}</small></span>
          <textarea rows={2} maxLength={introMax} value={value.intro} onChange={(e) => set({ intro: e.target.value })} />
        </label>
        <label className="rs-field inline">
          <span>heure d'envoi</span>
          <input type="time" value={value.heure} aria-invalid={!heureValide(value.heure)}
            onChange={(e) => { if (heureValide(e.target.value)) set({ heure: e.target.value }) }} />
        </label>
      </Card>
      <Card title="météo" lite="sans clé, via open-meteo">
        <CityPicker value={value} onChange={onChange} />
      </Card>
      <Card title="où le voir">
        <label className="rs-check"><input type="checkbox" checked={value.accueil} onChange={(e) => set({ accueil: e.target.checked })} /><span>afficher sur l'accueil</span></label>
        <label className="rs-check"><input type="checkbox" checked={value.envoi.actif} onChange={(e) => set({ envoi: { ...value.envoi, actif: e.target.checked } })} /><span>l'envoyer chaque jour à l'heure choisie</span></label>
        <div className={`rs-sub ${value.envoi.actif ? '' : 'off'}`}>
          <label className="rs-check"><input type="checkbox" checked={value.envoi.centre} onChange={(e) => set({ envoi: { ...value.envoi, centre: e.target.checked } })} /><span>dans le centre de notifications</span></label>
          <label className="rs-check"><input type="checkbox" checked={value.envoi.telephone} onChange={(e) => set({ envoi: { ...value.envoi, telephone: e.target.checked } })} /><span>sur le téléphone (ntfy)</span></label>
        </div>
      </Card>
      <Card title="reformulation par ia" lite="facultatif, désactivé par défaut">
        <label className="rs-check"><input type="checkbox" checked={value.ia.actif} onChange={(e) => set({ ia: { ...value.ia, actif: e.target.checked } })} /><span>résumer en trois phrases avec un modèle local (ollama)</span></label>
        <label className={`rs-field inline ${value.ia.actif ? '' : 'off'}`}>
          <span>modèle</span>
          <input value={value.ia.modele} maxLength={60} onChange={(e) => set({ ia: { ...value.ia, modele: e.target.value } })} />
        </label>
        <p className="rs-note">le texte par gabarits reste la référence ; l'aperçu n'appelle jamais le modèle.</p>
      </Card>
    </div>
  )
}
