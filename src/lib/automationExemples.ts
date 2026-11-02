import { EMPTY_DRAFT, type AutomationDraft } from './automations'

export type ExempleAutomation = { id: string; titre: string; phrase: string; draft: AutomationDraft }

/** Exemples proposés quand il n'y a encore aucune automatisation : ouverts dans l'éditeur, jamais enregistrés d'office.
 * N'emploient que des blocs sans appareil à régler (liste fermée du catalogue). */
export const EXEMPLES_AUTOMATISATION: readonly ExempleAutomation[] = [
  {
    id: 'telechargement', titre: 'téléchargement terminé', phrase: 'quand un téléchargement se termine, une notification dans l’app',
    draft: {
      ...EMPTY_DRAFT, name: 'téléchargement terminé',
      trigger: { type: 'download_done', params: { contains: '' } },
      actions: [{ action: 'notify.app', params: { message: 'un téléchargement vient de se terminer' } }],
    },
  },
  {
    id: 'soir', titre: 'tout éteindre le soir', phrase: 'à 23:30 en semaine, éteindre toutes les lumières',
    draft: {
      ...EMPTY_DRAFT, name: 'extinction du soir',
      trigger: { type: 'time', params: { time: '23:30', days: [0, 1, 2, 3, 4] } },
      actions: [{ action: 'hue.off', params: {} }],
    },
  },
]
