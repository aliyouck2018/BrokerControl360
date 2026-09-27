import Dexie, { type EntityTable } from 'dexie'
import type { Instrument, MarketQuote, Portfolio } from '../types/database'

export class BrokerControlDatabase extends Dexie {
  countries!: EntityTable<Record<string, unknown>, 'id'>
  issuers!: EntityTable<Record<string, unknown>, 'id'>
  instruments!: EntityTable<Instrument, 'id'>
  marketQuotes!: EntityTable<MarketQuote, 'id'>
  marketIndex!: EntityTable<Record<string, unknown>, 'id'>
  opcvmFunds!: EntityTable<Record<string, unknown>, 'id'>
  opcvmNavs!: EntityTable<Record<string, unknown>, 'id'>
  portfolios!: EntityTable<Portfolio, 'id'>
  cashAccounts!: EntityTable<Record<string, unknown>, 'id'>
  transactions!: EntityTable<Record<string, unknown>, 'id'>
  orders!: EntityTable<Record<string, unknown>, 'id'>
  orderChecks!: EntityTable<Record<string, unknown>, 'id'>
  reconciliationSessions!: EntityTable<Record<string, unknown>, 'id'>
  reconciliationItems!: EntityTable<Record<string, unknown>, 'id'>
  limitRules!: EntityTable<Record<string, unknown>, 'id'>
  users!: EntityTable<Record<string, unknown>, 'id'>
  roles!: EntityTable<Record<string, unknown>, 'id'>
  auditEvents!: EntityTable<Record<string, unknown>, 'id'>
  reports!: EntityTable<Record<string, unknown>, 'id'>
  wikiArticles!: EntityTable<Record<string, unknown>, 'id'>
  wikiCategories!: EntityTable<Record<string, unknown>, 'id'>

  constructor(name = 'BrokerControl360') {
    super(name)

    this.version(1).stores({
      countries: 'id, code, name',
      issuers: 'id, name, countryCode, sector',
      instruments: 'id, &isin, mnemonic, name, issuer, country, assetClass, currency',
      marketQuotes: 'id, instrumentId, date, status, [instrumentId+date], [status+date]',
      marketIndex: 'id, code, date, status, [code+date]',
      opcvmFunds: 'id, code, name, issuer',
      opcvmNavs: 'id, fundId, date, status, [fundId+date]',
      portfolios: 'id, &code, name, strategy, currency, benchmark',
      cashAccounts: 'id, portfolioId, currency',
      transactions: 'id, portfolioId, instrumentId, type, date, status, [portfolioId+date]',
      orders: 'id, portfolioId, instrumentId, side, status, createdAt',
      orderChecks: 'id, orderId, severity, status, createdAt',
      reconciliationSessions: 'id, date, status, createdAt',
      reconciliationItems: 'id, sessionId, type, status, assignee, createdAt',
      limitRules: 'id, scope, scopeId, metric, active',
      users: 'id, name, roleId',
      roles: 'id, name',
      auditEvents: 'id, actorId, action, entityType, entityId, createdAt',
      reports: 'id, type, portfolioId, generatedAt, status',
      wikiArticles: 'id, &slug, title, categoryId, ruleClass, verificationStatus',
      wikiCategories: 'id, &slug, title',
    })

    // Version 2 réserve une migration stable pour les champs de provenance ajoutés
    // lorsque les bulletins seront importés à l'étape marché.
    this.version(2).stores({
      countries: 'id, code, name',
      issuers: 'id, name, countryCode, sector',
      instruments: 'id, &isin, mnemonic, name, issuer, country, assetClass, currency',
      marketQuotes: 'id, instrumentId, date, status, sourceBulletin, [instrumentId+date], [status+date]',
      marketIndex: 'id, code, date, status, [code+date]',
      opcvmFunds: 'id, code, name, issuer',
      opcvmNavs: 'id, fundId, date, status, [fundId+date]',
      portfolios: 'id, &code, name, strategy, currency, benchmark',
      cashAccounts: 'id, portfolioId, currency',
      transactions: 'id, portfolioId, instrumentId, type, date, status, [portfolioId+date]',
      orders: 'id, portfolioId, instrumentId, side, status, createdAt',
      orderChecks: 'id, orderId, severity, status, createdAt',
      reconciliationSessions: 'id, date, status, createdAt',
      reconciliationItems: 'id, sessionId, type, status, assignee, createdAt',
      limitRules: 'id, scope, scopeId, metric, active',
      users: 'id, name, roleId',
      roles: 'id, name',
      auditEvents: 'id, actorId, action, entityType, entityId, createdAt',
      reports: 'id, type, portfolioId, generatedAt, status',
      wikiArticles: 'id, &slug, title, categoryId, ruleClass, verificationStatus',
      wikiCategories: 'id, &slug, title',
    }).upgrade(async (transaction) => {
      await transaction.table('marketQuotes').toCollection().modify((quote: MarketQuote) => {
        quote.status ??= 'OBSERVED'
      })
      await transaction.table('marketIndex').toCollection().modify((entry: Record<string, unknown>) => {
        entry.status ??= 'OBSERVED'
      })
      await transaction.table('opcvmNavs').toCollection().modify((entry: Record<string, unknown>) => {
        entry.status ??= 'OBSERVED'
      })
    })

    this.version(3).stores({
      countries: 'id, code, name, createdAt',
      issuers: 'id, name, countryCode, sector, createdAt',
      instruments: 'id, &isin, mnemonic, name, issuer, country, assetClass, currency, createdAt',
      marketQuotes: 'id, instrumentId, date, status, sourceBulletin, createdAt, [instrumentId+date], [status+date]',
      marketIndex: 'id, code, date, status, createdAt, [code+date]',
      opcvmFunds: 'id, code, name, issuer, createdAt',
      opcvmNavs: 'id, fundId, date, status, createdAt, [fundId+date]',
      portfolios: 'id, &code, name, strategy, currency, benchmark, createdAt',
      cashAccounts: 'id, portfolioId, currency, createdAt',
      transactions: 'id, portfolioId, instrumentId, type, date, status, createdAt, [portfolioId+date]',
      orders: 'id, portfolioId, instrumentId, side, status, createdAt',
      orderChecks: 'id, orderId, severity, status, createdAt',
      reconciliationSessions: 'id, date, status, createdAt',
      reconciliationItems: 'id, sessionId, type, status, assignee, createdAt',
      limitRules: 'id, scope, scopeId, metric, active, createdAt',
      users: 'id, name, roleId, createdAt',
      roles: 'id, name, createdAt',
      auditEvents: 'id, actorId, action, entityType, entityId, createdAt',
      reports: 'id, type, portfolioId, generatedAt, status, createdAt',
      wikiArticles: 'id, &slug, title, categoryId, ruleClass, verificationStatus, createdAt',
      wikiCategories: 'id, &slug, title, createdAt',
    })

    this.version(4).stores({
      countries: 'id, code, name, createdAt',
      issuers: 'id, name, countryCode, sector, createdAt',
      instruments: 'id, &isin, mnemonic, name, issuer, country, assetClass, currency, createdAt',
      marketQuotes: 'id, instrumentId, date, status, sourceBulletin, createdAt, [instrumentId+date], [status+date]',
      marketIndex: 'id, code, date, status, createdAt, [code+date]',
      opcvmFunds: 'id, code, name, issuer, createdAt',
      opcvmNavs: 'id, fundId, date, status, createdAt, [fundId+date]',
      portfolios: 'id, &code, name, strategy, currency, benchmark, createdAt',
      cashAccounts: 'id, portfolioId, currency, createdAt',
      transactions: 'id, portfolioId, instrumentId, type, date, status, orderId, createdAt, [portfolioId+date]',
      orders: 'id, portfolioId, instrumentId, side, status, createdAt',
      orderChecks: 'id, orderId, severity, status, createdAt',
      reconciliationSessions: 'id, date, status, createdAt',
      reconciliationItems: 'id, sessionId, type, status, assignee, createdAt',
      limitRules: 'id, scope, scopeId, metric, active, createdAt',
      users: 'id, name, roleId, createdAt',
      roles: 'id, name, createdAt',
      auditEvents: 'id, actorId, action, entityType, entityId, createdAt',
      reports: 'id, type, portfolioId, generatedAt, status, createdAt',
      wikiArticles: 'id, &slug, title, categoryId, ruleClass, verificationStatus, createdAt',
      wikiCategories: 'id, &slug, title, createdAt',
    })
  }
}

export const db = new BrokerControlDatabase()
