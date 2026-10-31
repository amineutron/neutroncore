import { describe, expect, it } from 'vitest'
import { compileRoutes, mockRequest } from '../router'
import { ressources } from './ressources'

const routes = compileRoutes(ressources)
const get = (url: string) => mockRequest(routes, 'GET', url) as Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any

describe('démo des ressources', () => {
  it('courbes : fenêtre, réduction et résumé', () => {
    const c = get('/ressources/courbes?heures=24&points=240')
    expect(c.points.length).toBeLessThanOrEqual(240)
    expect(c.points.length).toBeGreaterThan(100)
    expect(c.resume.cpu.max).toBeGreaterThanOrEqual(c.resume.cpu.min)
    expect(get('/ressources/courbes?heures=1&points=240').nombre).toBeLessThan(c.nombre)
  })
  it('seuils retenus puis remis par défaut', () => {
    mockRequest(routes, 'PUT', '/ressources/seuils', { cpu: { warn: 70 } })
    expect(get('/ressources/seuils').seuils.cpu).toEqual({ warn: 70, crit: 98 })
    mockRequest(routes, 'DELETE', '/ressources/seuils')
    expect(get('/ressources/seuils').seuils.cpu).toEqual({ warn: 90, crit: 98 })
  })
  it('déchargement d\'un modèle', () => {
    expect(get('/ressources/gpu').ollama.modeles).toHaveLength(2)
    mockRequest(routes, 'POST', '/ressources/ollama/decharger', { modele: 'llama3.2:3b' })
    expect(get('/ressources/gpu').ollama.modeles.map((m: { nom: string }) => m.nom)).toEqual(['qwen2.5-coder:7b'])
  })
})
