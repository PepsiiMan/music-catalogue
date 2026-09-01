/** A DetectedAlbum: raw OCR detection from the video pipeline, unconfirmed. */
export interface DetectedAlbum {
  title: string
  artist: string
  row: number
  col: number
  source_frame: number
}

export interface DetectionResult {
  albums: DetectedAlbum[]
  total_frames_processed: number
  frames_with_detections: number
}
