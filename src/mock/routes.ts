// Table complète des routes de démo (ordre : routes statiques avant paramètres).
import { compileRoutes } from './router'
import { home } from './data/home'
import { launcher } from './data/launcher'
import { media } from './data/media'
import { projects } from './data/projects'
import { requests } from './data/requests'
import { system } from './data/system'

export const ROUTES = compileRoutes([
  ['GET', '/auth/token', () => ({ token: 'demo' })],
  ...media, ...requests, ...system, ...home, ...launcher, ...projects,
])
