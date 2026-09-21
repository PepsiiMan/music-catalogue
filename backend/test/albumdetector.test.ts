import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import { server } from './setup.js'
import { createApp } from '../src/app.js'
import { config } from '../src/config.js'
import type { DetectionResult } from '../src/albumdetector/models.js'

const app = createApp()

function multipartUploadRequest(path: string): Request {
  const formData = new FormData()
  formData.append('video', new File(['fake-video-data'], 'test.mp4'))
  return new Request(`http://localhost${path}`, { method: 'POST', body: formData })
}

describe('POST /api/import/detect', () => {
  it('streams the upload to album-detector and returns its result', async () => {
    const expected: DetectionResult = {
      albums: [{ title: 'Dark Side of the Moon', artist: 'Pink Floyd', row: 0, col: 0, source_frame: 5 }],
      total_frames_processed: 100,
      frames_with_detections: 10,
    }

    let upstreamSawMultipart = false
    server.use(
      http.post(`${config.albumDetectorUrl}/detect`, async ({ request }) => {
        expect(request.headers.get('content-type')).toContain('multipart/form-data')
        const formData = await request.formData()
        const video = formData.get('video')
        expect(video).toBeInstanceOf(File)
        expect((video as File).name).toBe('test.mp4')
        upstreamSawMultipart = true
        return HttpResponse.json(expected)
      }),
    )

    const res = await app.request(multipartUploadRequest('/api/import/detect'))

    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toContain('application/json')
    const result = (await res.json()) as DetectionResult
    expect(result.albums).toHaveLength(1)
    expect(result.albums[0]?.title).toBe('Dark Side of the Moon')
    expect(result.total_frames_processed).toBe(100)
    expect(upstreamSawMultipart).toBe(true)
  })

  it('proxies 422 from album-detector', async () => {
    server.use(
      http.post(`${config.albumDetectorUrl}/detect`, () =>
        HttpResponse.json({ detail: 'No album grid detected in any frame' }, { status: 422 }),
      ),
    )

    const res = await app.request(multipartUploadRequest('/api/import/detect'))

    expect(res.status).toBe(422)
    const body = (await res.json()) as { detail: string }
    expect(body.detail).toBe('No album grid detected in any frame')
  })

  it('proxies 400 from album-detector', async () => {
    server.use(
      http.post(`${config.albumDetectorUrl}/detect`, () =>
        HttpResponse.json({ detail: 'Invalid video file' }, { status: 400 }),
      ),
    )

    const res = await app.request(multipartUploadRequest('/api/import/detect'))

    expect(res.status).toBe(400)
  })

  it('returns 400 without calling upstream when the request is not multipart', async () => {
    let upstreamCalled = false
    server.use(
      http.post(`${config.albumDetectorUrl}/detect`, () => {
        upstreamCalled = true
        return HttpResponse.json({})
      }),
    )

    const res = await app.request(
      new Request('http://localhost/api/import/detect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      }),
    )

    expect(res.status).toBe(400)
    expect(upstreamCalled).toBe(false)
  })

  it('returns 503 when album-detector is unreachable', async () => {
    server.use(http.post(`${config.albumDetectorUrl}/detect`, () => HttpResponse.error()))

    const res = await app.request(multipartUploadRequest('/api/import/detect'))

    expect(res.status).toBe(503)
  })
})
