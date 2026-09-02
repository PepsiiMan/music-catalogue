import { Hono } from 'hono'
import { AlbumDetectorClient, DetectionError } from './client.js'

export function albumDetectorRoutes(client = new AlbumDetectorClient()) {
  const routes = new Hono()

  routes.post('/detect', async (c) => {
    const contentType = c.req.header('content-type') ?? ''
    if (!contentType.startsWith('multipart/form-data')) {
      return c.body(null, 400)
    }

    try {
      const body = await c.req.arrayBuffer()
      const upstream = await client.detect(body, contentType)
      return new Response(upstream.body, {
        status: 200,
        headers: { 'Content-Type': upstream.headers.get('content-type') ?? 'application/json' },
      })
    } catch (err) {
      if (err instanceof DetectionError) {
        return c.body(err.body, err.statusCode as 400, { 'Content-Type': 'application/json' })
      }
      return c.body(null, 503)
    }
  })

  return routes
}
