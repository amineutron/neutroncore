// Jeu d'icônes SVG inline (aucune police externe) pour personnaliser le glyphe
// d'une session Claude Code. Tracés 24x24, trait courant (currentColor).

export const ICONS: Record<string, { label: string; d: string }> = {
  terminal: { label: 'terminal', d: 'M4 5h16v14H4z M7 9l3 3-3 3 M12 15h5' },
  code: { label: 'code', d: 'M8 6l-5 6 5 6 M16 6l5 6-5 6 M13 4l-2 16' },
  bug: { label: 'bug', d: 'M9 8a3 3 0 016 0v1H9z M7 10h10v6a5 5 0 01-10 0z M3 12h4 M17 12h4 M4 18l3-2 M20 18l-3-2 M12 10v10' },
  rocket: { label: 'fusée', d: 'M12 3c3 2 5 6 4 11l-4 3-4-3c-1-5 1-9 4-11z M8 14l-3 3 2 2 M16 14l3 3-2 2 M12 9v1' },
  flask: { label: 'fiole', d: 'M9 3h6 M10 3v6l-5 9a2 2 0 002 3h10a2 2 0 002-3l-5-9V3 M7 16h10' },
  gear: { label: 'engrenage', d: 'M12 9a3 3 0 100 6 3 3 0 000-6z M12 2v3 M12 19v3 M2 12h3 M19 12h3 M5 5l2 2 M17 17l2 2 M5 19l2-2 M17 7l2-2' },
  server: { label: 'serveur', d: 'M4 4h16v6H4z M4 14h16v6H4z M7 7h1 M7 17h1' },
  database: { label: 'base', d: 'M5 6c0-2 3-3 7-3s7 1 7 3v12c0 2-3 3-7 3s-7-1-7-3z M5 6c0 2 3 3 7 3s7-1 7-3 M5 12c0 2 3 3 7 3s7-1 7-3' },
  cloud: { label: 'nuage', d: 'M7 18a4 4 0 010-8 5 5 0 019.6-1A3.5 3.5 0 0117 18z' },
  globe: { label: 'globe', d: 'M12 3a9 9 0 100 18 9 9 0 000-18z M3 12h18 M12 3c3 3 3 15 0 18 M12 3c-3 3-3 15 0 18' },
  tv: { label: 'télé', d: 'M3 5h18v12H3z M8 21h8 M12 17v4' },
  bulb: { label: 'ampoule', d: 'M9 18h6 M10 21h4 M8 10a4 4 0 118 0c0 2-2 3-2 5h-4c0-2-2-3-2-5z' },
  home: { label: 'maison', d: 'M3 11l9-7 9 7 M5 10v10h14V10 M10 20v-6h4v6' },
  music: { label: 'musique', d: 'M9 18a2 2 0 11-4 0 2 2 0 014 0z M19 16a2 2 0 11-4 0 2 2 0 014 0z M9 18V6l10-2v12' },
  film: { label: 'film', d: 'M3 5h18v14H3z M7 5v14 M17 5v14 M3 9h4 M3 15h4 M17 9h4 M17 15h4' },
  book: { label: 'livre', d: 'M4 4h7a2 2 0 012 2v14a2 2 0 00-2-2H4z M20 4h-7a2 2 0 00-2 2v14a2 2 0 012-2h7z' },
  folder: { label: 'dossier', d: 'M3 6h6l2 2h10v11H3z' },
  git: { label: 'git', d: 'M6 5a2 2 0 100 4 2 2 0 000-4z M6 15a2 2 0 100 4 2 2 0 000-4z M18 9a2 2 0 100 4 2 2 0 000-4z M6 9v6 M18 13c0 3-6 2-9 4' },
  key: { label: 'clé', d: 'M8 10a4 4 0 100 8 4 4 0 000-8z M11 14l9-9 M17 8l2 2 M14 11l2 2' },
  lock: { label: 'cadenas', d: 'M5 11h14v10H5z M8 11V7a4 4 0 018 0v4 M12 15v3' },
  shield: { label: 'bouclier', d: 'M12 3l8 3v6c0 5-4 8-8 9-4-1-8-4-8-9V6z M9 12l2 2 4-4' },
  bolt: { label: 'éclair', d: 'M13 2L5 14h6l-1 8 9-13h-6z' },
  fire: { label: 'flamme', d: 'M12 3c1 4 5 5 5 10a5 5 0 01-10 0c0-2 1-3 2-4 0 2 1 3 2 3 0-3-1-6 1-9z' },
  star: { label: 'étoile', d: 'M12 3l2.7 5.8 6.3.7-4.7 4.3 1.3 6.2-5.6-3.2L6.4 20l1.3-6.2L3 9.5l6.3-.7z' },
  heart: { label: 'cœur', d: 'M12 20l-7-7a4 4 0 016-5.5A4 4 0 0117 13z' },
  flag: { label: 'drapeau', d: 'M5 21V4 M5 4h12l-2 4 2 4H5' },
  bell: { label: 'cloche', d: 'M6 16V11a6 6 0 0112 0v5l2 2H4z M10 20a2 2 0 004 0' },
  wrench: { label: 'clé plate', d: 'M14 4a5 5 0 016 6l-9 9-4-4 9-9z M4 20l3-3' },
  box: { label: 'boîte', d: 'M3 8l9-4 9 4v9l-9 4-9-4z M3 8l9 4 9-4 M12 12v9' },
  chip: { label: 'puce', d: 'M7 7h10v10H7z M10 10h4v4h-4z M12 3v4 M12 17v4 M3 12h4 M17 12h4 M7 3v4 M17 3v4 M7 17v4 M17 17v4' },
  camera: { label: 'caméra', d: 'M3 8h4l2-3h6l2 3h4v11H3z M12 11a3 3 0 100 6 3 3 0 000-6z' },
  pen: { label: 'plume', d: 'M4 20l4-1 11-11-3-3L5 16z M13 7l3 3' },
  sun: { label: 'soleil', d: 'M12 8a4 4 0 100 8 4 4 0 000-8z M12 2v2 M12 20v2 M2 12h2 M20 12h2 M5 5l1.5 1.5 M17.5 17.5L19 19 M5 19l1.5-1.5 M17.5 6.5L19 5' },
  moon: { label: 'lune', d: 'M20 14A8 8 0 1110 4a6 6 0 0010 10z' },
  robot: { label: 'robot', d: 'M6 9h12v10H6z M9 13h1 M14 13h1 M9 17h6 M12 5v4 M12 3a1 1 0 100 2 1 1 0 000-2z M3 12h3 M18 12h3' },
}

export const ICON_IDS = Object.keys(ICONS)

export function Icon({ id, size = 16, color }: { id: string; size?: number; color?: string }) {
  const def = ICONS[id]
  if (!def) return null
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color ?? 'currentColor'} strokeWidth={1.8}
      strokeLinecap="round" strokeLinejoin="round" aria-label={def.label}>
      <path d={def.d} />
    </svg>
  )
}
