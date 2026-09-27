import { db } from '../db/database'
import { createId } from '../utils/id'

export interface AuditInput {
  actorId: string
  actorName: string
  action: string
  entityType: string
  entityId?: string
  description: string
  metadata?: Record<string, unknown>
}

export async function recordAudit(input: AuditInput): Promise<void> {
  const timestamp = new Date().toISOString()
  await db.auditEvents.add({
    id: createId(),
    ...input,
    createdAt: timestamp,
    updatedAt: timestamp,
  })
}
