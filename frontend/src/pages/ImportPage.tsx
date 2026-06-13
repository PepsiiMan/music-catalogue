import { useEffect, useRef, useState } from "react"
import { motion } from "motion/react"
import { useToast } from "../components/Toast"
import { detectAlbums, ImportNoAlbumsError } from "../api/import"
import { PROCESSING_MESSAGES } from "../config/import"
import type { DetectionResult } from "../types"

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
  const { toast } = useToast()

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
          <div className="text-center py-16" data-testid="results-view">
            <p className="text-xl text-gray-300">Detected {result.albums.length} album(s)</p>
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
