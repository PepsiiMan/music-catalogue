import type { DetectionResult } from '../types'
import { api } from './client'

export const detectAlbums = (video: File) => {
  const formData = new FormData()
  formData.append('video', video)
  return api.post<DetectionResult>('/import/detect', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }).then(r => r.data)
}
