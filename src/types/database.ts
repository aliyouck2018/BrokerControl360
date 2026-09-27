export type ProvenanceStatus = 'OBSERVED' | 'INTERPOLATED' | 'SIMULATED'

export interface Entity {
  id: string
  createdAt: string
  updatedAt: string
}

export interface Instrument extends Entity {
  isin: string
  mnemonic: string
  name: string
  issuer: string
  country: string
  assetClass: 'EQUITY' | 'BOND' | 'FUND'
  currency: string
  nominal?: number
  couponRate?: number
  maturityDate?: string
  yield?: number
  originalMaturityYears?: number
  status?: string
  manager?: string
  owner?: string
}

export interface MarketQuote extends Entity {
  instrumentId: string
  date: string
  price: number
  pricePercent?: number
  nominal?: number
  accruedInterest?: number
  volume: number | null
  tradedValue?: number
  transactions?: number
  marketStatus?: string
  status: ProvenanceStatus
  sourceBulletin?: string
  sourceDate?: string
  method?: string
  simulationSeed?: number
}

export interface Portfolio extends Entity {
  code: string
  name: string
  strategy: string
  currency: string
  benchmark: string
}

export interface LocalRecord extends Entity {
  [key: string]: unknown
}
