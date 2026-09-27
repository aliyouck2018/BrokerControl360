import { db } from '../db/database'
import { portfolioRisk } from './risk'
import { recordAudit } from './audit'
import { createId } from '../utils/id'

export async function makeReport(portfolioId: string, type: string, actor: { id: string; name: string }) {
  const risk = await portfolioRisk(portfolioId)
  if (!risk) throw new Error('Sélectionner un portefeuille valide.')
  const previousVersions = await db.reports.where('portfolioId').equals(portfolioId).filter((item) => item.type === type).count()
  const [cashAccount, allOrders, allSessions] = await Promise.all([
    db.cashAccounts.where('portfolioId').equals(portfolioId).first(),
    db.orders.where('portfolioId').equals(portfolioId).toArray(),
    db.reconciliationSessions.where('portfolioId').equals(portfolioId).toArray(),
  ])
  const openingBalance = Number(cashAccount?.openingBalance ?? risk.valuation.nav)
  const simpleReturnPct = openingBalance > 0 ? (risk.valuation.nav / openingBalance - 1) * 100 : 0
  const createdAt = new Date().toISOString()
  const report = {
    id: createId(), type, portfolioId, portfolioName: risk.valuation.portfolio.name,
    snapshotDate: createdAt.slice(0, 10), generatedAt: createdAt, status: 'DEMO', version: previousVersions + 1,
    dataSources: [...new Set(risk.valuation.positions.map((position) => position.sourceBulletin ? String(position.sourceBulletin).trim() : ''))].filter(Boolean),
    warning: 'Rapport de démonstration. Les données synthétiques et seuils illustratifs ne constituent pas un document réglementaire.',
    payload: {
      nav: risk.valuation.nav, cashBalance: risk.valuation.cashBalance, securitiesValue: risk.valuation.securitiesValue,
      openingBalance, simpleReturnPct,
      performanceDisclaimer: 'Variation indicative par rapport à l’apport initial, sans méthodologie TWR/MWR.',
      hhi: risk.hhi, allocations: risk.allocations, exposures: risk.exposures, limits: risk.limits,
      operations: { orders: allOrders.length, executed: allOrders.filter((order) => order.status === 'EXECUTED').length, rejected: allOrders.filter((order) => order.status === 'REJECTED').length },
      reconciliation: { sessions: allSessions.length, open: allSessions.filter((session) => session.status === 'OPEN').length },
      positions: risk.valuation.positions.map((position) => ({ isin: position.instrument.isin, mnemonic: position.instrument.mnemonic, name: position.instrument.name, issuer: position.instrument.issuer, quantity: position.quantity, price: position.price, marketValue: position.marketValue, status: position.status, quoteDate: position.quoteDate })),
      stressLoss: risk.estimatedStress, stressedNav: risk.stressedNav,
    },
    createdBy: actor.name, createdAt, updatedAt: createdAt,
  }
  await db.reports.add(report)
  await recordAudit({ actorId: actor.id, actorName: actor.name, action: 'REPORT_GENERATE', entityType: 'report', entityId: report.id, description: `Rapport ${type} généré — ${report.portfolioName}`, metadata: { portfolioId } })
  return report
}

export async function listReports() {
  return db.reports.orderBy('generatedAt').reverse().toArray()
}

export function reportHtml(report: Record<string, unknown>) {
  const payload = report.payload as Record<string, unknown>
  const positions = payload.positions as Record<string, unknown>[]
  const formatMoney = (value: unknown) => Number(value ?? 0).toLocaleString('fr-FR', { maximumFractionDigits: 0 })
  return `<!doctype html><html lang="fr"><meta charset="utf-8"><title>BrokerControl360 — Rapport de démonstration</title><style>body{font:14px/1.5 Arial,sans-serif;max-width:1050px;margin:38px auto;color:#1d3340;padding:0 20px}header{border-bottom:3px solid #287761;padding-bottom:18px}h1{margin:0;color:#193a4b}small,.muted{color:#73838b}.warning{padding:12px;background:#fff5dd;border-left:4px solid #c38b27;margin:20px 0}table{width:100%;border-collapse:collapse;margin:20px 0}th,td{text-align:left;border-bottom:1px solid #e4ebed;padding:9px}th{font-size:11px;color:#71838b;text-transform:uppercase}footer{margin-top:35px;border-top:1px solid #e4ebed;padding:12px;color:#849198;font-size:11px}@media print{button{display:none}body{margin:12mm auto}}</style><header><small>BROKERCONTROL360 · ${escapeHtml(String(report.type))} · VERSION ${Number(report.version)}</small><h1>${escapeHtml(String(report.portfolioName))}</h1><p>Arrêté au ${escapeHtml(String(report.snapshotDate))} · ${escapeHtml(String(report.createdBy))}</p></header><div class="warning"><strong>Document de démonstration.</strong> ${escapeHtml(String(report.warning))}</div><h2>Synthèse du portefeuille</h2><p><strong>Actif net :</strong> ${formatMoney(payload.nav)} FCFA · <strong>Espèces :</strong> ${formatMoney(payload.cashBalance)} FCFA · <strong>Concentration HHI :</strong> ${Number(payload.hhi).toFixed(0)}</p><p><strong>Performance indicative :</strong> ${Number(payload.simpleReturnPct).toFixed(2)}% depuis l’apport initial. ${escapeHtml(String(payload.performanceDisclaimer))}</p><p><strong>Ordres :</strong> ${Number((payload.operations as Record<string, unknown>).orders)} · exécutés ${Number((payload.operations as Record<string, unknown>).executed)} · rapprochements ouverts ${Number((payload.reconciliation as Record<string, unknown>).open)}</p><h2>Positions</h2><table><thead><tr><th>Instrument / ISIN</th><th>Émetteur</th><th>Quantité</th><th>Cours FCFA</th><th>Valorisation FCFA</th><th>Provenance</th></tr></thead><tbody>${positions.map((position) => `<tr><td>${escapeHtml(String(position.name))}<br><small>${escapeHtml(String(position.isin))}</small></td><td>${escapeHtml(String(position.issuer))}</td><td>${formatMoney(position.quantity)}</td><td>${formatMoney(position.price)}</td><td>${formatMoney(position.marketValue)}</td><td>${escapeHtml(String(position.status))}</td></tr>`).join('')}</tbody></table><h2>Limites de démonstration</h2><table><thead><tr><th>Contrôle</th><th>Exposition</th><th>Seuil</th><th>État</th></tr></thead><tbody>${(payload.limits as Record<string, unknown>[]).map((item) => `<tr><td>${escapeHtml(String(item.name))}</td><td>${Number(item.exposure).toFixed(1)}%</td><td>${Number(item.threshold).toFixed(1)}%</td><td>${escapeHtml(String(item.status))}</td></tr>`).join('')}</tbody></table><p><strong>Scénario de stress indicatif :</strong> ${formatMoney(payload.stressLoss)} FCFA · NAV stressée : ${formatMoney(payload.stressedNav)} FCFA</p><footer>Sources : ${escapeHtml((report.dataSources as string[]).join(', ') || 'portefeuille de démonstration')}. Les données SIMULATED et les seuils TO_VERIFY sont explicitement non réglementaires.</footer></html>`
}

export function exportReportCsv(report: Record<string, unknown>) {
  const positions = (report.payload as Record<string, unknown>).positions as Record<string, unknown>[]
  const quote = (value: unknown) => `"${String(value ?? '').replaceAll('"', '""')}"`
  const rows = [['Instrument', 'ISIN', 'Émetteur', 'Quantité', 'Cours FCFA', 'Valorisation FCFA', 'Provenance'], ...positions.map((item) => [item.name, item.isin, item.issuer, item.quantity, item.price, item.marketValue, item.status])]
  return rows.map((row) => row.map(quote).join(';')).join('\r\n')
}

export function escapeHtml(value: string) { return value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char] ?? char) }
