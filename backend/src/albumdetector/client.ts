import { config } from '../config.js'

export class DetectionError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly body: string,
  ) {
    super(`album-detector returned ${statusCode}: ${body}`)
    this.name = 'DetectionError'
  }
}

export class AlbumDetectorClient {
  private readonly baseUrl: string
  private readonly timeoutMs: number

  constructor(baseUrl = config.albumDetectorUrl, timeoutMs = 300_000) {
    this.baseUrl = baseUrl
    this.timeoutMs = timeoutMs
  }

  /**
   * Buffers the incoming multipart body and forwards it to album-detector
   * with an explicit Content-Length. Streaming (duplex: 'half') was tried
   * and reverted: under @hono/node-server the forwarded body stream stalls
   * and the upstream request never completes.
   * Upstream non-200 responses surface as DetectionError with the raw body.
   */
  async detect(body: ArrayBuffer, contentType: string): Promise<Response> {
    const response = await fetch(`${this.baseUrl}/detect`, {
      method: 'POST',
      headers: {
        'Content-Type': contentType,
        'Content-Length': String(body.byteLength),
      },
      body,
      signal: AbortSignal.timeout(this.timeoutMs),
    })

    if (!response.ok) {
      throw new DetectionError(response.status, await response.text())
    }
    return response
  }
}
