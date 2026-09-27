import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { vi } from 'vitest'
import { db } from '../db/database'
import demoHistory from '../../json_demo_2026/history.json'
import { importBackup, exportBackup } from './backup'
import { ensureDemoHistory, ensureMarketData, importMarketBulletins } from './market'
import { approveOrder, createOrder, executeOrder } from './orders'
import { portfolioValuation, seedDemoPortfolios } from './portfolio'
import { ensureWiki, searchWiki } from './wiki'
import { ensureDemoRoles } from './roles'
import { listReports, makeReport } from './reports'

describe('parcours métier local de démonstration', () => {
  const sourceData = import.meta.glob('../../json/BOC-*.json', { eager: true, import: 'default' }) as Record<string, unknown>
  beforeEach(async () => { await db.delete(); await db.open() })
  afterEach(async () => { await db.delete() })

  beforeEach(() => {
    let randomId = 1
    vi.stubGlobal('crypto', {
      getRandomValues: (values: Uint8Array) => {
        values.fill(randomId & 0xff)
        values[0] = (randomId >>> 24) & 0xff
        if (values.length > 1) values[1] = (randomId >>> 16) & 0xff
        if (values.length > 2) values[2] = (randomId >>> 8) & 0xff
        if (values.length > 3) values[3] = randomId & 0xff
        randomId += 1
        return values
      },
    })
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      const payload = url.endsWith('/history.json')
        ? { ...demoHistory, marketIndex: demoHistory.marketIndex.slice(0, 10), quotes: demoHistory.quotes.slice(0, 120) }
        : sourceData[`../../json/${url.split('/').at(-1)}`]
      if (url.endsWith('/history.csv')) {
        const fields = ['date', 'isin', 'mnemonic', 'assetClass', 'price', 'volume', 'data_status', 'sourceBulletin', 'method', 'seed']
        const quoteCSV = [fields.join(','), ...demoHistory.quotes.slice(0, 120).map((quote) => fields.map((field) => {
          const key = field === 'data_status' ? 'status' : field
          const cell = String((quote as unknown as Record<string, unknown>)[key] ?? '')
          return `"${cell.replaceAll('"', '""')}"`
        }).join(','))].join('\n')
        return { ok: true, text: async () => quoteCSV, json: async () => ({}) }
      }
      return { ok: Boolean(payload), json: async () => payload, text: async () => '' }
    }))
  })
  afterEach(() => { vi.unstubAllGlobals() })

  it('importe les bulletins de manière idempotente et sépare les statuts synthétiques', async () => {
    await ensureMarketData()
    const quoteCount = await db.marketQuotes.count()
    const second = await importMarketBulletins()

    expect(quoteCount).toBeGreaterThan(700)
    expect(await db.instruments.count()).toBeGreaterThan(30)
    expect(await db.marketQuotes.count()).toBe(quoteCount)
    expect(second.bulletins).toBe(19)

    await ensureDemoHistory()
    await seedDemoPortfolios()
    await ensureWiki()
    await ensureDemoRoles()
    expect(await db.marketQuotes.where('status').equals('OBSERVED').count()).toBe(quoteCount)
    expect(await db.marketQuotes.where('status').equals('SIMULATED').count()).toBeGreaterThan(0)
    expect(await db.marketIndex.where('status').equals('SIMULATED').count()).toBeGreaterThan(0)
    expect(await db.portfolios.count()).toBeGreaterThan(0)
    const bondPortfolio = await portfolioValuation('portfolio-obligataire')
    const diversifiedPortfolio = await portfolioValuation('portfolio-diversifie')
    const cashPortfolio = await portfolioValuation('portfolio-tresorerie')
    expect(bondPortfolio?.positions.some((position) => position.instrument.assetClass === 'BOND')).toBe(true)
    expect(diversifiedPortfolio?.positions.some((position) => position.instrument.assetClass === 'EQUITY')).toBe(true)
    expect(cashPortfolio?.positions.some((position) => position.instrument.assetClass === 'FUND')).toBe(true)
    const seededTransactions = await db.transactions.count()
    const seededCash = await db.cashAccounts.toArray()
    await seedDemoPortfolios()
    expect(await db.transactions.count()).toBe(seededTransactions)
    expect(await db.cashAccounts.toArray()).toEqual(seededCash)
    expect(await db.wikiArticles.count()).toBeGreaterThan(10)
    expect(await db.roles.count()).toBeGreaterThan(5)
  })

  it('exige un second rôle avant de créer une position par exécution simulée', async () => {
    await importMarketBulletins()
    await seedDemoPortfolios()
    const portfolio = await db.portfolios.get('portfolio-obligataire')
    const instrument = await db.instruments.where('assetClass').equals('BOND').first()
    expect(portfolio).toBeDefined()
    expect(instrument).toBeDefined()
    const before = await portfolioValuation(String(portfolio?.id))
    const order = await createOrder({
      portfolioId: String(portfolio?.id), instrumentId: String(instrument?.id), side: 'BUY',
      quantity: 1, limitPrice: 1_000, validity: 'DAY', actorId: 'risk_manager', actorName: 'Alexandre Mbarga',
    })
    expect(order.order.status).toBe('PENDING_APPROVAL')
    await expect(approveOrder(order.order.id, { id: 'risk_manager', name: 'Alexandre Mbarga' })).rejects.toThrow('second utilisateur')
    await approveOrder(order.order.id, { id: 'operator', name: 'Sophie Nguema' })
    await executeOrder(order.order.id, { id: 'operator', name: 'Sophie Nguema' })

    const after = await portfolioValuation(String(portfolio?.id))
    const beforeQuantity = before?.positions.find((item) => item.instrument.id === instrument?.id)?.quantity ?? 0
    const afterQuantity = after?.positions.find((item) => item.instrument.id === instrument?.id)?.quantity ?? 0
    expect(afterQuantity).toBe(beforeQuantity + 1)
    expect((await db.orders.get(order.order.id))?.status).toBe('EXECUTED')
    expect(await db.transactions.where('orderId').equals(order.order.id).count()).toBe(1)
  })

  it('génère et archive chaque modèle de rapport avec des versions successives', async () => {
    await importMarketBulletins()
    await ensureDemoHistory()
    await seedDemoPortfolios()
    const types = ['COMPOSITION', 'PERFORMANCE', 'LIMITS', 'OPERATIONS', 'INTERNAL_CONTROL', 'RECONCILIATION']
    for (const type of types) {
      const first = await makeReport('portfolio-obligataire', type, { id: 'director', name: 'Patrice Ondo' })
      const second = await makeReport('portfolio-obligataire', type, { id: 'director', name: 'Patrice Ondo' })
      expect(first.version).toBe(1)
      expect(second.version).toBe(2)
      expect(second.payload).toHaveProperty('positions')
    }
    expect((await listReports()).filter((report) => types.includes(String(report.type)))).toHaveLength(12)
  })

  it('valide une sauvegarde complète avant restauration de la base navigateur', async () => {
    await importMarketBulletins()
    await seedDemoPortfolios()
    const before = await db.instruments.count()
    const backup = await exportBackup()
    await db.instruments.clear()
    expect(await db.instruments.count()).toBe(0)
    await importBackup(backup)
    expect(await db.instruments.count()).toBe(before)
    await expect(importBackup('{"application":"autre"}')).rejects.toThrow('compatible')
  })

  it('précharge les catégories Wiki et retrouve les sujets de conformité et de marché', async () => {
    await ensureWiki()
    await ensureWiki()
    expect(await db.wikiCategories.count()).toBeGreaterThan(4)
    expect((await searchWiki('OPCVM')).some((article) => article.slug === 'opcvm-fcp-sicav')).toBe(true)
    expect((await searchWiki('duration')).some((article) => article.slug === 'duration-obligataire')).toBe(true)
    expect((await searchWiki('COSUMAF')).length).toBeGreaterThan(0)
  })
})
