import { afterEach, describe, expect, it } from 'vitest'
import Dexie from 'dexie'
import { BrokerControlDatabase } from './database'
import { Repository } from './repository'
import type { Portfolio } from '../types/database'
import { createId } from '../utils/id'

describe('IndexedDB locale', () => {
  const databases: BrokerControlDatabase[] = []

  afterEach(async () => {
    await Promise.all(databases.splice(0).map((database) => database.delete()))
  })

  it('crée le schéma versionné avec les magasins métier principaux', async () => {
    const database = new BrokerControlDatabase(`foundation-${createId()}`)
    databases.push(database)
    await database.open()

    expect(database.verno).toBe(4)
    expect(database.tables.map((table) => table.name)).toContain('marketQuotes')
    expect(database.tables.map((table) => table.name)).toContain('auditEvents')
    expect(database.tables.map((table) => table.name)).toContain('portfolios')
  })

  it('applique la migration de provenance depuis le schéma initial', async () => {
    const name = `migration-${createId()}`
    const legacy = new Dexie(name)
    legacy.version(1).stores({
      marketQuotes: 'id, instrumentId, date',
      marketIndex: 'id, code, date',
      opcvmNavs: 'id, fundId, date',
    })
    await legacy.table('marketQuotes').add({
      id: 'quote-1', instrumentId: 'instrument-1', date: '2026-09-01', price: 100, volume: 0,
    })
    await legacy.close()

    const migrated = new BrokerControlDatabase(name)
    databases.push(migrated)
    await migrated.open()

    expect((await migrated.marketQuotes.get('quote-1'))?.status).toBe('OBSERVED')
  })

  it('persiste et pagine les enregistrements via le repository', async () => {
    const database = new BrokerControlDatabase(`repository-${createId()}`)
    databases.push(database)
    await database.open()
    const repository = new Repository(database.portfolios)
    const portfolio: Portfolio = {
      id: 'portfolio-1', code: 'DEMO-01', name: 'Portefeuille de démonstration',
      strategy: 'OBLIGATAIRE', currency: 'XAF', benchmark: 'BVMAC-AS',
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    }

    await repository.save(portfolio)

    expect(await repository.get(portfolio.id)).toMatchObject({ code: 'DEMO-01' })
    expect(await repository.list(0, 10)).toHaveLength(1)
    await repository.delete(portfolio.id)
    expect(await repository.get(portfolio.id)).toBeUndefined()
  })
})
