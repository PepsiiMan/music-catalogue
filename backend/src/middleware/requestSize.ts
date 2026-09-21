import { createMiddleware } from 'hono/factory'

/**
 * Rejects requests whose Content-Length exceeds `maxBytes` with 413.
 * Equivalent of chi's middleware.RequestSize.
 */
export function requestSize(maxBytes: number) {
  return createMiddleware(async (c, next) => {
    const contentLength = c.req.header('content-length')
    if (contentLength !== undefined && Number(contentLength) > maxBytes) {
      return c.text('Request Entity Too Large', 413)
    }
    await next()
    return undefined
  })
}
