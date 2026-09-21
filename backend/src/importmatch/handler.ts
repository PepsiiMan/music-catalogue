import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import type { AlbumSearcher } from './types.js'
import { MatchRequestSchema } from './types.js'
import { createMatchOrchestrator } from './orchestrator.js'

export function importMatchRoutes(searcher: AlbumSearcher) {
  const routes = new Hono()
  const matchAlbums = createMatchOrchestrator(searcher)

  routes.post('/match', zValidator('json', MatchRequestSchema), async (c) => {
    const { albums } = c.req.valid('json')
    const response = await matchAlbums(albums)
    return c.json(response)
  })

  return routes
}
