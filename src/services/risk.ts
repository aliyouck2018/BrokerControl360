import { db } from '../db/database'
import { portfolioValuation } from './portfolio'
import { recordAudit } from './audit'
import { postStateless } from './api'
import { createId } from '../utils/id'

export async function portfolioRisk(portfolioId: string) {
  const valuation = await portfolioValuation(portfolioId)
  if (!valuation) return undefined
  const denominator = valuation.nav || 1
  const grouped = new Map<string, { label: string; value: number }>()
  for (const position of valuation.positions) {
    const issuer = position.instrument.issuer
    const previous = grouped.get(issuer) ?? { label: issuer, value: 0 }
    previous.value += position.marketValue
    grouped.set(issuer, previous)
  }
  const exposures = [...grouped.values()].map((item) => ({ ...item, percentage: item.value / denominator * 100 })).sort((a, b) => b.value - a.value)
  const hhi = exposures.reduce((sum, item) => sum + item.percentage ** 2, 0)
  const assetGroups = new Map<string, number>()
  for (const position of valuation.positions) assetGroups.set(position.instrument.assetClass, (assetGroups.get(position.instrument.assetClass) ?? 0) + position.marketValue)
  const allocations = [...assetGroups].map(([assetClass, value]) => ({ assetClass, value, percentage: value / denominator * 100 }))
  const rules = await db.limitRules.toArray() as Record<string, unknown>[]
  const limits = rules.filter((rule) => Boolean(rule.active)).map((rule) => {
    const scope = String(rule.scope)
    const scopeId = String(rule.scopeId ?? '')
    const exposure = scope === 'issuer'
      ? exposures.find((item) => item.label === scopeId || item.label === String(rule.name).replace('Concentration par émetteur', '').trim())?.percentage ?? Math.max(0, ...exposures.map((item) => item.percentage))
      : scope === 'instrument'
        ? Math.max(0, ...valuation.positions.map((item) => item.marketValue / denominator * 100))
        : scope === 'assetClass'
          ? allocations.find((item) => item.assetClass === scopeId)?.percentage ?? 0
          : 0
    const threshold = Number(rule.percentage ?? 0)
    return {
      id: String(rule.id), name: String(rule.name), note: String(rule.note ?? ''), scope,
      percentage: threshold, verificationStatus: String(rule.verificationStatus ?? 'TO_VERIFY'),
      exposure, threshold, gap: exposure - threshold,
      status: exposure > threshold ? 'BREACH' : exposure >= threshold * 0.8 ? 'WARNING' : 'OK',
    }
  })
  const localStress = valuation.positions.reduce((sum, item) => {
    const shock = item.instrument.assetClass === 'EQUITY' ? -0.15 : item.instrument.assetClass === 'BOND' ? -0.04 * Math.max(1, Number((item.instrument as unknown as Record<string, unknown>).originalMaturityYears ?? 3)) : -0.02
    return sum + item.marketValue * shock
  }, 0)
  const apiStress = await postStateless<{ estimated_loss: number }>('/compute/stress-test', {
    positions: valuation.positions.map((position) => ({ quantity: 1, price: position.marketValue, accrued_interest: 0, asset_class: position.instrument.assetClass, duration: Number(position.instrument.originalMaturityYears ?? 3) })),
    cash_balance: valuation.cashBalance,
  })
  const estimatedStress = apiStress?.estimated_loss ?? localStress
  return { valuation, exposures, allocations, hhi, limits, estimatedStress, stressedNav: valuation.nav + estimatedStress, diversificationLabel: hhi < 1500 ? 'Diversification élevée' : hhi < 2500 ? 'Diversification modérée' : 'Concentration élevée' }
}

export async function createDemoLimit(actor: { id: string; name: string }, input: { name: string; scope: string; percentage: number }) {
  const timestamp = new Date().toISOString()
  const id = createId()
  const rule = { id, name: input.name.trim(), scope: input.scope, percentage: input.percentage, active: true, note: 'Paramètre de démonstration — à vérifier avec la conformité', verificationStatus: 'TO_VERIFY', createdAt: timestamp, updatedAt: timestamp }
  await db.limitRules.add(rule)
  await recordAudit({ actorId: actor.id, actorName: actor.name, action: 'LIMIT_RULE_CREATE', entityType: 'limitRule', entityId: id, description: `Nouvelle limite de démonstration : ${rule.name} (${rule.percentage}%)` })
  return rule
}
