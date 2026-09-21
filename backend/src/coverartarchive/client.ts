import { config } from '../config.js'

const BASE_URL = 'https://coverartarchive.org/'

export class CoverArtArchiveClient {
  private readonly timeoutMs: number

  constructor(timeoutMs = 10_000) {
    this.timeoutMs = timeoutMs
  }

  /** Returns the redirect Location of the front cover image, without following the redirect. */
  async getFrontCover(mbid: string): Promise<string> {
    const response = await fetch(`${BASE_URL}release/${mbid}/front`, {
      headers: { 'User-Agent': config.userAgent },
      redirect: 'manual',
      signal: AbortSignal.timeout(this.timeoutMs),
    })

    if (response.status !== 302 && response.status !== 307) {
      throw new Error(`coverartarchive returned: ${response.status}`)
    }

    const location = response.headers.get('location')
    if (location === null) {
      throw new Error('coverartarchive redirect without Location header')
    }
    return location
  }
}
