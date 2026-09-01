import { serve } from '@hono/node-server'
import { createApp } from './app.js'
import { config } from './config.js'

serve({ fetch: createApp().fetch, port: config.port }, (info) => {
  console.log(`Listening on http://localhost:${info.port}`)
})
