import { createMiddleware } from 'hono/factory'

/**
 * Aborts the request if the handler does not respond within `ms`.
 * Equivalent of chi's middleware.Timeout: runs the handler concurrently
 * and returns 504 if it loses the race.
 */
export function timeout(ms: number) {
  return createMiddleware(async (c, next) => {
    const timer = new Promise<'timeout'>((resolve) => {
      setTimeout(() => resolve('timeout'), ms)
    })
    const result = await Promise.race([next().then(() => 'done' as const), timer])
    if (result === 'timeout' && !c.finalized) {
      return c.text('Service Unavailable', 503)
    }
    return undefined
  })
}
