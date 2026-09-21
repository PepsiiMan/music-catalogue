import { Hono } from 'hono'
import { MusicBrainzClient, RateLimiter } from './client.js'

export function musicBrainzRoutes(client = new MusicBrainzClient(new RateLimiter(1000))) {
  const routes = new Hono()

  routes.get('/albums', async (c) => {
    const title = c.req.query('title') ?? ''
    const artist = c.req.query('artist') ?? ''
    try {
      const releases = await client.searchAlbums(title, artist, 20)
      return c.json(releases)
    } catch {
      return c.body(null, 503)
    }
  })

  return routes
}
