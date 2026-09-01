import { Hono } from 'hono'
import { compress } from 'hono/compress'
import { logger } from 'hono/logger'
import { HTTPException } from 'hono/http-exception'
import { timeout } from './middleware/timeout.js'
import { throttleBacklog } from './middleware/throttle.js'
import { requestSize } from './middleware/requestSize.js'
import { musicBrainzRoutes } from './musicbrainz/handler.js'
import { MusicBrainzClient, RateLimiter } from './musicbrainz/client.js'
import { coverArtArchiveRoutes } from './coverartarchive/handler.js'
import { albumDetectorRoutes } from './albumdetector/handler.js'

export function createApp(rateLimiter?: RateLimiter) {
  const app = new Hono()

  app.onError((err, c) => {
    if (err instanceof HTTPException) return err.getResponse()
    console.error(err)
    return c.text('Internal Server Error', 500)
  })

  app.use(logger())
  app.use(timeout(30_000))
  app.use(compress())
  app.use(throttleBacklog(5, 30_000))

  app.get('/health', (c) => c.body(null, 200))

  const search = new Hono()
  search.use(requestSize(1 << 20))
  search.route('/', musicBrainzRoutes(new MusicBrainzClient(rateLimiter ?? new RateLimiter(1000))))
  search.route('/', coverArtArchiveRoutes())
  app.route('/api/search', search)

  const importRoutes = new Hono()
  importRoutes.use(requestSize(30 << 20))
  importRoutes.route('/', albumDetectorRoutes())
  app.route('/api/import', importRoutes)

  return app
}
