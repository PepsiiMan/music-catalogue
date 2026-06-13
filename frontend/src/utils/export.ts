import type { DetectedAlbum } from "../types"

export function toCsv(albums: DetectedAlbum[]): string {
  const header = "title,artist,row,col,source_frame"
  const rows = albums.map(a => `${a.title},${a.artist},${a.row},${a.col},${a.source_frame}`)
  return [header, ...rows].join("\n")
}

export function toJson(albums: DetectedAlbum[]): string {
  return JSON.stringify(albums, null, 2)
}

export function downloadBlob(content: string, filename: string, type: string) {
  const blob = new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
