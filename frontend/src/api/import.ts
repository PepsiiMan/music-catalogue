import type { DetectionResult } from '../types'
import { api } from './client'
import { AxiosError } from 'axios'

export class ImportNetworkError extends Error {
  constructor(message = "Network error. Please check your connection.") {
    super(message)
    this.name = "ImportNetworkError"
  }
}

export class ImportServerError extends Error {
  constructor(message = "Server error. Please try again later.") {
    super(message)
    this.name = "ImportServerError"
  }
}

export class ImportNoAlbumsError extends Error {
  constructor(message = "No albums detected in this video.") {
    super(message)
    this.name = "ImportNoAlbumsError"
  }
}

export class ImportInvalidResponseError extends Error {
  constructor(message = "Invalid response from server.") {
    super(message)
    this.name = "ImportInvalidResponseError"
  }
}

function isValidDetectionResult(data: unknown): data is DetectionResult {
  if (typeof data !== "object" || data === null) return false
  const candidate = data as Record<string, unknown>
  return (
    Array.isArray(candidate.albums) &&
    typeof candidate.total_frames_processed === "number" &&
    typeof candidate.frames_with_detections === "number"
  )
}

export const detectAlbums = async (video: File): Promise<DetectionResult> => {
  const formData = new FormData()
  formData.append('video', video)
  try {
    const response = await api.post<unknown>('/import/detect', formData)
    if (!isValidDetectionResult(response.data)) {
      throw new ImportInvalidResponseError()
    }
    return response.data
  } catch (error) {
    if (error instanceof ImportInvalidResponseError) throw error
    if (error instanceof AxiosError) {
      if (!error.response) throw new ImportNetworkError()
      if (error.response.status >= 500) throw new ImportServerError()
      if (error.response.status === 422) throw new ImportNoAlbumsError()
    }
    throw new ImportServerError("Upload failed. Please try again.")
  }
}
