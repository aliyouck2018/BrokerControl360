import { db } from '../db/database'
import { recordAudit } from './audit'
import { postStateless, type ApiPosition } from './api'
import { createId } from '../utils/id'

const stamp = () => new Date().toISOString()

export async function latestInstrumentPrice(instrumentId: string) {
  const instrument = await db.instruments.get(instrumentId)
  if (instrument?.assetClass === 'FUND') {
    const fundId = String((instrument as unknown as Record<string, unknown>).fundId ?? '')
    const navs = await db.opcvmNavs.where('fundId').equals(fundId).toArray()
    return Number(navs.sort((a, b) => String(b.date).localeCompare(String(a.date)))[0]?.value ?? 0)
  }
  const quotes = await db.marketQuotes.where('instrumentId').equals(instrumentId).toArray()
  return Number(quotes.sort((a, b) => String(b.date).localeCompare(String(a.date)))[0]?.price ?? 0)
}

export async function seedDemoPortfolios() {
  const portfolios = [
    { id: 'portfolio-obligataire', code: 'AFB-OBL-001', name: 'Fonds obligataire CEMAC', strategy: 'Obligataire prudent', currency: 'XAF', benchmark: 'BVMAC-AS', manager: 'Sophie Nguema', owner: 'Institutionnel fictif', openingCash: 185_000_000 },
    { id: 'portfolio-diversifie', code: 'AFB-DIV-002', name: 'Portefeuille équilibre', strategy: 'Diversifiée équilibrée', currency: 'XAF', benchmark: 'BVMAC-AS', manager: 'Alexandre Mbarga', owner: 'Mandat démo 02', openingCash: 74_000_000 },
    { id: 'portfolio-tresorerie', code: 'AFB-TRE-003', name: 'Trésorerie régionale', strategy: 'Monétaire', currency: 'XAF', benchmark: 'BVMAC-AS', manager: 'Marcelle Ewane', owner: 'Institutionnel fictif', openingCash: 42_000_000 },
  ]
  const instruments = await db.instruments.toArray()
  const bonds = instruments.filter((instrument) => instrument.assetClass === 'BOND').sort((a, b) => a.isin.localeCompare(b.isin))
  const equities = instruments.filter((instrument) => instrument.assetClass === 'EQUITY').sort((a, b) => a.isin.localeCompare(b.isin))
  const funds = (await db.opcvmFunds.toArray()).sort((a, b) => String(a.name).localeCompare(String(b.name), 'fr'))
  const monetaryFund = funds.find((fund) => /mon[eé]taire|cash/i.test(String(fund.name))) ?? funds[0]
  const fundNav = monetaryFund
    ? (await db.opcvmNavs.where('fundId').equals(String(monetaryFund.id)).toArray()).sort((a, b) => String(b.date).localeCompare(String(a.date)))[0]
    : undefined
  const seededFundInstrument = monetaryFund ? {
    id: `demo-instrument-${String(monetaryFund.id)}`,
    isin: `DEMO-${String(monetaryFund.code)}`,
    mnemonic: String(monetaryFund.code),
    name: String(monetaryFund.name),
    issuer: String(monetaryFund.issuer ?? 'OPCVM de démonstration'),
    country: 'CEMAC', assetClass: 'FUND' as const, currency: 'XAF', manager: String(monetaryFund.manager ?? ''),
    fundId: String(monetaryFund.id), createdAt: stamp(), updatedAt: stamp(),
  } : undefined
  const fundInstrument = seededFundInstrument
    ? instruments.find((instrument) => instrument.id === seededFundInstrument.id) ?? seededFundInstrument
    : undefined
  const quotePrice = async (instrumentId: string | undefined, fallback: number) => {
    if (!instrumentId) return fallback
    const records = await db.marketQuotes.where('instrumentId').equals(instrumentId).toArray()
    return Number(records.sort((a, b) => String(b.date).localeCompare(String(a.date)))[0]?.price ?? fallback)
  }
  const firstBond = bonds[0]
  const secondBond = bonds[1]
  const equity = equities[0]
  const [firstBondPrice, secondBondPrice, equityPrice] = await Promise.all([
    quotePrice(firstBond?.id, Number(firstBond?.nominal ?? 5_000)),
    quotePrice(secondBond?.id, Number(secondBond?.nominal ?? 5_000)),
    quotePrice(equity?.id, 50_000),
  ])
  const seedBuys = [
    { portfolioId: 'portfolio-obligataire', instrumentId: firstBond?.id, quantity: 5_000, unitPrice: firstBondPrice },
    { portfolioId: 'portfolio-obligataire', instrumentId: secondBond?.id, quantity: 3_500, unitPrice: secondBondPrice },
    { portfolioId: 'portfolio-diversifie', instrumentId: equity?.id, quantity: 900, unitPrice: equityPrice },
    { portfolioId: 'portfolio-diversifie', instrumentId: firstBond?.id, quantity: 2_400, unitPrice: firstBondPrice },
    { portfolioId: 'portfolio-tresorerie', instrumentId: fundInstrument?.id, quantity: 12_000, unitPrice: Number(fundNav?.value ?? 1_000) },
  ].filter((item): item is typeof item & { instrumentId: string } => Boolean(item.instrumentId))
  const timestamp = stamp()
  let insertedTransactions = 0
  await db.transaction('rw', [db.portfolios, db.cashAccounts, db.transactions, db.limitRules, db.instruments], async () => {
    for (const { openingCash: _openingCash, ...portfolio } of portfolios) {
      if (!await db.portfolios.get(portfolio.id)) await db.portfolios.add({ ...portfolio, createdAt: timestamp, updatedAt: timestamp })
    }
    if (seededFundInstrument && !await db.instruments.get(seededFundInstrument.id)) await db.instruments.add(seededFundInstrument as never)

    const insertedByPortfolio = new Map<string, number>()
    for (const [index, buy] of seedBuys.entries()) {
      const legacySeed = await db.transactions.where('portfolioId').equals(buy.portfolioId).filter((transaction) =>
        transaction.instrumentId === buy.instrumentId && transaction.type === 'BUY' && transaction.date === '2026-09-10'
        && Number(transaction.quantity) === buy.quantity && transaction.source === 'SIMULATED',
      ).first()
      const id = `demo-seed-transaction-${index + 1}`
      if (legacySeed || await db.transactions.get(id)) continue
      const amount = buy.quantity * buy.unitPrice
      await db.transactions.add({ id, ...buy, type: 'BUY', side: 'BUY', amount, fees: 0, status: 'EXECUTED', date: '2026-09-10', source: 'SIMULATED', createdAt: timestamp, updatedAt: timestamp })
      insertedTransactions += 1
      insertedByPortfolio.set(buy.portfolioId, (insertedByPortfolio.get(buy.portfolioId) ?? 0) + amount)
    }
    for (const portfolio of portfolios) {
      const accountId = `cash-${portfolio.id}`
      const account = await db.cashAccounts.get(accountId)
      if (account) {
        const deduction = insertedByPortfolio.get(portfolio.id) ?? 0
        if (deduction) await db.cashAccounts.update(accountId, { balance: Number(account.balance ?? 0) - deduction, updatedAt: timestamp })
      } else {
        const fixtures = seedBuys.filter((item) => item.portfolioId === portfolio.id)
        const seededAmount = fixtures.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0)
        await db.cashAccounts.add({ id: accountId, portfolioId: portfolio.id, currency: portfolio.currency, openingBalance: portfolio.openingCash, balance: portfolio.openingCash - seededAmount, createdAt: timestamp, updatedAt: timestamp })
      }
    }
    const defaultLimits = [
      { id: 'limit-instrument', name: 'Concentration par ligne', scope: 'instrument', percentage: 30, note: 'Limite de démonstration — à confirmer', active: true, verificationStatus: 'TO_VERIFY', createdAt: timestamp, updatedAt: timestamp },
      { id: 'limit-issuer', name: 'Concentration par émetteur', scope: 'issuer', percentage: 35, note: 'Seuil de démonstration, non réglementaire', active: true, verificationStatus: 'TO_VERIFY', createdAt: timestamp, updatedAt: timestamp },
      { id: 'limit-equity', name: 'Allocation actions', scope: 'assetClass', scopeId: 'EQUITY', percentage: 35, note: 'Paramètre de démonstration', active: true, verificationStatus: 'TO_VERIFY', createdAt: timestamp, updatedAt: timestamp },
    ]
    for (const rule of defaultLimits) if (!await db.limitRules.get(rule.id)) await db.limitRules.add(rule)
  })
  if (insertedTransactions) await recordAudit({ actorId: 'system', actorName: 'Système de démonstration', action: 'DEMO_PORTFOLIO_BACKFILL', entityType: 'portfolio', description: `Ajout idempotent de ${insertedTransactions} opération(s) synthétique(s) manquante(s)`, metadata: { insertedTransactions } })
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
    const quote = (instrument?.assetClass === 'FUND'
      ? (await db.opcvmNavs.where('fundId').equals(String((instrument as unknown as Record<string, unknown>).fundId)).toArray())
        .sort((a, b) => String(b.date).localeCompare(String(a.date)))
        .map((nav) => ({ ...nav, price: nav.value, accruedInterest: 0 }))
        [0]
      : (await db.marketQuotes.where('instrumentId').equals(instrumentId).toArray()).sort((a, b) => String(b.date).localeCompare(String(a.date)))[0]) as Record<string, unknown> | undefined
    if (!instrument || !quote) continue
    const accruedInterest = Number(quote.accruedInterest ?? 0)
    const price = Number(quote.price)
    const marketValue = quantity * (price + (instrument.assetClass === 'BOND' ? accruedInterest : 0))
    const quantityTransactions = transactions.filter((transaction) => String(transaction.instrumentId) === instrumentId && ['BUY', 'SELL'].includes(String(transaction.type)))
    const quantitySource = [...new Set(quantityTransactions.map((transaction) => String(transaction.source ?? transaction.status ?? 'LOCAL')))].join(', ')
    positions.push({ instrument, quantity, quantitySource, price, accruedInterest, marketValue, status: String(quote.status), quoteDate: String(quote.date), sourceBulletin: quote.sourceBulletin })
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
