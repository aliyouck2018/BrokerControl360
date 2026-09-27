import { afterEach, describe, expect, it, vi } from 'vitest'
import { createId } from './id'

describe('createId sur les origines HTTP et HTTPS', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('crée un UUID quand crypto.randomUUID est absent', () => {
    let value = 10
    vi.stubGlobal('crypto', {
      getRandomValues: (bytes: Uint8Array) => {
        for (let index = 0; index < bytes.length; index += 1) bytes[index] = value++ & 0xff
        return bytes
      },
    })

    expect(createId()).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
  })

  it('garde un fallback quand l’API crypto entière est absente', () => {
    vi.stubGlobal('crypto', undefined)
    expect(createId()).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
  })
})
