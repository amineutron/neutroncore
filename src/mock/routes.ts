// Table complète des routes de démo (ordre : routes statiques avant paramètres).
import { compileRoutes } from './router'
import { ATELIER_ROUTES } from './data/atelier'
import { home } from './data/home'
import { launcher } from './data/launcher'
import { lumiere } from './data/lumiere'
import { media } from './data/media'
import { projects } from './data/projects'
import { requests } from './data/requests'
import { system } from './data/system'

export const ROUTES = compileRoutes([
  ['GET', '/auth/token', () => ({ token: 'demo' })],
  ...ATELIER_ROUTES, ...media, ...requests, ...system, ...lumiere, ...home, ...launcher, ...projects,
])
