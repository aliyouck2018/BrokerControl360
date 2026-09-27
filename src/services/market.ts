import { db } from '../db/database'
import { loadBulletins, parseFrenchDate } from '../data/bulletins'
import { recordAudit } from './audit'

const now = () => new Date().toISOString()
const text = (value: unknown, fallback = '') => typeof value === 'string' ? value : fallback
const number = (value: unknown, fallback = 0) => typeof value === 'number' && Number.isFinite(value) ? value : fallback
const countryFromIsin = (isin: string) => ({ CM: 'Cameroun', GA: 'Gabon', CG: 'Congo', TD: 'Tchad', GQ: 'Guinée équatoriale', CF: 'RCA' })[isin.slice(0, 2)] ?? 'CEMAC'

export async function importMarketBulletins(actor = { id: 'system', name: 'Système de démonstration' }) {
  const sourceBulletins = await loadBulletins()
  const instruments = new Map<string, Record<string, unknown>>()
  const quotes: Record<string, unknown>[] = []
  const indices: Record<string, unknown>[] = []
  const funds = new Map<string, Record<string, unknown>>()
  const navs: Record<string, unknown>[] = []
  const issuers = new Map<string, Record<string, unknown>>()
  const dates = new Set<string>()
  let duplicateIsins = 0

  for (const { file, bulletin } of sourceBulletins) {
    const date = parseFrenchDate(bulletin.metadata.date)
    dates.add(date)
    const rows: { row: Record<string, unknown>; assetClass: 'EQUITY' | 'BOND' }[] = []
    rows.push(...bulletin.marche_des_actions.map((row) => ({ row, assetClass: 'EQUITY' as const })))
    for (const [section, list] of Object.entries(bulletin.marche_des_obligations)) {
      const assetClass: 'EQUITY' | 'BOND' = section.toLocaleLowerCase().includes('opcvm') ? 'EQUITY' : 'BOND'
      rows.push(...list.map((row) => ({ row, assetClass })))
    }

    const seenInBulletin = new Set<string>()
    for (const { row, assetClass } of rows) {
      const isin = text(row.code_isin)
      if (!isin) continue
      if (seenInBulletin.has(isin)) duplicateIsins += 1
      seenInBulletin.add(isin)
      const mnemonic = text(row.mnemo, isin)
      const issuer = text(row.designation_emetteur, 'Émetteur non renseigné')
      const isBond = assetClass === 'BOND'
      const isinCountry = countryFromIsin(isin)
      const nominal = number(row.nominal_j3, number(row.nominal, 100))
      const close = number(row.cloture, number(row.cours_du_jour_cloture, number(row.cours_precedent_pct)))
      const price = isBond ? nominal * close / 100 : close
      const existing = instruments.get(isin)
      const instrument = {
        id: isin,
        isin,
        mnemonic,
        name: text(row.designation_titre, text(row.nom_court_emetteur, issuer)),
        issuer,
        country: isinCountry,
        assetClass,
        currency: 'XAF',
        nominal: isBond ? nominal : undefined,
        couponRate: isBond ? number(row.taux_facial) : undefined,
        maturityDate: text(row.date_theorique_echeance_suivante),
        yield: number(row.rendement_net),
        originalMaturityYears: number(row.mat),
        status: text(row.statut, 'NC'),
        createdAt: existing?.createdAt ?? now(),
        updatedAt: now(),
      }
      instruments.set(isin, instrument)
      issuers.set(issuer, { id: issuer.toLocaleLowerCase().replace(/[^a-z0-9]+/g, '-'), name: issuer, countryCode: isin.slice(0, 2), sector: isBond ? 'Émetteur obligataire' : 'Société cotée', createdAt: now(), updatedAt: now() })
      quotes.push({
        id: `${isin}-${date}`,
        instrumentId: isin,
        date,
        price,
        pricePercent: isBond ? close : undefined,
        nominal,
        accruedInterest: number(row.coupon_couru_j3),
        volume: number(row.volume_transige),
        tradedValue: number(row.valeur_transigee),
        transactions: number(row.nbr_transactions),
        marketStatus: text(row.statut, 'NC'),
        status: 'OBSERVED',
        sourceBulletin: file,
        sourceDate: date,
        method: 'Import direct du bulletin officiel',
        createdAt: now(),
        updatedAt: now(),
      })
    }

    indices.push({
      id: `BVMAC-AS-${date}`, code: bulletin.metadata.indice.code,
      date, value: bulletin.metadata.indice.valeur,
      change: bulletin.metadata.indice.variation_jour,
      status: 'OBSERVED', sourceBulletin: file, sourceDate: date,
      createdAt: now(), updatedAt: now(),
    })

    for (const row of bulletin.opcvm ?? []) {
      const name = text(row.opcvm)
      if (!name) continue
      const id = name.toLocaleLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-')
      funds.set(id, { id, code: id.toUpperCase(), name, issuer: text(row.societe_de_gestion), manager: text(row.societe_de_gestion), custodian: text(row.depositaire), category: text(row.categorie), frequency: text(row.periodicite), createdAt: now(), updatedAt: now() })
      const navDate = parseFrenchDate(text(row.date_actuelle, bulletin.metadata.date))
      navs.push({ id: `${id}-${navDate}`, fundId: id, date: navDate, value: number(row.valeur_liquidative_actuelle), status: 'OBSERVED', sourceBulletin: file, sourceDate: date, createdAt: now(), updatedAt: now() })
    }
  }

  await db.transaction('rw', [db.countries, db.issuers, db.instruments, db.marketQuotes, db.marketIndex, db.opcvmFunds, db.opcvmNavs], async () => {
    await db.countries.bulkPut([
      ['CM', 'Cameroun'], ['GA', 'Gabon'], ['CG', 'Congo'], ['TD', 'Tchad'], ['GQ', 'Guinée équatoriale'], ['CF', 'République centrafricaine'],
    ].map(([code, name]) => ({ id: code, code, name, cemac: true, createdAt: now(), updatedAt: now() })))
    await db.issuers.bulkPut([...issuers.values()])
    await db.instruments.bulkPut([...instruments.values()] as never[])
    await db.marketQuotes.bulkPut(quotes as never[])
    await db.marketIndex.bulkPut(indices)
    await db.opcvmFunds.bulkPut([...funds.values()])
    await db.opcvmNavs.bulkPut(navs)
  })

  await recordAudit({ actorId: actor.id, actorName: actor.name, action: 'MARKET_IMPORT', entityType: 'market', description: `Import idempotent de ${dates.size} bulletins BVMAC`, metadata: { bulletins: dates.size, instruments: instruments.size, quotes: quotes.length, funds: funds.size, duplicateIsins } })
  return { bulletins: dates.size, instruments: instruments.size, quotes: quotes.length, funds: funds.size, duplicateIsins, firstDate: [...dates].sort()[0], lastDate: [...dates].sort().at(-1) }
}

export async function ensureMarketData() {
  if (await db.instruments.count() > 0) return
  await importMarketBulletins()
}

export async function ensureDemoHistory() {
  const [response, csvResponse] = await Promise.all([fetch('/history.json'), fetch('/history.csv')])
  if (!response.ok || !csvResponse.ok) throw new Error('L’historique JSON/CSV de démonstration est introuvable. Exécutez scripts/generate_demo_history.py.')
  const history = await response.json() as { metadata: { seed: number; counts: Record<string, number> }; marketIndex: Record<string, unknown>[] }
  const csvRows = parseCsv(await csvResponse.text())
  const columns = (csvRows.shift() ?? []).map((column, index) => index === 0 ? column.replace(/^\uFEFF/, '') : column)
  const historyQuotes = csvRows.map((row) => Object.fromEntries(columns.map((column, index) => [column, row[index] ?? ''])))
    .map((quote) => ({
      ...quote,
      isin: String(quote.isin),
      date: String(quote.date),
      price: Number(quote.price),
      volume: quote.volume === '' ? null : Number(quote.volume),
      status: String(quote.data_status),
      sourceBulletin: String(quote.sourceBulletin || '') || undefined,
      method: String(quote.method || '') || undefined,
      seed: Number(quote.seed),
    }))
  const timestamp = now()
  const generatedQuotes = historyQuotes.map((quote) => ({
    ...quote,
    id: `${String(quote.isin)}-${String(quote.date)}`,
    instrumentId: String(quote.isin),
    status: quote.status,
    volume: typeof quote.volume === 'number' ? quote.volume : null,
    createdAt: timestamp,
    updatedAt: timestamp,
  }))
  const generatedIndex = history.marketIndex.map((entry) => ({
    ...entry,
    id: `${String(entry.code)}-${String(entry.date)}`,
    createdAt: timestamp,
    updatedAt: timestamp,
  }))
  let insertedQuotes = 0
  let insertedIndices = 0
  await db.transaction('rw', [db.marketQuotes, db.marketIndex], async () => {
    const existing = await db.marketQuotes.bulkGet(generatedQuotes.map((quote) => String(quote.id)))
    const quotesToUpsert = generatedQuotes.filter((quote, index) => {
      const current = existing[index]
      // A synthetic history row can share the natural ISIN/date key with an
      // official observation. Keep the official record intact in that case.
      if (current?.status === 'OBSERVED') return false
      return !current || current.instrumentId !== quote.instrumentId || current.status !== quote.status
    })
    insertedQuotes = quotesToUpsert.length
    if (quotesToUpsert.length) await db.marketQuotes.bulkPut(quotesToUpsert as never[])
    const existingIndex = await db.marketIndex.bulkGet(generatedIndex.map((entry) => String(entry.id)))
    const indexToUpsert = generatedIndex.filter((entry, index) => {
      const current = existingIndex[index] as Record<string, unknown> | undefined
      return !current || current.status !== (entry as Record<string, unknown>).status
    })
    insertedIndices = indexToUpsert.length
    if (indexToUpsert.length) await db.marketIndex.bulkPut(indexToUpsert)
  })
  if (insertedQuotes || insertedIndices) await recordAudit({ actorId: 'system', actorName: 'Système de démonstration', action: 'DEMO_HISTORY_IMPORT', entityType: 'market', description: 'Import idempotent de l’historique BVMAC démonstratif, provenance SIMULATED et INTERPOLATED', metadata: { seed: history.metadata.seed, insertedQuotes, insertedIndices, counts: history.metadata.counts } })
}

function parseCsv(csv: string) {
  const rows: string[][] = []
  let row: string[] = []
  let value = ''
  let quoted = false
  for (let index = 0; index < csv.length; index += 1) {
    const character = csv[index]
    if (character === '"' && quoted && csv[index + 1] === '"') { value += '"'; index += 1 }
    else if (character === '"') quoted = !quoted
    else if (character === ',' && !quoted) { row.push(value); value = '' }
    else if ((character === '\n' || character === '\r') && !quoted) {
      if (character === '\r' && csv[index + 1] === '\n') index += 1
      row.push(value); value = ''
      if (row.some((cell) => cell.length)) rows.push(row)
      row = []
    } else value += character
  }
  if (value.length || row.length) { row.push(value); rows.push(row) }
  return rows
}

export async function marketSummary() {
  const [instruments, quotes, indices, funds] = await Promise.all([
    db.instruments.count(), db.marketQuotes.where('status').equals('OBSERVED').count(),
    db.marketIndex.where('status').equals('OBSERVED').last(), db.opcvmFunds.count(),
  ])
  return { instruments, quotes, index: indices?.value as number | undefined, indexDate: indices?.date as string | undefined, funds }
}

export async function filterInstruments(filters: { search?: string; assetClass?: string; country?: string; offset?: number; limit?: number }) {
  let items = await db.instruments.toArray()
  const search = filters.search?.trim().toLocaleLowerCase()
  if (search) items = items.filter((item) => `${item.name} ${item.mnemonic} ${item.isin} ${item.issuer}`.toLocaleLowerCase().includes(search))
  if (filters.assetClass) items = items.filter((item) => item.assetClass === filters.assetClass)
  if (filters.country) items = items.filter((item) => item.country === filters.country)
  items.sort((a, b) => a.name.localeCompare(b.name, 'fr'))
  return { total: items.length, items: items.slice(filters.offset ?? 0, (filters.offset ?? 0) + (filters.limit ?? 25)) }
}

export function countryNameFromIsin(isin: string) { return countryFromIsin(isin) }
