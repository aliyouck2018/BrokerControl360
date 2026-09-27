import { recordAudit } from './audit'
import { db } from '../db/database'

export const demoRoles = [
  { id: 'risk_manager', label: 'Risk manager', name: 'Alexandre Mbarga', initials: 'AM' },
  { id: 'operator', label: 'Opérateur / back-office', name: 'Sophie Nguema', initials: 'SN' },
  { id: 'portfolio_manager', label: 'Gestionnaire', name: 'Marcelle Ewane', initials: 'ME' },
  { id: 'compliance', label: 'Compliance officer', name: 'Emmanuel Nguema', initials: 'EN' },
  { id: 'auditor', label: 'Auditeur', name: 'Élise Mba', initials: 'ÉM' },
  { id: 'director', label: 'Direction', name: 'Patrice Ondo', initials: 'PO' },
  { id: 'administrator', label: 'Administrateur', name: 'Équipe démo', initials: 'ED' },
] as const

export type DemoRoleId = typeof demoRoles[number]['id']
export const roleStorageKey = 'brokercontrol360:demo-role'

export async function ensureDemoRoles() {
  const timestamp = new Date().toISOString()
  await db.transaction('rw', [db.roles, db.users], async () => {
    await db.roles.bulkPut(demoRoles.map((role) => ({ id: role.id, name: role.label, description: `Rôle illustratif ${role.label}`, createdAt: timestamp, updatedAt: timestamp })))
    await db.users.bulkPut(demoRoles.map((role) => ({ id: role.id, name: role.name, roleId: role.id, fictitious: true, createdAt: timestamp, updatedAt: timestamp })))
  })
}

export function readDemoRole(): DemoRoleId {
  const saved = localStorage.getItem(roleStorageKey)
  return demoRoles.find((role) => role.id === saved)?.id ?? 'risk_manager'
}

export async function selectDemoRole(roleId: DemoRoleId) {
  const role = demoRoles.find((item) => item.id === roleId) ?? demoRoles[0]
  localStorage.setItem(roleStorageKey, role.id)
  await recordAudit({ actorId: role.id, actorName: role.name, action: 'DEMO_ROLE_SELECTED', entityType: 'user', entityId: role.id, description: `Profil de démonstration sélectionné : ${role.label}` })
}
