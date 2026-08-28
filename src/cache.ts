// Tiny in-memory TTL cache, replacing node-cache.
type Entry = { value: any; expiresAt: number }

export class Cache {
  private store = new Map<string, Entry>()
  private ttlSeconds: number

  constructor(ttlSeconds = 15) {
    this.ttlSeconds = ttlSeconds
  }

  get(key: string): any {
    const entry = this.store.get(key)
    if (entry === undefined) return undefined
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key)
      return undefined
    }
    return entry.value
  }

  set(key: string, value: any, ttlSeconds?: number): void {
    const ttl = ttlSeconds ?? this.ttlSeconds
    this.store.set(key, { value, expiresAt: Date.now() + ttl * 1000 })
  }
}
