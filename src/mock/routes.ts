// Table complète des routes de démo (ordre : routes statiques avant paramètres).
import { compileRoutes } from './router'
import { ATELIER_ROUTES } from './data/atelier'
import { godeye } from './data/godeye'
import { home } from './data/home'
import { launcher } from './data/launcher'
import { lumiere } from './data/lumiere'
import { lumiereOutils } from './data/lumiereOutils'
import { lumiereSource } from './data/lumiereSource'
import { media } from './data/media'
import { projects } from './data/projects'
import { requests } from './data/requests'
import { system } from './data/system'
import { mises } from './data/mises'
import { sauvegardes } from './data/sauvegardes'
import { ressources } from './data/ressources'
import { vmsConsole } from './data/vms'
import { reseau } from './data/reseau'
import { securite } from './data/securite'
import { dv } from './data/dv'
import { sorties } from './data/sorties'
import { menage } from './data/menage'
import { ciDeps } from './data/ciDeps'
import { qualite } from './data/qualite'
import { historique } from './data/historique'
import { reveilDemo } from './data/reveil'
import { sonoDemo } from './data/sono'
import { lyraMemoire } from './data/lyraMemoire'
import { sandbox } from './data/sandbox'
import { reglages } from './data/reglages'
import { resume } from './data/resume'
import { cyber } from './data/cyber'
import { cameraStudio } from './data/cameraStudio'
import { minuteursDemo } from './data/minuteurs'
import { affichageWorldmonitor } from './data/worldmonitor'

export const ROUTES = compileRoutes([
  ['GET', '/auth/token', () => ({ token: 'demo' })],
  ...ATELIER_ROUTES, ...media, ...requests, ...system, ...godeye, ...lumiereOutils, ...lumiereSource, ...lumiere, ...mises, ...sauvegardes, ...ressources, ...vmsConsole, ...reseau, ...securite, ...dv, ...sorties, ...menage, ...ciDeps, ...qualite, ...historique, ...reveilDemo, ...sonoDemo,...lyraMemoire, ...sandbox, ...reglages, ...resume, ...cyber, ...cameraStudio, ...minuteursDemo,
  ['GET', '/tv/affichage', () => affichageWorldmonitor],
  ['POST', '/tv/afficher', () => ({ success: true, error: null })],
  ['POST', '/tv/remettre', () => ({ success: true, error: null })],
  ...home, ...launcher, ...projects,
])
