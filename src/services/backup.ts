import { db } from '../db/database'

const backupTables = ['countries', 'issuers', 'instruments', 'marketQuotes', 'marketIndex', 'opcvmFunds', 'opcvmNavs', 'portfolios', 'cashAccounts', 'transactions', 'orders', 'orderChecks', 'reconciliationSessions', 'reconciliationItems', 'limitRules', 'users', 'roles', 'auditEvents', 'reports', 'wikiArticles', 'wikiCategories'] as const
const backupSchema = 1

export async function exportBackup() {
  const data: Record<string, unknown[]> = {}
  for (const name of backupTables) data[name] = await db.table(name).toArray()
  return JSON.stringify({ application: 'BrokerControl360', schemaVersion: backupSchema, exportedAt: new Date().toISOString(), data }, null, 2)
}

export async function importBackup(raw: string) {
  let backup: Record<string, unknown>
  try { backup = JSON.parse(raw) as Record<string, unknown> } catch { throw new Error('Le fichier n’est pas un JSON valide.') }
  if (backup.application !== 'BrokerControl360' || backup.schemaVersion !== backupSchema || !backup.data || typeof backup.data !== 'object') throw new Error('Cette sauvegarde n’est pas compatible avec BrokerControl360.')
  const data = backup.data as Record<string, unknown>
  for (const name of backupTables) {
    if (!Array.isArray(data[name])) throw new Error(`La table ${name} est absente ou mal formée.`)
    if ((data[name] as unknown[]).some((row) => !row || typeof row !== 'object' || typeof (row as Record<string, unknown>).id !== 'string')) throw new Error(`La table ${name} contient un enregistrement invalide.`)
  }
  await db.transaction('rw', db.tables, async () => {
    for (const name of backupTables) await db.table(name).clear()
    for (const name of backupTables) await db.table(name).bulkPut(data[name] as Record<string, unknown>[])
  })
}

export async function resetDemoData() {
  await db.transaction('rw', db.tables, async () => {
    for (const name of backupTables) await db.table(name).clear()
  })
  localStorage.removeItem('brokercontrol360:seed-version')
}
