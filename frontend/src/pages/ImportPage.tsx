import { useEffect, useRef, useState } from "react"
import { motion } from "motion/react"
import { useNavigate } from "react-router-dom"
import { useToast } from "../components/Toast"
import { detectAlbums, ImportNoAlbumsError } from "../api/import"
import { matchAlbums } from "../api/importmatch"
import { createAlbum, deleteAlbum } from "../db/albums"
import { MatchCard, resolveChosen, type RowDecision } from "../components/MatchCard"
import { PROCESSING_MESSAGES, MATCHING_MESSAGES, COMMITTING_MESSAGES } from "../config/import"
import { toCsv, toJson, downloadBlob } from "../utils/export"
import type { Album, AlbumQuery, DetectionResult, DetectedAlbum, Match } from "../types"

const ALLOWED_VIDEO_TYPES = ["video/mp4", "video/webm", "video/quicktime"]
const MAX_FILE_SIZE = 30 * 1024 * 1024

type Phase = "idle" | "processing" | "results" | "matching" | "confirming" | "committing" | "done"

interface ProgressViewProps {
  messages: string[]
  testId: string
}

function ProgressView({ messages, testId }: ProgressViewProps) {
  const [messageIndex, setMessageIndex] = useState(() => Math.floor(Math.random() * messages.length))
  const [dots, setDots] = useState(0)

  useEffect(() => {
    const interval = setInterval(() => {
      setDots(prev => {
        if (prev >= 3) {
          setMessageIndex(Math.floor(Math.random() * messages.length))
          return 0
        }
        return prev + 1
      })
    }, 1000)
    return () => clearInterval(interval)
  }, [messages])

  return (
    <div className="text-center py-16" data-testid={testId}>
      <p className="text-xl text-gray-300">
        {messages[messageIndex]}
        {".".repeat(dots)}
      </p>
    </div>
  )
}

export function ImportPage() {
  const navigate = useNavigate()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const commitGuardRef = useRef(false)
  const [phase, setPhase] = useState<Phase>("idle")
  const [isDragging, setIsDragging] = useState(false)
  const [result, setResult] = useState<DetectionResult | null>(null)
  const [edits, setEdits] = useState<Record<number, { title?: string; artist?: string }>>({})
  const [editing, setEditing] = useState<{ index: number; field: "title" | "artist" } | null>(null)
  const [matches, setMatches] = useState<Match[]>([])
  const [decisions, setDecisions] = useState<Record<number, RowDecision>>({})
  const [openAlternatives, setOpenAlternatives] = useState<number | null>(null)
  const [added, setAdded] = useState<Album[]>([])
  const [removedIds, setRemovedIds] = useState<Set<number>>(new Set())
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

  const handleRemoveRow = (index: number) => {
    setResult(prev => (prev ? { ...prev, albums: prev.albums.filter((_, i) => i !== index) } : prev))
    setEdits(prev => {
      const next: Record<number, { title?: string; artist?: string }> = {}
      for (const [key, value] of Object.entries(prev)) {
        const i = Number(key)
        if (i < index) next[i] = value
        else if (i > index) next[i - 1] = value
      }
      return next
    })
    setEditing(null)
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

  const handleMatchAll = async () => {
    if (!result || result.albums.length === 0) return
    const queries: AlbumQuery[] = result.albums.map((album, index) => ({
      title: edits[index]?.title ?? album.title,
      artist: edits[index]?.artist ?? album.artist,
    }))
    setPhase("matching")
    try {
      const response = await matchAlbums(queries)
      setMatches(response.matches)
      // "Cancel" on the confirming view keeps the user's dismisses; re-apply them
      // to the fresh match rows (rows map 1:1 onto the detection run's order).
      setDecisions(prev => {
        const next: Record<number, RowDecision> = {}
        response.matches.forEach((_, index) => {
          if (prev[index]?.action === "dismiss") next[index] = { action: "dismiss" }
        })
        return next
      })
      setOpenAlternatives(null)
      setPhase("confirming")
    } catch (error) {
      setPhase("results")
      toast(error instanceof Error ? error.message : "Matching failed. Please try again.", "error")
    }
  }

  const handleCancelConfirm = () => {
    setPhase("results")
  }

  const getDecision = (index: number): RowDecision => decisions[index] ?? { action: "accept" }

  const getCommitRows = (): Omit<Album, "id">[] =>
    matches.flatMap((match, index): Omit<Album, "id">[] => {
      const decision = getDecision(index)
      if (decision.action === "dismiss") return []
      const release = resolveChosen(match, decision)
      if (release) {
        return [{ title: release.title, artist: release.artist, release: release.date || null, mbid: release.mbid }]
      }
      if (decision.addWithoutMbid) {
        return [{ title: match.input.title, artist: match.input.artist, release: null, mbid: null }]
      }
      return []
    })

  const handleCommit = async () => {
    if (commitGuardRef.current) return
    commitGuardRef.current = true
    setPhase("committing")
    const rows = getCommitRows()
    const created: Album[] = []
    for (const row of rows) {
      try {
        created.push(await createAlbum(row))
      } catch {
        toast(`Failed to add "${row.title}".`, "error")
      }
    }
    commitGuardRef.current = false
    setAdded(created)
    setRemovedIds(new Set())
    setPhase("done")
  }

  const handleRemoveAdded = async (id: number) => {
    try {
      await deleteAlbum(id)
      setRemovedIds(prev => new Set(prev).add(id))
      toast("Removed from collection", "success")
    } catch {
      toast("Failed to remove album.", "error")
    }
  }

  const handleImportMore = () => {
    setResult(null)
    setEdits({})
    setEditing(null)
    setMatches([])
    setDecisions({})
    setOpenAlternatives(null)
    setAdded([])
    setRemovedIds(new Set())
    setPhase("idle")
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

  const commitRows = phase === "confirming" ? getCommitRows() : []

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.2 }}
    >
      <div className="max-w-4xl mx-auto p-8">
        <h1 className="text-3xl font-bold mb-8">Import</h1>

        {phase === "processing" && <ProgressView messages={PROCESSING_MESSAGES} testId="processing-view" />}
        {phase === "matching" && <ProgressView messages={MATCHING_MESSAGES} testId="matching-view" />}
        {phase === "committing" && <ProgressView messages={COMMITTING_MESSAGES} testId="committing-view" />}

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
                <div key={index} className="relative bg-gray-800 rounded-xl p-4 border border-gray-700">
                  <button
                    type="button"
                    data-testid={`remove-row-${index}`}
                    aria-label={`Remove ${getAlbumValue(index, "title")}`}
                    onClick={() => handleRemoveRow(index)}
                    className="absolute top-2 right-2 w-6 h-6 flex items-center justify-center rounded-full text-gray-500 hover:text-white hover:bg-gray-700"
                  >
                    ×
                  </button>
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
            <div className="flex justify-center gap-4 mt-8 flex-wrap">
              <button
                type="button"
                onClick={handleMatchAll}
                disabled={result.albums.length === 0}
                className="px-4 py-2 bg-green-600 hover:bg-green-500 rounded-lg text-white disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Add all to collection
              </button>
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

        {phase === "confirming" && (
          <div className="py-8" data-testid="confirming-view">
            <p className="text-gray-400 mb-6 text-center">
              Review the proposed matches before adding them to your collection.
            </p>
            <div className="grid grid-cols-1 gap-4">
              {matches.map((match, index) => (
                <div key={index} data-testid={`confirm-row-${index}`}>
                  <MatchCard
                    match={match}
                    decision={getDecision(index)}
                    alternativesOpen={openAlternatives === index}
                    onToggleAlternatives={() => setOpenAlternatives(prev => (prev === index ? null : index))}
                    onDecide={(decision) => setDecisions(prev => ({ ...prev, [index]: decision }))}
                  />
                </div>
              ))}
            </div>
            <div className="flex justify-center gap-4 mt-8">
              <button
                type="button"
                onClick={handleCancelConfirm}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-white"
              >
                Cancel
              </button>
              <button
                type="button"
                data-testid="commit-button"
                onClick={handleCommit}
                disabled={commitRows.length === 0}
                className="px-4 py-2 bg-green-600 hover:bg-green-500 rounded-lg text-white disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Commit {commitRows.length} {commitRows.length === 1 ? "album" : "albums"}
              </button>
            </div>
          </div>
        )}

        {phase === "done" && (
          <div className="py-8" data-testid="done-view">
            <h2 className="text-2xl font-bold text-center">
              {added.length > 0 ? `Added ${added.length} album${added.length === 1 ? "" : "s"}` : "No albums were added"}
            </h2>
            {added.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-8">
                {added.map(album => (
                  <div
                    key={album.id}
                    data-testid={`added-card-${album.id}`}
                    className={`relative bg-gray-800 rounded-xl p-4 border border-gray-700 ${
                      removedIds.has(album.id) ? "opacity-40 grayscale" : ""
                    }`}
                  >
                    <h3 className="text-white font-semibold">{album.title}</h3>
                    <p className="text-gray-400 mt-1">{album.artist}</p>
                    {album.release && <p className="text-gray-500 text-sm">{album.release}</p>}
                    <button
                      type="button"
                      aria-label="Remove from collection"
                      disabled={removedIds.has(album.id)}
                      onClick={() => handleRemoveAdded(album.id)}
                      className="absolute top-2 right-2 w-6 h-6 flex items-center justify-center rounded-full text-gray-500 hover:text-white hover:bg-gray-700 disabled:opacity-40 disabled:pointer-events-none"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="flex justify-center gap-4 mt-8">
              <button
                type="button"
                onClick={handleImportMore}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-white"
              >
                Import more
              </button>
              <button
                type="button"
                onClick={() => navigate("/albums")}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-white"
              >
                View Collection
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
