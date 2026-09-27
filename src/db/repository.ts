import type { EntityTable } from 'dexie'
import type { Entity } from '../types/database'

export class Repository<T extends Entity> {
  constructor(protected readonly table: EntityTable<T, 'id'>) {}

  list(offset = 0, limit = 50): Promise<T[]> {
    return this.table.orderBy('createdAt').reverse().offset(offset).limit(limit).toArray()
  }

  get(id: string): Promise<T | undefined> {
    return this.table.get(id as never)
  }

  async save(record: T): Promise<string> {
    const now = new Date().toISOString()
    const current = await this.table.get(record.id as never)
    const next = { ...record, createdAt: current?.createdAt ?? record.createdAt ?? now, updatedAt: now }
    await this.table.put(next)
    return next.id
  }

  delete(id: string): Promise<void> {
    return this.table.delete(id as never)
  }
}
