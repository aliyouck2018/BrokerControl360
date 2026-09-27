import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { db } from '../db/database'
import type { Instrument } from '../types/database'
import MarketPage from './Market'

const instruments: Instrument[] = [
  { id: 'CM0000010009', isin: 'CM0000010009', mnemonic: 'SEMC', name: 'Société des eaux minérales', issuer: 'SEMC', country: 'Cameroun', assetClass: 'EQUITY', currency: 'XAF', createdAt: '2026-09-25', updatedAt: '2026-09-25' },
  { id: 'GQ0000010050', isin: 'GQ0000010050', mnemonic: 'BANGE', name: 'Banco Nacional', issuer: 'BANGE', country: 'Guinée équatoriale', assetClass: 'EQUITY', currency: 'XAF', createdAt: '2026-09-25', updatedAt: '2026-09-25' },
]

vi.mock('../services/market', () => ({
  filterInstruments: vi.fn(async ({ search, assetClass, country }: { search?: string; assetClass?: string; country?: string }) => ({
    total: instruments.length,
    items: instruments.filter((item) => (!search || `${item.name} ${item.mnemonic} ${item.isin} ${item.issuer}`.toLowerCase().includes(search.toLowerCase())) && (!assetClass || item.assetClass === assetClass) && (!country || item.country === country)),
  })),
  importMarketBulletins: vi.fn(),
  marketSummary: vi.fn(async () => ({ instruments: 2, quotes: 2, index: 1147.73, indexDate: '2026-09-25', funds: 68 })),
}))

describe('écran du référentiel marché', () => {
  afterEach(cleanup)

  beforeEach(async () => {
    await db.delete()
    await db.open()
    await db.marketQuotes.bulkPut(instruments.map((instrument) => ({
      id: `${instrument.id}-2026-09-25`, instrumentId: instrument.id, date: '2026-09-25',
      price: instrument.mnemonic === 'SEMC' ? 53_000 : 228_085, volume: 0,
      status: 'OBSERVED' as const, sourceBulletin: 'BOC-20260925.json',
      createdAt: '2026-09-25', updatedAt: '2026-09-25',
    })))
  })

  it('recherche un mnémonique et affiche explicitement la provenance du cours', async () => {
    render(<MarketPage />)
    expect(await screen.findByRole('row', { name: /SEMC/ })).toBeInTheDocument()
    expect(screen.getAllByText('Observé').length).toBeGreaterThan(0)

    fireEvent.change(screen.getByRole('textbox', { name: 'Rechercher un instrument' }), { target: { value: 'BANGE' } })
    await waitFor(() => expect(screen.getByRole('row', { name: /BANGE/ })).toBeInTheDocument())
    expect(screen.queryByRole('row', { name: /SEMC/ })).not.toBeInTheDocument()
  })
})
