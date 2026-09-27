import { db } from '../db/database'
import { recordAudit } from './audit'
import { portfolioValuation } from './portfolio'
import { createId } from '../utils/id'

const timestamp = () => new Date().toISOString()

export interface NewOrder {
  portfolioId: string
  instrumentId: string
  side: 'BUY' | 'SELL'
  quantity: number
  limitPrice: number
  validity: string
  actorId: string
  actorName: string
}

export async function checkOrder(input: NewOrder) {
  const portfolio = await portfolioValuation(input.portfolioId)
  const instrument = await db.instruments.get(input.instrumentId)
  if (!portfolio || !instrument) throw new Error('Le portefeuille ou l’instrument sélectionné est introuvable.')
  if (!Number.isInteger(input.quantity) || input.quantity <= 0) throw new Error('La quantité doit être un entier positif.')
  if (!Number.isFinite(input.limitPrice) || input.limitPrice <= 0) throw new Error('Le prix limite doit être positif.')

  const fees = input.quantity * input.limitPrice * 0.002
  const grossAmount = input.quantity * input.limitPrice
  const netAmount = grossAmount + fees
  const checks: { code: string; label: string; severity: 'OK' | 'WARNING' | 'BLOCKED'; message: string }[] = []
  const existingQuantity = portfolio.positions.find((position) => position.instrument.id === input.instrumentId)?.quantity ?? 0
  if (input.side === 'BUY') {
    checks.push(portfolio.cashBalance >= netAmount
      ? { code: 'CASH', label: 'Espèces disponibles', severity: 'OK', message: 'Solde espèces suffisant pour couvrir l’ordre et les frais simulés.' }
      : { code: 'CASH', label: 'Espèces disponibles', severity: 'BLOCKED', message: `Solde insuffisant : ${Math.round(netAmount - portfolio.cashBalance).toLocaleString('fr-FR')} FCFA manquants.` })
  } else {
    checks.push(existingQuantity >= input.quantity
      ? { code: 'QUANTITY', label: 'Titres disponibles', severity: 'OK', message: `${existingQuantity.toLocaleString('fr-FR')} titres disponibles dans le portefeuille.` }
      : { code: 'QUANTITY', label: 'Titres disponibles', severity: 'BLOCKED', message: `Position insuffisante : ${existingQuantity.toLocaleString('fr-FR')} titre(s) disponible(s).` })
  }

  const issuerValue = portfolio.positions.filter((position) => position.instrument.issuer === instrument.issuer).reduce((sum, position) => sum + position.marketValue, 0)
  const projected = issuerValue + (input.side === 'BUY' ? grossAmount : -grossAmount)
  const projectedPercent = portfolio.nav > 0 ? projected / portfolio.nav * 100 : 0
  const issuerRule = await db.limitRules.where('scope').equals('issuer').first()
  const issuerLimit = Number(issuerRule?.percentage ?? 35)
  checks.push(projectedPercent <= issuerLimit || input.side === 'SELL'
    ? { code: 'ISSUER_LIMIT', label: 'Limite de concentration émetteur', severity: 'OK', message: `Exposition projetée estimée à ${projectedPercent.toFixed(1)}% (limite démo ${issuerLimit}%).` }
    : { code: 'ISSUER_LIMIT', label: 'Limite de concentration émetteur', severity: 'WARNING', message: `Dépassement estimé : ${projectedPercent.toFixed(1)}% après ordre (limite démo ${issuerLimit}%). Approbation requise.` })

  checks.push({ code: 'MARKET', label: 'Données de marché', severity: 'OK', message: 'Instrument du référentiel local. Aucun ordre réel ne sera transmis.' })
  const blocked = checks.some((check) => check.severity === 'BLOCKED')
  const warning = checks.some((check) => check.severity === 'WARNING')
  return { checks, fees, grossAmount, netAmount, instrument, portfolio, status: blocked ? 'BLOCKED' : warning ? 'PENDING_APPROVAL' : 'PENDING_APPROVAL' }
}

export async function createOrder(input: NewOrder) {
  const result = await checkOrder(input)
  const createdAt = timestamp()
  const id = createId()
  const order = {
    id, portfolioId: input.portfolioId, instrumentId: input.instrumentId, side: input.side,
    quantity: input.quantity, limitPrice: input.limitPrice, validity: input.validity,
    fees: result.fees, grossAmount: result.grossAmount, netAmount: result.netAmount,
    status: result.status, creatorId: input.actorId, creatorName: input.actorName,
    reviewerId: undefined, reviewerName: undefined, executionDate: undefined,
    dataStatus: 'SIMULATED', createdAt, updatedAt: createdAt,
  }
  await db.transaction('rw', [db.orders, db.orderChecks], async () => {
    await db.orders.add(order)
    await db.orderChecks.bulkAdd(result.checks.map((check) => ({ id: createId(), orderId: id, ...check, status: check.severity, createdAt, updatedAt: createdAt })))
  })
  await recordAudit({ actorId: input.actorId, actorName: input.actorName, action: 'ORDER_CREATE', entityType: 'order', entityId: id, description: `Ordre ${input.side === 'BUY' ? 'd’achat' : 'de vente'} ${input.quantity} ${result.instrument.mnemonic} — ${order.status}`, metadata: { portfolioId: input.portfolioId, checks: result.checks } })
  return { order, checks: result.checks }
}

export async function listOrders() {
  return db.orders.orderBy('createdAt').reverse().toArray()
}

export async function approveOrder(orderId: string, actor: { id: string; name: string }) {
  const order = await db.orders.get(orderId)
  if (!order) throw new Error('Ordre introuvable.')
  if (String(order.status) !== 'PENDING_APPROVAL') throw new Error('Seuls les ordres en attente peuvent être approuvés.')
  if (String(order.creatorId) === actor.id) throw new Error('La validation maker-checker doit être effectuée par un second utilisateur fictif.')
  await db.orders.update(orderId, { status: 'APPROVED', reviewerId: actor.id, reviewerName: actor.name, updatedAt: timestamp() })
  await recordAudit({ actorId: actor.id, actorName: actor.name, action: 'ORDER_APPROVE', entityType: 'order', entityId: orderId, description: `Ordre approuvé séparément par ${actor.name}` })
}

export async function rejectOrder(orderId: string, actor: { id: string; name: string }) {
  const order = await db.orders.get(orderId)
  if (!order || String(order.status) !== 'PENDING_APPROVAL') throw new Error('Cet ordre ne peut pas être rejeté.')
  if (String(order.creatorId) === actor.id) throw new Error('Le rejet maker-checker doit être effectué par un second utilisateur fictif.')
  await db.orders.update(orderId, { status: 'REJECTED', reviewerId: actor.id, reviewerName: actor.name, updatedAt: timestamp() })
  await recordAudit({ actorId: actor.id, actorName: actor.name, action: 'ORDER_REJECT', entityType: 'order', entityId: orderId, description: `Ordre rejeté par ${actor.name}` })
}

export async function executeOrder(orderId: string, actor: { id: string; name: string }) {
  const order = await db.orders.get(orderId)
  if (!order || String(order.status) !== 'APPROVED') throw new Error('Seul un ordre approuvé peut être exécuté.')
  const portfolioId = String(order.portfolioId)
  const instrumentId = String(order.instrumentId)
  const cash = await db.cashAccounts.where('portfolioId').equals(portfolioId).first()
  const amount = Number(order.netAmount)
  if (!cash) throw new Error('Compte espèces introuvable.')
  if (order.side === 'BUY' && Number(cash.balance) < amount) throw new Error('Solde espèces modifié : l’ordre est bloqué à l’exécution.')
  const position = await portfolioValuation(portfolioId)
  const held = position?.positions.find((item) => item.instrument.id === instrumentId)?.quantity ?? 0
  if (order.side === 'SELL' && held < Number(order.quantity)) throw new Error('Position modifiée : la quantité disponible ne permet plus l’exécution.')
  const executedAt = timestamp()
  const transactionId = createId()
  await db.transaction('rw', [db.orders, db.transactions, db.cashAccounts], async () => {
    await db.transactions.add({ id: transactionId, portfolioId, instrumentId, type: order.side, side: order.side, quantity: order.quantity, unitPrice: order.limitPrice, amount: order.grossAmount, fees: order.fees, orderId, status: 'EXECUTED', source: 'SIMULATED', date: executedAt.slice(0, 10), createdAt: executedAt, updatedAt: executedAt })
    await db.cashAccounts.update(cash.id as string, { balance: Number(cash.balance) + (order.side === 'BUY' ? -amount : Number(order.grossAmount) - Number(order.fees)), updatedAt: executedAt })
    await db.orders.update(orderId, { status: 'EXECUTED', transactionId, executionDate: executedAt, updatedAt: executedAt })
  })
  await recordAudit({ actorId: actor.id, actorName: actor.name, action: 'ORDER_SIMULATED_EXECUTION', entityType: 'order', entityId: orderId, description: `Exécution simulée de l’ordre ${orderId}`, metadata: { transactionId } })
}
