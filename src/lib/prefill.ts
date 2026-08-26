// Pré-remplissage inter-écrans (ex: films -> demandes avec la recherche remplie)
let pending = ''
export function setPrefill(q: string): void { pending = q }
export function takePrefill(): string { const v = pending; pending = ''; return v }
