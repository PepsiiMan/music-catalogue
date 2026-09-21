import { config } from '../config.js'
import type { MusicBrainzResponse, ReleaseDTO } from './models.js'
import { sanitizeLucene } from './sanitizeLucene.js'

const BASE_URL = 'https://musicbrainz.org/ws/2'
const FUZZY_SUFFIX = '~1'

/** Global token-bucket rate limiter: one request per interval, matching the Go client's ticker. */
export class RateLimiter {
  private tokens: number
  private readonly waiting: Array<() => void> = []
  private readonly timer: ReturnType<typeof setInterval>

  constructor(intervalMs: number) {
    this.tokens = 1
    this.timer = setInterval(() => this.tick(), intervalMs)
    this.timer.unref()
  }

  private tick(): void {
    const next = this.waiting.shift()
    if (next) {
      next()
    } else {
      this.tokens = 1
    }
  }

  acquire(): Promise<void> {
    if (this.tokens > 0) {
      this.tokens = 0
      return Promise.resolve()
    }
    return new Promise((resolve) => {
      this.waiting.push(resolve)
    })
  }

  dispose(): void {
    clearInterval(this.timer)
  }
}

export class MusicBrainzClient {
  private readonly limiter: RateLimiter
  private readonly timeoutMs: number

  constructor(limiter = new RateLimiter(1000), timeoutMs = 10_000) {
    this.limiter = limiter
    this.timeoutMs = timeoutMs
  }

  async searchAlbums(title: string, artist: string, limit: number): Promise<ReleaseDTO[]> {
    await this.limiter.acquire()

    const parts: string[] = []
    if (title !== '') parts.push(`title:${sanitizeLucene(title)}${FUZZY_SUFFIX}`)
    if (artist !== '') parts.push(`artist:${sanitizeLucene(artist)}${FUZZY_SUFFIX}`)

    const params = new URLSearchParams({
      query: parts.join(' AND '),
      fmt: 'json',
      limit: String(limit),
    })

    const response = await fetch(`${BASE_URL}/release/?${params.toString()}`, {
      headers: { 'User-Agent': config.userAgent },
      signal: AbortSignal.timeout(this.timeoutMs),
    })

    if (!response.ok) {
      throw new Error(`musicbrainz returned: ${response.status}`)
    }

    const result = (await response.json()) as MusicBrainzResponse

    const releases: ReleaseDTO[] = []
    for (const release of result.releases) {
      const artistCredit = release['artist-credit'][0]
      if (!artistCredit) continue
      releases.push({
        title: release.title,
        artist: artistCredit.artist.name,
        date: release.date,
        mbid: release.id,
      })
    }
    return releases
  }
}
