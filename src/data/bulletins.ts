const bulletinFiles = [
  'BOC-20260901.json', 'BOC-20260902.json', 'BOC-20260903.json', 'BOC-20260904.json',
  'BOC-20260907.json', 'BOC-20260908.json', 'BOC-20260909.json', 'BOC-20260910.json',
  'BOC-20260911.json', 'BOC-20260914.json', 'BOC-20260915.json', 'BOC-20260916.json',
  'BOC-20260917.json', 'BOC-20260918.json', 'BOC-20260921.json', 'BOC-20260922.json',
  'BOC-20260923.json', 'BOC-20260924.json', 'BOC-20260925.json',
]

export interface Bulletin {
  metadata: { date: string; bulletin_numero: number; indice: { code: string; valeur: number; variation_jour: string } }
  marche_des_actions: Record<string, unknown>[]
  marche_des_obligations: Record<string, Record<string, unknown>[]>
  opcvm: Record<string, unknown>[]
}

export async function loadBulletins() {
  const rows = await Promise.all(bulletinFiles.map(async (file) => {
    const response = await fetch(`/market-data/${file}`)
    if (!response.ok) throw new Error(`Le bulletin ${file} est introuvable dans les données locales.`)
    return { file, bulletin: await response.json() as Bulletin }
  }))
  return rows.sort((a, b) => parseFrenchDate(a.bulletin.metadata.date).localeCompare(parseFrenchDate(b.bulletin.metadata.date)))
}

export function parseFrenchDate(value: string): string {
  const [day, month, year] = value.split('/')
  return `${year}-${month}-${day}`
}
