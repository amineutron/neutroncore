import { describe, expect, it } from 'vitest'
import { ordreStable, commandes, nomOutil, dureeTour, fmtDuree, horsAtelier, mergeTail, resumeCommandes, userText, type ChatMsg } from './sessions'

describe('texte d’un message de l’utilisateur', () => {
  it('une commande emballée redevient ce qui a été tapé', () => {
    expect(userText('<command-message>boucle-3d</command-message>\n<command-name>/boucle-3d</command-name>\n<command-args>boite_lego Je veux une boîte.\n\nAvec couvercle.</command-args>'))
      .toBe('/boucle-3d boite_lego Je veux une boîte.\n\nAvec couvercle.')
    expect(userText('<command-name>/clear</command-name>\n<command-message>clear</command-message>\n<command-args></command-args>')).toBe('/clear')
  })
  it('retire ce que l’utilisateur n’a pas écrit', () => {
    expect(userText('corrige la paroi\n<system-reminder>rappel interne\nsur deux lignes</system-reminder>')).toBe('corrige la paroi')
    expect(userText('<local-command-stdout>sortie</local-command-stdout>')).toBe('')
    expect(userText('<system-reminder>x</system-reminder>')).toBe('')
  })
  it('laisse un message ordinaire intact, chevrons compris', () => {
    expect(userText('si a < b alors <strong>non</strong>')).toBe('si a < b alors <strong>non</strong>')
    expect(userText('  bonjour  ')).toBe('bonjour')
    expect(userText('')).toBe('')
  })
  it('une réponse collée garde son texte, sans la balise de collage', () => {
    expect(userText('  <pasted_content id="df14">\nMes décisions : 0,4 mm.\n</pasted_content>')).toBe('Mes décisions : 0,4 mm.')
    expect(userText('<pasted_content id="df14">\nMessage tronqué avant la fin')).toBe('Message tronqué avant la fin')
  })
  it('le résumé automatique de contexte n’est pas affiché comme un message', () => {
    expect(userText('This session is being continued from a previous conversation that ran out of context. The summary…')).toBe('')
  })
})

describe('messages que l’utilisateur n’a pas écrits', () => {
  it('le compte rendu d’un sous-agent et les notifications de tâche ne sont pas affichés comme les siens', () => {
    expect(userText('Another Claude session sent a message: <agent-message from="a1">[Subagent hand-back] rapport</agent-message>')).toBe('')
    expect(userText('[SYSTEM NOTIFICATION - NOT USER INPUT]\n<task-notification><status>completed</status></task-notification>')).toBe('')
    expect(userText('<task-notification>\n<status>completed</status>\n</task-notification>')).toBe('')
    expect(userText('ok <agent-message from="x">bruit</agent-message> continue')).toBe('ok  continue')
  })
})

describe('exécution d’un tour', () => {
  const tour: ChatMsg = { who: 'claude', text: 'fait', at: '2026-10-12T12:03:20.000Z', from: '2026-10-12T12:00:00.000Z',
    tools: ['Bash: ls', 'Edit: a.ts', 'Bash: npm test', 'TodoWrite'], tools_at: ['2026-10-12T12:00:05.000Z', '2026-10-12T12:01:00.000Z', '2026-10-12T12:02:00.000Z', null] }

  it('la commande la plus récente vient en premier, avec son heure', () => {
    const c = commandes(tour)
    expect(c.map((x) => x.nom)).toEqual(['TodoWrite', 'Bash', 'Edit', 'Bash'])
    expect(c[1]).toEqual({ nom: 'Bash', arg: 'npm test', at: '2026-10-12T12:02:00.000Z' })
    expect(c[0].arg).toBe('')
    expect(commandes({ tools: undefined })).toEqual([])
  })

  it('le décompte dit les outils les plus utilisés et résume le reste', () => {
    expect(resumeCommandes(commandes(tour))).toBe('Bash ×2, TodoWrite, Edit')
    expect(resumeCommandes(commandes(tour), 1)).toBe('Bash ×2, +2')
  })

  it('un outil de serveur MCP se lit sans son emballage', () => {
    expect([nomOutil('mcp__playwright__browser_take_screenshot'), nomOutil('mcp__claude_ai_Notion__notion-search'), nomOutil('Bash'), nomOutil('mcp__x')])
      .toEqual(['playwright · take screenshot', 'Notion · notion-search', 'Bash', 'mcp__x'])
  })

  it('durées lisibles', () => {
    expect([fmtDuree(8.4), fmtDuree(60), fmtDuree(200), fmtDuree(3900), fmtDuree(-3)]).toEqual(['8 s', '1 min', '3 min 20', '1 h 05', '0 s'])
  })

  it('la durée du tour va de l’arrivée de la demande au dernier message', () => {
    expect(dureeTour(tour)).toBe(200)
    expect(dureeTour({ at: tour.at, from: null })).toBeNull()
    expect(dureeTour({ at: tour.at, from: tour.at })).toBeNull()
  })

  it('un tour en cours se complète : commandes, heures et réflexion s’ajoutent', () => {
    const avant: ChatMsg[] = [{ who: 'me', text: 'go', at: null }, { who: 'claude', text: 'je regarde', at: '2026-10-12T12:00:02.000Z', tools: ['Bash: ls'], think_s: 4 }]
    const apres = mergeTail(avant, [{ who: 'claude', text: '', at: '2026-10-12T12:00:30.000Z', tools: ['Edit: a.ts'], tools_at: ['2026-10-12T12:00:30.000Z'], think_s: 6 }, { who: 'me', text: 'ok', at: null }])
    expect(apres).toHaveLength(3)
    expect(apres[1]).toMatchObject({ text: 'je regarde', tools: ['Bash: ls', 'Edit: a.ts'], tools_at: [null, '2026-10-12T12:00:30.000Z'], think_s: 10, from: '2026-10-12T12:00:02.000Z', at: '2026-10-12T12:00:30.000Z' })
    expect(avant[1].tools).toEqual(['Bash: ls'])
    expect(mergeTail(avant, [{ who: 'me', text: 'x', at: null }])).toHaveLength(3)
  })

  it('les boucles de l’atelier ne sont pas des sessions du lanceur', () => {
    expect(horsAtelier([{ id: 1 }, { id: 2, atelier: 'boite' }, { id: 3, atelier: '' }]).map((s) => s.id)).toEqual([1, 3])
  })
})

describe('ordre stable des cartes de session', () => {
  const S = (sessionId: string, urgent = false) => ({ sessionId, urgent })

  it('le premier affichage suit l’ordre du serveur', () => {
    expect(ordreStable([], [], [S('b', true), S('a'), S('c')])).toEqual(['b', 'a', 'c'])
  })

  it('une activité ne déplace rien, même si le serveur change son tri', () => {
    expect(ordreStable(['a', 'b', 'c'], [], [S('c'), S('a'), S('b')])).toEqual(['a', 'b', 'c'])
  })

  it('une session qui se met à attendre remonte en tête, une fois', () => {
    expect(ordreStable(['a', 'b', 'c'], [], [S('c', true), S('a'), S('b')])).toEqual(['c', 'a', 'b'])
    expect(ordreStable(['a', 'c', 'b'], ['c'], [S('c', true), S('a'), S('b')])).toEqual(['a', 'c', 'b'])
  })

  it('une session qui n’attend plus reste où elle est', () => {
    expect(ordreStable(['c', 'a', 'b'], ['c'], [S('a'), S('b'), S('c')])).toEqual(['c', 'a', 'b'])
  })

  it('une nouvelle session arrive en tête, une session fermée disparaît', () => {
    expect(ordreStable(['a', 'b', 'c'], [], [S('a'), S('d'), S('c')])).toEqual(['d', 'a', 'c'])
  })
})
