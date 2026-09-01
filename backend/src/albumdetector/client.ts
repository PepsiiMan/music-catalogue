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
   * Streams the incoming multipart body through to album-detector unchanged.
   * Upstream non-200 responses surface as DetectionError with the raw body.
   */
  async detect(body: ReadableStream, contentType: string): Promise<Response> {
    const response = await fetch(`${this.baseUrl}/detect`, {
      method: 'POST',
      headers: { 'Content-Type': contentType },
      body,
      duplex: 'half',
      signal: AbortSignal.timeout(this.timeoutMs),
    } as RequestInit)

    if (!response.ok) {
      throw new DetectionError(response.status, await response.text())
    }
    return response
  }
}
