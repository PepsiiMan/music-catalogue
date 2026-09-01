import { createMiddleware } from 'hono/factory'
import { HTTPException } from 'hono/http-exception'

/**
 * Global concurrency limiter, equivalent of chi's
 * middleware.ThrottleBacklog(backlogLimit, backlogTimeout):
 * at most `limit` requests processed concurrently; excess requests wait
 * up to `backlogTimeoutMs` for a slot before receiving 429.
 */
export function throttleBacklog(limit: number, backlogTimeoutMs: number) {
  let active = 0
  const queue: Array<() => void> = []

  const acquire = (): Promise<void> => {
    if (active < limit) {
      active++
      return Promise.resolve()
    }
    return new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        const index = queue.indexOf(waiter)
        if (index !== -1) queue.splice(index, 1)
        reject(new HTTPException(429, { message: 'Too Many Requests' }))
      }, backlogTimeoutMs)
      const waiter = () => {
        clearTimeout(timer)
        active++
        resolve()
      }
      queue.push(waiter)
    })
  }

  const release = (): void => {
    const next = queue.shift()
    if (next) {
      next()
    } else {
      active--
    }
  }

  return createMiddleware(async (_c, next) => {
    await acquire()
    try {
      await next()
    } finally {
      release()
    }
  })
}
