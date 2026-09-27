import { db } from '../db/database'
import { portfolioValuation } from './portfolio'
import { recordAudit } from './audit'
import { createId } from '../utils/id'

const timestamp = () => new Date().toISOString()

export async function listReconciliations() {
  const sessions = await db.reconciliationSessions.orderBy('createdAt').reverse().toArray()
  return Promise.all(sessions.map(async (session) => ({ ...session, items: await db.reconciliationItems.where('sessionId').equals(String(session.id)).toArray() })))
}

export async function createReconciliation(portfolioId: string, actor: { id: string; name: string }) {
  const valuation = await portfolioValuation(portfolioId)
  if (!valuation) throw new Error('Portefeuille introuvable.')
  const now = timestamp()
  const sessionId = createId()
  const date = now.slice(0, 10)
  const line = valuation.positions[0]
  const items: Record<string, unknown>[] = []
  if (line) items.push({
    id: createId(), sessionId, type: 'POSITION', instrumentId: line.instrument.id,
    instrumentName: line.instrument.name, internalValue: line.quantity, externalValue: Math.max(0, line.quantity - 25),
    difference: 25, severity: 'WARNING', status: 'OPEN', assigneeId: actor.id,
    assigneeName: actor.name, comment: 'Écart synthétique généré pour illustrer le traitement des suspens.',
    createdAt: now, updatedAt: now,
  })
  items.push({ id: createId(), sessionId, type: 'CASH', instrumentName: 'Espèces XAF', internalValue: valuation.cashBalance, externalValue: valuation.cashBalance - 150_000, difference: 150_000, severity: 'WARNING', status: 'OPEN', assigneeId: actor.id, assigneeName: actor.name, comment: 'Écart espèces simulé — vérifier le mouvement en attente.', createdAt: now, updatedAt: now })
  await db.transaction('rw', [db.reconciliationSessions, db.reconciliationItems], async () => {
    await db.reconciliationSessions.add({ id: sessionId, portfolioId, portfolioName: valuation.portfolio.name, date, status: 'OPEN', positionCount: valuation.positions.length, exceptionCount: items.length, createdBy: actor.name, createdAt: now, updatedAt: now })
    await db.reconciliationItems.bulkAdd(items)
  })
  await recordAudit({ actorId: actor.id, actorName: actor.name, action: 'RECONCILIATION_CREATE', entityType: 'reconciliation', entityId: sessionId, description: `Rapprochement simulé créé pour ${valuation.portfolio.name}`, metadata: { anomalies: items.length } })
}

export async function updateReconciliationItem(itemId: string, input: { status: 'OPEN' | 'RESOLVED'; comment: string; actor: { id: string; name: string } }) {
  const item = await db.reconciliationItems.get(itemId)
  if (!item) throw new Error('Anomalie introuvable.')
  const now = timestamp()
  await db.reconciliationItems.update(itemId, { status: input.status, comment: input.comment, resolvedBy: input.status === 'RESOLVED' ? input.actor.name : undefined, resolvedAt: input.status === 'RESOLVED' ? now : undefined, updatedAt: now })
  const sessionId = String(item.sessionId)
  const remaining = await db.reconciliationItems.where('sessionId').equals(sessionId).filter((record) => record.status !== 'RESOLVED').count()
  await db.reconciliationSessions.update(sessionId, { status: remaining === 0 ? 'RESOLVED' : 'OPEN', updatedAt: now })
  await recordAudit({ actorId: input.actor.id, actorName: input.actor.name, action: input.status === 'RESOLVED' ? 'RECONCILIATION_RESOLVE' : 'RECONCILIATION_UPDATE', entityType: 'reconciliationItem', entityId: itemId, description: `${input.status === 'RESOLVED' ? 'Résolution' : 'Mise à jour'} de l’anomalie : ${String(item.instrumentName)}` })
}
