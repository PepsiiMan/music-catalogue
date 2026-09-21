import { z } from 'zod'

/**
 * Domain schemas, kept for future use. Nothing validates with these yet:
 * the service is a pure proxy and the frontend guards response shapes itself.
 * When the backend gains payloads worth validating (e.g. persisted albums),
 * wire these in with @hono/zod-validator.
 */

/** A DetectedAlbum: raw OCR detection from the video pipeline, unconfirmed. */
export const DetectedAlbumSchema = z.object({
  title: z.string(),
  artist: z.string(),
  row: z.number().int(),
  col: z.number().int(),
  source_frame: z.number().int(),
})

export const DetectionResultSchema = z.object({
  albums: z.array(DetectedAlbumSchema),
  total_frames_processed: z.number().int(),
  frames_with_detections: z.number().int(),
})

/** A Release: a MusicBrainz release as returned by search. The mbid identifies it. */
export const ReleaseSchema = z.object({
  mbid: z.string(),
  title: z.string(),
  artist: z.string(),
  date: z.string(),
})

/** An Album: an album the user has saved to their personal catalogue. */
export const AlbumSchema = z.object({
  id: z.number().int(),
  title: z.string(),
  artist: z.string(),
  release: z.string().nullable(),
  mbid: z.string().nullish(),
})
