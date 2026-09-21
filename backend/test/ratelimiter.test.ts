import { describe, expect, it } from 'vitest'
import { RateLimiter } from '../src/musicbrainz/client.js'

describe('RateLimiter', () => {
  it('allows the first request immediately', async () => {
    const limiter = new RateLimiter(60_000)
    const start = Date.now()
    await limiter.acquire()
    expect(Date.now() - start).toBeLessThan(50)
    limiter.dispose()
  })

  it('serializes queued acquisitions at one per interval', async () => {
    const limiter = new RateLimiter(20)
    const times: number[] = []
    const start = Date.now()
    await Promise.all(
      [1, 2, 3].map(async () => {
        await limiter.acquire()
        times.push(Date.now() - start)
      }),
    )
    const sorted = [...times].sort((a, b) => a - b)
    expect(sorted[0]).toBeLessThan(20)
    expect(sorted[1]!).toBeGreaterThanOrEqual(15)
    expect(sorted[2]!).toBeGreaterThanOrEqual(35)
    limiter.dispose()
  })
})
