import { useEffect, useRef, useState } from "react"
import { motion } from "motion/react"
import { useToast } from "../components/Toast"
import { detectAlbums, ImportNoAlbumsError } from "../api/import"
import { PROCESSING_MESSAGES } from "../config/import"
import { toCsv, toJson, downloadBlob } from "../utils/export"
import type { DetectionResult, DetectedAlbum } from "../types"

const ALLOWED_VIDEO_TYPES = ["video/mp4", "video/webm", "video/quicktime"]
const MAX_FILE_SIZE = 30 * 1024 * 1024

type Phase = "idle" | "processing" | "results"

function ProgressView() {
  const [messageIndex, setMessageIndex] = useState(() => Math.floor(Math.random() * PROCESSING_MESSAGES.length))
  const [dots, setDots] = useState(0)

  useEffect(() => {
    const interval = setInterval(() => {
      setDots(prev => {
        if (prev >= 3) {
          setMessageIndex(Math.floor(Math.random() * PROCESSING_MESSAGES.length))
          return 0
        }
        return prev + 1
      })
    }, 1000)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="text-center py-16" data-testid="processing-view">
      <p className="text-xl text-gray-300">
        {PROCESSING_MESSAGES[messageIndex]}
        {".".repeat(dots)}
      </p>
    </div>
  )
}

export function ImportPage() {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [phase, setPhase] = useState<Phase>("idle")
  const [isDragging, setIsDragging] = useState(false)
  const [result, setResult] = useState<DetectionResult | null>(null)
  const [edits, setEdits] = useState<Record<number, { title?: string; artist?: string }>>({})
  const [editing, setEditing] = useState<{ index: number; field: "title" | "artist" } | null>(null)
  const { toast } = useToast()

  const getAlbumValue = (index: number, field: "title" | "artist") => {
    if (edits[index]?.[field] !== undefined) return edits[index][field]!
    return result!.albums[index][field]
  }

  const handleEditSave = (index: number, field: "title" | "artist", value: string) => {
    setEdits(prev => ({ ...prev, [index]: { ...prev[index], [field]: value } }))
    setEditing(null)
  }

  const handleEditCancel = () => {
    setEditing(null)
  }

  const handleClear = () => {
    setResult(null)
    setEdits({})
    setEditing(null)
    setPhase("idle")
  }

  const getExportAlbums = (): DetectedAlbum[] => {
    if (!result) return []
    return result.albums.map((album, index) => ({
      ...album,
      ...(edits[index]?.title !== undefined && { title: edits[index].title! }),
      ...(edits[index]?.artist !== undefined && { artist: edits[index].artist! }),
    }))
  }

  const handleExportCsv = () => {
    downloadBlob(toCsv(getExportAlbums()), "detections.csv", "text/csv")
  }

  const handleExportJson = () => {
    downloadBlob(toJson(getExportAlbums()), "detections.json", "application/json")
  }

  const validateFile = (file: File): boolean => {
    if (!ALLOWED_VIDEO_TYPES.includes(file.type)) {
      toast("Only video files are allowed (MP4, WebM, QuickTime).", "error")
      return false
    }
    if (file.size > MAX_FILE_SIZE) {
      toast("File is too large. Maximum size is 30MB.", "error")
      return false
    }
    return true
  }

  const submitFile = async (file: File) => {
    setPhase("processing")
    try {
      const data = await detectAlbums(file)
      setResult(data)
      setPhase("results")
    } catch (error) {
      setPhase("idle")
      if (error instanceof ImportNoAlbumsError) {
        toast(error.message, "info")
      } else if (error instanceof Error) {
        toast(error.message, "error")
      } else {
        toast("Upload failed. Please try again.", "error")
      }
    }
  }

  const handleFileSelect = (file: File | undefined) => {
    if (!file || !validateFile(file)) return
    submitFile(file)
  }

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files?.[0]
    handleFileSelect(file)
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.2 }}
    >
      <div className="max-w-4xl mx-auto p-8">
        <h1 className="text-3xl font-bold mb-8">Import</h1>

        {phase === "processing" && <ProgressView />}

        {phase === "results" && result && (
          <div className="py-8" data-testid="results-view">
            <div className="flex gap-6 mb-8 justify-center">
              <div className="bg-gray-800 rounded-lg px-4 py-2">
                <p className="text-gray-400 text-sm">Albums Detected</p>
                <p className="text-white text-2xl font-bold">{result.albums.length}</p>
              </div>
              <div className="bg-gray-800 rounded-lg px-4 py-2">
                <p className="text-gray-400 text-sm">Frames Processed</p>
                <p className="text-white text-2xl font-bold">{result.total_frames_processed}</p>
              </div>
              <div className="bg-gray-800 rounded-lg px-4 py-2">
                <p className="text-gray-400 text-sm">Frames with Detections</p>
                <p className="text-white text-2xl font-bold">{result.frames_with_detections}</p>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" data-testid="album-grid">
              {result.albums.map((_album, index) => (
                <div key={index} className="bg-gray-800 rounded-xl p-4 border border-gray-700">
                  {editing?.index === index && editing.field === "title" ? (
                    <input
                      type="text"
                      defaultValue={getAlbumValue(index, "title")}
                      autoFocus
                      className="bg-gray-700 text-white rounded px-2 py-1 w-full"
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleEditSave(index, "title", (e.target as HTMLInputElement).value)
                        if (e.key === "Escape") handleEditCancel()
                      }}
                      onBlur={(e) => handleEditSave(index, "title", e.target.value)}
                    />
                  ) : (
                    <h3
                      className="text-white font-semibold cursor-pointer hover:bg-gray-700 rounded px-2 py-1 -mx-2 -my-1"
                      onClick={() => setEditing({ index, field: "title" })}
                    >
                      {getAlbumValue(index, "title")}
                    </h3>
                  )}
                  {editing?.index === index && editing.field === "artist" ? (
                    <input
                      type="text"
                      defaultValue={getAlbumValue(index, "artist")}
                      autoFocus
                      className="bg-gray-700 text-gray-400 rounded px-2 py-1 w-full mt-1"
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleEditSave(index, "artist", (e.target as HTMLInputElement).value)
                        if (e.key === "Escape") handleEditCancel()
                      }}
                      onBlur={(e) => handleEditSave(index, "artist", e.target.value)}
                    />
                  ) : (
                    <p
                      className="text-gray-400 mt-1 cursor-pointer hover:bg-gray-700 rounded px-2 py-1 -mx-2 -my-1"
                      onClick={() => setEditing({ index, field: "artist" })}
                    >
                      {getAlbumValue(index, "artist")}
                    </p>
                  )}
                </div>
              ))}
            </div>
            <div className="flex justify-center gap-4 mt-8">
              <button
                type="button"
                onClick={handleExportCsv}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-white"
              >
                Export CSV
              </button>
              <button
                type="button"
                onClick={handleExportJson}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-white"
              >
                Export JSON
              </button>
              <button
                type="button"
                onClick={handleClear}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-white"
              >
                Clear
              </button>
            </div>
          </div>
        )}

        {phase === "idle" && (
          <div
            className={`border-2 border-dashed rounded-xl p-12 text-center transition-colors ${
              isDragging ? "border-blue-500 bg-blue-500/10" : "border-gray-600"
            }`}
            data-testid="upload-zone"
            onDragEnter={() => setIsDragging(true)}
            onDragLeave={() => setIsDragging(false)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
          >
            <p className="text-lg text-gray-300">Drop a video file here</p>
            <input
              ref={fileInputRef}
              type="file"
              accept="video/mp4,video/webm,video/quicktime"
              className="hidden"
              data-testid="file-input"
              onChange={(e) => handleFileSelect(e.target.files?.[0])}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="mt-4 px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-white"
            >
              Browse files
            </button>
          </div>
        )}
      </div>
    </motion.div>
  )
}
