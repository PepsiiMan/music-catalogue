import { Hono } from 'hono'
import { CoverArtArchiveClient } from './client.js'

export function coverArtArchiveRoutes(client = new CoverArtArchiveClient()) {
  const routes = new Hono()

  routes.get('/coverart/:mbid/front', async (c) => {
    const mbid = c.req.param('mbid')
    try {
      const url = await client.getFrontCover(mbid)
      return c.json({ url })
    } catch {
      return c.body(null, 503)
    }
  })

  return routes
}
