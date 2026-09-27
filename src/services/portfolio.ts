import { db } from '../db/database'
import { recordAudit } from './audit'
import { postStateless, type ApiPosition } from './api'
import { createId } from '../utils/id'

const stamp = () => new Date().toISOString()

export async function seedDemoPortfolios() {
  if (await db.portfolios.count()) return
  const portfolios = [
    { id: 'portfolio-obligataire', code: 'AFB-OBL-001', name: 'Fonds obligataire CEMAC', strategy: 'Obligataire prudent', currency: 'XAF', benchmark: 'BVMAC-AS', manager: 'Sophie Nguema', owner: 'Institutionnel fictif', openingCash: 185_000_000 },
    { id: 'portfolio-diversifie', code: 'AFB-DIV-002', name: 'Portefeuille équilibre', strategy: 'Diversifiée équilibrée', currency: 'XAF', benchmark: 'BVMAC-AS', manager: 'Alexandre Mbarga', owner: 'Mandat démo 02', openingCash: 74_000_000 },
    { id: 'portfolio-tresorerie', code: 'AFB-TRE-003', name: 'Trésorerie régionale', strategy: 'Monétaire', currency: 'XAF', benchmark: 'BVMAC-AS', manager: 'Marcelle Ewane', owner: 'Institutionnel fictif', openingCash: 42_000_000 },
  ]
  const firstBond = await db.instruments.where('assetClass').equals('BOND').first()
  const secondBond = await db.instruments.where('assetClass').equals('BOND').offset(1).first()
  const equity = await db.instruments.where('assetClass').equals('EQUITY').first()
  const firstBondQuote = firstBond ? (await db.marketQuotes.where('instrumentId').equals(firstBond.id).toArray()).sort((a, b) => String(b.date).localeCompare(String(a.date)))[0] : undefined
  const secondBondQuote = secondBond ? (await db.marketQuotes.where('instrumentId').equals(secondBond.id).toArray()).sort((a, b) => String(b.date).localeCompare(String(a.date)))[0] : undefined
  const equityQuote = equity ? await db.marketQuotes.where('instrumentId').equals(equity.id).last() : undefined
  const openingBalances = new Map(portfolios.map((portfolio) => [portfolio.id, portfolio.openingCash]))
  const timestamp = stamp()
  await db.transaction('rw', [db.portfolios, db.cashAccounts, db.transactions, db.limitRules], async () => {
    await db.portfolios.bulkPut(portfolios.map(({ openingCash, ...portfolio }) => ({ ...portfolio, createdAt: timestamp, updatedAt: timestamp })))
    await db.cashAccounts.bulkPut(portfolios.map((portfolio) => ({ id: `cash-${portfolio.id}`, portfolioId: portfolio.id, currency: portfolio.currency, openingBalance: portfolio.openingCash, balance: portfolio.openingCash, createdAt: timestamp, updatedAt: timestamp })))
    const syntheticTransactions: Record<string, unknown>[] = []
    const addBuy = (portfolioId: string, instrumentId: string | undefined, quantity: number, unitPrice: number) => {
      if (!instrumentId) return
      syntheticTransactions.push({ id: createId(), portfolioId, instrumentId, type: 'BUY', side: 'BUY', quantity, unitPrice, amount: quantity * unitPrice, fees: 0, status: 'EXECUTED', date: '2026-09-10', source: 'SIMULATED', createdAt: timestamp, updatedAt: timestamp })
      const portfolio = portfolios.find((item) => item.id === portfolioId)
      if (portfolio) portfolio.openingCash -= quantity * unitPrice
    }
    addBuy('portfolio-obligataire', firstBond?.id, 5_000, Number(firstBondQuote?.price ?? firstBond?.nominal ?? 5_000))
    addBuy('portfolio-obligataire', secondBond?.id, 3_500, Number(secondBondQuote?.price ?? secondBond?.nominal ?? 5_000))
    addBuy('portfolio-diversifie', equity?.id, 900, Number(equityQuote?.price ?? 50_000))
    addBuy('portfolio-diversifie', firstBond?.id, 2_400, Number(firstBondQuote?.price ?? firstBond?.nominal ?? 5_000))
    await db.transactions.bulkPut(syntheticTransactions)
    await db.cashAccounts.bulkPut(portfolios.map((portfolio) => ({ id: `cash-${portfolio.id}`, portfolioId: portfolio.id, currency: portfolio.currency, openingBalance: openingBalances.get(portfolio.id) ?? 0, balance: portfolio.openingCash, createdAt: timestamp, updatedAt: timestamp })))
    await db.limitRules.bulkPut([
      { id: 'limit-instrument', name: 'Concentration par ligne', scope: 'instrument', percentage: 30, note: 'Limite de démonstration — à confirmer', active: true, verificationStatus: 'TO_VERIFY', createdAt: timestamp, updatedAt: timestamp },
      { id: 'limit-issuer', name: 'Concentration par émetteur', scope: 'issuer', percentage: 35, note: 'Seuil de démonstration, non réglementaire', active: true, verificationStatus: 'TO_VERIFY', createdAt: timestamp, updatedAt: timestamp },
      { id: 'limit-equity', name: 'Allocation actions', scope: 'assetClass', scopeId: 'EQUITY', percentage: 35, note: 'Paramètre de démonstration', active: true, verificationStatus: 'TO_VERIFY', createdAt: timestamp, updatedAt: timestamp },
    ])
  })
}

export async function listPortfolios() {
  return db.portfolios.orderBy('name').toArray()
}

export async function createPortfolio(input: { name: string; strategy: string; manager: string; openingCash: number }) {
  const timestamp = stamp()
  const id = createId()
  const count = await db.portfolios.count()
  const portfolio = { id, code: `DEMO-${String(count + 1).padStart(3, '0')}`, name: input.name.trim(), strategy: input.strategy, currency: 'XAF', benchmark: 'BVMAC-AS', manager: input.manager, owner: 'Client institutionnel fictif', createdAt: timestamp, updatedAt: timestamp }
  await db.transaction('rw', [db.portfolios, db.cashAccounts], async () => {
    await db.portfolios.add(portfolio)
    await db.cashAccounts.add({ id: `cash-${id}`, portfolioId: id, currency: 'XAF', openingBalance: input.openingCash, balance: input.openingCash, createdAt: timestamp, updatedAt: timestamp })
  })
  await recordAudit({ actorId: input.manager, actorName: input.manager, action: 'PORTFOLIO_CREATE', entityType: 'portfolio', entityId: id, description: `Création du portefeuille ${portfolio.code}` })
  return portfolio
}

export async function portfolioValuation(portfolioId: string) {
  const portfolio = await db.portfolios.get(portfolioId)
  if (!portfolio) return undefined
  const [transactions, cash] = await Promise.all([
    db.transactions.where('portfolioId').equals(portfolioId).toArray(),
    db.cashAccounts.where('portfolioId').equals(portfolioId).first(),
  ])
  const quantities = new Map<string, number>()
  for (const transaction of transactions) {
    const instrumentId = String(transaction.instrumentId ?? '')
    if (!instrumentId || !['BUY', 'SELL'].includes(String(transaction.type))) continue
    const sign = transaction.type === 'BUY' ? 1 : -1
    quantities.set(instrumentId, (quantities.get(instrumentId) ?? 0) + sign * Number(transaction.quantity ?? 0))
  }
  const positions = []
  for (const [instrumentId, quantity] of quantities) {
    if (quantity <= 0) continue
    const instrument = await db.instruments.get(instrumentId)
    const quote = (await db.marketQuotes.where('instrumentId').equals(instrumentId).toArray()).sort((a, b) => String(b.date).localeCompare(String(a.date)))[0]
    if (!instrument || !quote) continue
    const accruedInterest = Number(quote.accruedInterest ?? 0)
    const price = Number(quote.price)
    const marketValue = quantity * (price + (instrument.assetClass === 'BOND' ? accruedInterest : 0))
    positions.push({ instrument, quantity, price, accruedInterest, marketValue, status: String(quote.status), quoteDate: String(quote.date), sourceBulletin: quote.sourceBulletin })
  }
  positions.sort((a, b) => b.marketValue - a.marketValue)
  const cashBalance = Number(cash?.balance ?? 0)
  const localSecuritiesValue = positions.reduce((sum, position) => sum + position.marketValue, 0)
  const localNav = localSecuritiesValue + cashBalance
  const apiValuation = await postStateless<{ securities_value: number; cash_balance: number; nav: number }>('/compute/valuation', {
    positions: positions.map((position) => ({ quantity: position.quantity, price: position.price, accrued_interest: position.instrument.assetClass === 'BOND' ? position.accruedInterest : 0, asset_class: position.instrument.assetClass, duration: Number(position.instrument.originalMaturityYears ?? 3) })),
    cash_balance: cashBalance,
  } satisfies { positions: ApiPosition[]; cash_balance: number })
  const securitiesValue = apiValuation?.securities_value ?? localSecuritiesValue
  const nav = apiValuation?.nav ?? localNav
  return { portfolio, positions, cashBalance, securitiesValue, nav, transactions: transactions.sort((a, b) => String(b.date).localeCompare(String(a.date))) }
}

export async function updateCash(portfolioId: string, amount: number) {
  const account = await db.cashAccounts.where('portfolioId').equals(portfolioId).first()
  if (!account) throw new Error('Compte espèces introuvable.')
  await db.cashAccounts.update(account.id as string, { balance: Number(account.balance ?? 0) + amount, updatedAt: stamp() })
}
