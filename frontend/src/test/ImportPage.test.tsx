import React from "react"
import { render, screen, fireEvent, act, within, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { ImportPage } from "../pages/ImportPage"
import { ToastProvider } from "../components/Toast"
import { PROCESSING_MESSAGES } from "../config/import"
import { detectAlbums } from "../api/import"
import { matchAlbums } from "../api/importmatch"
import { createAlbum, deleteAlbum } from "../db/albums"
import { getCoverArt } from "../api/search"
import type { DetectionResult, DetectedAlbum, Match, SearchResult } from "../types"

vi.mock("../api/import", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../api/import")>()
  return {
    ...actual,
    detectAlbums: vi.fn(),
  }
})

vi.mock("../api/importmatch", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../api/importmatch")>()
  return {
    ...actual,
    matchAlbums: vi.fn(),
  }
})

vi.mock("../db/albums", () => ({
  createAlbum: vi.fn(),
  deleteAlbum: vi.fn(),
}))

vi.mock("../api/search", () => ({
  getCoverArt: vi.fn().mockResolvedValue(null),
}))

const mockNavigate = vi.fn()

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom")
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  }
})

function Wrapper({ children }: { children: React.ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>{children}</ToastProvider>
    </QueryClientProvider>
  )
}

const videoFile = new File(["video"], "clip.mp4", { type: "video/mp4" })

const baseAlbums: DetectedAlbum[] = [
  { title: "OK Computr", artist: "Radiohed", row: 0, col: 1, source_frame: 42 },
  { title: "In Rainbows", artist: "Radiohead", row: 1, col: 0, source_frame: 42 },
]

const okComputerBest: SearchResult = {
  mbid: "mbid-okc",
  title: "OK Computer",
  artist: "Radiohead",
  date: "1997-05-21",
}

const okComputerAlternative: SearchResult = {
  mbid: "mbid-okc2",
  title: "OK Computer OKNOTOK 1997 2017",
  artist: "Radiohead",
  date: "2017-06-23",
}

const inRainbowsBest: SearchResult = {
  mbid: "mbid-ir",
  title: "In Rainbows",
  artist: "Radiohead",
  date: "2007-12-28",
}

function twoMatches(): Match[] {
  return [
    {
      input: { title: "OK Computr", artist: "Radiohed" },
      best: okComputerBest,
      alternatives: [okComputerAlternative],
    },
    {
      input: { title: "In Rainbows", artist: "Radiohead" },
      best: inRainbowsBest,
      alternatives: [],
    },
  ]
}

async function renderResults(albums: DetectedAlbum[] = baseAlbums) {
  vi.mocked(detectAlbums).mockResolvedValue({
    albums,
    total_frames_processed: 100,
    frames_with_detections: albums.length,
  } satisfies DetectionResult)

  render(<ImportPage />, { wrapper: Wrapper })
  fireEvent.change(screen.getByTestId("file-input"), { target: { files: [videoFile] } })
  await screen.findByTestId("results-view")
}

async function renderConfirming(matches: Match[] = twoMatches(), albums: DetectedAlbum[] = baseAlbums) {
  await renderResults(albums)
  vi.mocked(matchAlbums).mockResolvedValue({ matches })
  fireEvent.click(screen.getByRole("button", { name: /add all to collection/i }))
  await screen.findByTestId("confirming-view")
}

function stubCreatedAlbums(ids: number[]) {
  vi.mocked(createAlbum).mockImplementation(async (album) => {
    return { ...album, id: ids.shift() ?? 1 }
  })
}

describe("ImportPage", () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.mocked(getCoverArt).mockResolvedValue(null)
    mockNavigate.mockClear()
  })

  it("renders the upload zone", () => {
    render(<ImportPage />, { wrapper: Wrapper })

    expect(screen.getByText(/drop a video file/i)).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /browse files/i })).toBeInTheDocument()
  })

  it("clicking browse files opens the file picker", () => {
    render(<ImportPage />, { wrapper: Wrapper })
    const input = screen.getByTestId("file-input")
    const clickSpy = vi.spyOn(input, "click")

    fireEvent.click(screen.getByRole("button", { name: /browse files/i }))

    expect(clickSpy).toHaveBeenCalled()
  })

  it("shows visual feedback while dragging over the drop zone", () => {
    render(<ImportPage />, { wrapper: Wrapper })
    const zone = screen.getByTestId("upload-zone")

    fireEvent.dragEnter(zone)
    expect(zone.className).toContain("border-blue-500")

    fireEvent.dragLeave(zone)
    expect(zone.className).not.toContain("border-blue-500")
  })

  it("rejects non-video files with a toast", async () => {
    render(<ImportPage />, { wrapper: Wrapper })
    const input = screen.getByTestId("file-input")
    const file = new File(["content"], "image.png", { type: "image/png" })

    fireEvent.change(input, { target: { files: [file] } })

    expect(await screen.findByText(/only video files are allowed/i)).toBeInTheDocument()
  })

  it("rejects files larger than 30MB with a toast", async () => {
    render(<ImportPage />, { wrapper: Wrapper })
    const input = screen.getByTestId("file-input")
    const file = new File(["x"], "large.mp4", { type: "video/mp4" })
    Object.defineProperty(file, "size", { value: 30 * 1024 * 1024 + 1 })

    fireEvent.change(input, { target: { files: [file] } })

    expect(await screen.findByText(/maximum size is 30MB/i)).toBeInTheDocument()
  })

  it("displays progress view with a randomly selected message while processing", async () => {
    vi.mocked(detectAlbums).mockReturnValue(new Promise(() => {}))
    vi.spyOn(Math, "random").mockReturnValue(0)

    render(<ImportPage />, { wrapper: Wrapper })
    const input = screen.getByTestId("file-input")
    const file = new File(["video"], "clip.mp4", { type: "video/mp4" })

    fireEvent.change(input, { target: { files: [file] } })

    expect(await screen.findByTestId("processing-view")).toBeInTheDocument()
    expect(screen.getByText(PROCESSING_MESSAGES[0])).toBeInTheDocument()
    expect(screen.queryByTestId("upload-zone")).not.toBeInTheDocument()
  })

  it("accepts a valid video file dropped on the zone", async () => {
    vi.mocked(detectAlbums).mockReturnValue(new Promise(() => {}))
    vi.spyOn(Math, "random").mockReturnValue(0)

    render(<ImportPage />, { wrapper: Wrapper })
    const zone = screen.getByTestId("upload-zone")
    const file = new File(["video"], "drop.mp4", { type: "video/mp4" })

    fireEvent.drop(zone, { dataTransfer: { files: [file] } })

    expect(await screen.findByTestId("processing-view")).toBeInTheDocument()
  })

  it("cycles dots 0→3 then switches message and resets dots", async () => {
    vi.useFakeTimers()
    try {
      vi.mocked(detectAlbums).mockReturnValue(new Promise(() => {}))

      let randomCall = 0
      vi.spyOn(Math, "random").mockImplementation(() => {
        randomCall++
        return randomCall === 1 ? 0 : 0.7
      })

      render(<ImportPage />, { wrapper: Wrapper })
      const input = screen.getByTestId("file-input")
      const file = new File(["video"], "clip.mp4", { type: "video/mp4" })

      fireEvent.change(input, { target: { files: [file] } })

      expect(screen.getByTestId("processing-view")).toBeInTheDocument()
      expect(screen.getByText(PROCESSING_MESSAGES[0])).toBeInTheDocument()

      act(() => vi.advanceTimersByTime(1000))
      expect(screen.getByText(`${PROCESSING_MESSAGES[0]}.`)).toBeInTheDocument()

      act(() => vi.advanceTimersByTime(1000))
      expect(screen.getByText(`${PROCESSING_MESSAGES[0]}..`)).toBeInTheDocument()

      act(() => vi.advanceTimersByTime(1000))
      expect(screen.getByText(`${PROCESSING_MESSAGES[0]}...`)).toBeInTheDocument()

      act(() => vi.advanceTimersByTime(1000))
      expect(screen.queryByText(PROCESSING_MESSAGES[0])).not.toBeInTheDocument()
      expect(screen.getByText(PROCESSING_MESSAGES[3])).toBeInTheDocument()
      expect(screen.queryByText(`${PROCESSING_MESSAGES[3]}.`)).not.toBeInTheDocument()
    } finally {
      vi.useRealTimers()
    }
  })

  it("transitions to results phase with detection data on success", async () => {
    const result: DetectionResult = {
      albums: [{ title: "OK Computer", artist: "Radiohead", row: 0, col: 1, source_frame: 42 }],
      total_frames_processed: 100,
      frames_with_detections: 1,
    }
    vi.mocked(detectAlbums).mockResolvedValue(result)

    render(<ImportPage />, { wrapper: Wrapper })
    const input = screen.getByTestId("file-input")
    const file = new File(["video"], "clip.mp4", { type: "video/mp4" })

    fireEvent.change(input, { target: { files: [file] } })

    expect(await screen.findByTestId("results-view")).toBeInTheDocument()
    expect(screen.getByText(/albums detected/i)).toBeInTheDocument()
    expect(screen.getByText(/frames processed/i)).toBeInTheDocument()
    expect(screen.getByText(/frames with detections/i)).toBeInTheDocument()
  })

  it("shows error toast and returns to idle on network error", async () => {
    const { ImportNetworkError } = await import("../api/import")
    vi.mocked(detectAlbums).mockRejectedValue(new ImportNetworkError())

    render(<ImportPage />, { wrapper: Wrapper })
    const input = screen.getByTestId("file-input")
    const file = new File(["video"], "clip.mp4", { type: "video/mp4" })

    fireEvent.change(input, { target: { files: [file] } })

    expect(await screen.findByText(/network error/i)).toBeInTheDocument()
    expect(await screen.findByTestId("upload-zone")).toBeInTheDocument()
  })

  it("shows error toast and returns to idle on server error", async () => {
    const { ImportServerError } = await import("../api/import")
    vi.mocked(detectAlbums).mockRejectedValue(new ImportServerError())

    render(<ImportPage />, { wrapper: Wrapper })
    const input = screen.getByTestId("file-input")
    const file = new File(["video"], "clip.mp4", { type: "video/mp4" })

    fireEvent.change(input, { target: { files: [file] } })

    expect(await screen.findByText(/server error/i)).toBeInTheDocument()
    expect(await screen.findByTestId("upload-zone")).toBeInTheDocument()
  })

  it("shows info toast and returns to idle when no albums are detected", async () => {
    const { ImportNoAlbumsError } = await import("../api/import")
    vi.mocked(detectAlbums).mockRejectedValue(new ImportNoAlbumsError())

    render(<ImportPage />, { wrapper: Wrapper })
    const input = screen.getByTestId("file-input")
    const file = new File(["video"], "clip.mp4", { type: "video/mp4" })

    fireEvent.change(input, { target: { files: [file] } })

    expect(await screen.findByText(/no albums detected/i)).toBeInTheDocument()
    expect(await screen.findByTestId("upload-zone")).toBeInTheDocument()
  })

  it("displays detection statistics in results view", async () => {
    const result: DetectionResult = {
      albums: [
        { title: "OK Computer", artist: "Radiohead", row: 0, col: 1, source_frame: 42 },
        { title: "In Rainbows", artist: "Radiohead", row: 1, col: 0, source_frame: 42 },
      ],
      total_frames_processed: 150,
      frames_with_detections: 3,
    }
    vi.mocked(detectAlbums).mockResolvedValue(result)

    render(<ImportPage />, { wrapper: Wrapper })
    const input = screen.getByTestId("file-input")
    const file = new File(["video"], "clip.mp4", { type: "video/mp4" })

    fireEvent.change(input, { target: { files: [file] } })

    expect(await screen.findByTestId("results-view")).toBeInTheDocument()
    expect(screen.getByText(/albums detected/i)).toBeInTheDocument()
    expect(screen.getByText("2")).toBeInTheDocument()
    expect(screen.getByText(/frames processed/i)).toBeInTheDocument()
    expect(screen.getByText("150")).toBeInTheDocument()
    expect(screen.getByText(/frames with detections/i)).toBeInTheDocument()
    expect(screen.getByText("3")).toBeInTheDocument()
  })

  it("renders a responsive card grid with detected albums", async () => {
    const result: DetectionResult = {
      albums: [
        { title: "OK Computer", artist: "Radiohead", row: 0, col: 1, source_frame: 42 },
        { title: "Random Access Memories", artist: "Daft Punk", row: 1, col: 0, source_frame: 42 },
        { title: "The Dark Side of the Moon", artist: "Pink Floyd", row: 0, col: 0, source_frame: 42 },
      ],
      total_frames_processed: 100,
      frames_with_detections: 1,
    }
    vi.mocked(detectAlbums).mockResolvedValue(result)

    render(<ImportPage />, { wrapper: Wrapper })
    const input = screen.getByTestId("file-input")
    const file = new File(["video"], "clip.mp4", { type: "video/mp4" })

    fireEvent.change(input, { target: { files: [file] } })

    expect(await screen.findByTestId("results-view")).toBeInTheDocument()
    expect(screen.getByText("OK Computer")).toBeInTheDocument()
    expect(screen.getByText("Radiohead")).toBeInTheDocument()
    expect(screen.getByText("Random Access Memories")).toBeInTheDocument()
    expect(screen.getByText("Daft Punk")).toBeInTheDocument()
    expect(screen.getByText("The Dark Side of the Moon")).toBeInTheDocument()
    expect(screen.getByText("Pink Floyd")).toBeInTheDocument()
    const grid = screen.getByTestId("album-grid")
    expect(grid.className).toContain("grid-cols-1")
    expect(grid.className).toContain("md:grid-cols-2")
    expect(grid.className).toContain("lg:grid-cols-3")
  })

  it("allows inline editing of album title on click and saves on Enter", async () => {
    const result: DetectionResult = {
      albums: [
        { title: "OK Computer", artist: "Radiohead", row: 0, col: 1, source_frame: 42 },
      ],
      total_frames_processed: 100,
      frames_with_detections: 1,
    }
    vi.mocked(detectAlbums).mockResolvedValue(result)

    render(<ImportPage />, { wrapper: Wrapper })
    const input = screen.getByTestId("file-input")
    const file = new File(["video"], "clip.mp4", { type: "video/mp4" })

    fireEvent.change(input, { target: { files: [file] } })

    expect(await screen.findByTestId("results-view")).toBeInTheDocument()
    const titleElement = screen.getByText("OK Computer")
    fireEvent.click(titleElement)

    const editInput = screen.getByDisplayValue("OK Computer")
    expect(editInput.tagName).toBe("INPUT")

    fireEvent.change(editInput, { target: { value: "Kid A" } })
    fireEvent.keyDown(editInput, { key: "Enter" })

    expect(screen.getByText("Kid A")).toBeInTheDocument()
    expect(screen.queryByText("OK Computer")).not.toBeInTheDocument()
  })

  it("clear button resets page to idle/upload state", async () => {
    const result: DetectionResult = {
      albums: [{ title: "OK Computer", artist: "Radiohead", row: 0, col: 1, source_frame: 42 }],
      total_frames_processed: 100,
      frames_with_detections: 1,
    }
    vi.mocked(detectAlbums).mockResolvedValue(result)

    render(<ImportPage />, { wrapper: Wrapper })
    const input = screen.getByTestId("file-input")
    const file = new File(["video"], "clip.mp4", { type: "video/mp4" })

    fireEvent.change(input, { target: { files: [file] } })

    expect(await screen.findByTestId("results-view")).toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: /clear/i }))

    expect(screen.getByTestId("upload-zone")).toBeInTheDocument()
    expect(screen.queryByTestId("results-view")).not.toBeInTheDocument()
  })

  it("export CSV button triggers download with correct format", async () => {
    const result: DetectionResult = {
      albums: [
        { title: "OK Computer", artist: "Radiohead", row: 0, col: 1, source_frame: 42 },
        { title: "In Rainbows", artist: "Radiohead", row: 1, col: 0, source_frame: 42 },
      ],
      total_frames_processed: 100,
      frames_with_detections: 1,
    }
    vi.mocked(detectAlbums).mockResolvedValue(result)

    const createObjectURL = vi.fn(() => "blob:mock")
    const revokeObjectURL = vi.fn()
    vi.stubGlobal("URL", { createObjectURL, revokeObjectURL })

    render(<ImportPage />, { wrapper: Wrapper })
    const input = screen.getByTestId("file-input")
    const file = new File(["video"], "clip.mp4", { type: "video/mp4" })

    fireEvent.change(input, { target: { files: [file] } })

    expect(await screen.findByTestId("results-view")).toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: /export csv/i }))

    expect(createObjectURL).toHaveBeenCalledOnce()
    const blob = createObjectURL.mock.calls[0][0] as Blob
    expect(blob.type).toBe("text/csv")
  })

  it("export JSON button triggers download with correct format", async () => {
    const result: DetectionResult = {
      albums: [
        { title: "OK Computer", artist: "Radiohead", row: 0, col: 1, source_frame: 42 },
        { title: "In Rainbows", artist: "Radiohead", row: 1, col: 0, source_frame: 42 },
      ],
      total_frames_processed: 100,
      frames_with_detections: 1,
    }
    vi.mocked(detectAlbums).mockResolvedValue(result)

    const createObjectURL = vi.fn(() => "blob:mock")
    const revokeObjectURL = vi.fn()
    vi.stubGlobal("URL", { createObjectURL, revokeObjectURL })

    render(<ImportPage />, { wrapper: Wrapper })
    const input = screen.getByTestId("file-input")
    const file = new File(["video"], "clip.mp4", { type: "video/mp4" })

    fireEvent.change(input, { target: { files: [file] } })

    expect(await screen.findByTestId("results-view")).toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: /export json/i }))

    expect(createObjectURL).toHaveBeenCalledOnce()
    const blob = createObjectURL.mock.calls[0][0] as Blob
    expect(blob.type).toBe("application/json")
  })

  it("switching between CSV and JSON exports preserves edits", async () => {
    const result: DetectionResult = {
      albums: [
        { title: "OK Computer", artist: "Radiohead", row: 0, col: 1, source_frame: 42 },
      ],
      total_frames_processed: 100,
      frames_with_detections: 1,
    }
    vi.mocked(detectAlbums).mockResolvedValue(result)

    const createObjectURL = vi.fn(() => "blob:mock")
    const revokeObjectURL = vi.fn()
    vi.stubGlobal("URL", { createObjectURL, revokeObjectURL })

    render(<ImportPage />, { wrapper: Wrapper })
    const input = screen.getByTestId("file-input")
    const file = new File(["video"], "clip.mp4", { type: "video/mp4" })

    fireEvent.change(input, { target: { files: [file] } })

    expect(await screen.findByTestId("results-view")).toBeInTheDocument()

    const titleElement = screen.getByText("OK Computer")
    fireEvent.click(titleElement)
    const editInput = screen.getByDisplayValue("OK Computer")
    fireEvent.change(editInput, { target: { value: "Kid A" } })
    fireEvent.keyDown(editInput, { key: "Enter" })

    fireEvent.click(screen.getByRole("button", { name: /export csv/i }))
    const csvBlob = createObjectURL.mock.calls[0][0] as Blob
    expect(csvBlob.type).toBe("text/csv")

    fireEvent.click(screen.getByRole("button", { name: /export json/i }))
    const jsonBlob = createObjectURL.mock.calls[1][0] as Blob
    expect(jsonBlob.type).toBe("application/json")

    expect(screen.getByText("Kid A")).toBeInTheDocument()
  })

  it("cancels inline edit on Escape and reverts to original text", async () => {
    const result: DetectionResult = {
      albums: [
        { title: "OK Computer", artist: "Radiohead", row: 0, col: 1, source_frame: 42 },
      ],
      total_frames_processed: 100,
      frames_with_detections: 1,
    }
    vi.mocked(detectAlbums).mockResolvedValue(result)

    render(<ImportPage />, { wrapper: Wrapper })
    const input = screen.getByTestId("file-input")
    const file = new File(["video"], "clip.mp4", { type: "video/mp4" })

    fireEvent.change(input, { target: { files: [file] } })

    expect(await screen.findByTestId("results-view")).toBeInTheDocument()
    const titleElement = screen.getByText("OK Computer")
    fireEvent.click(titleElement)

    const editInput = screen.getByDisplayValue("OK Computer")
    fireEvent.change(editInput, { target: { value: "Kid A" } })
    fireEvent.keyDown(editInput, { key: "Escape" })

    expect(screen.getByText("OK Computer")).toBeInTheDocument()
    expect(screen.queryByText("Kid A")).not.toBeInTheDocument()
  })

  describe("results view — row removal", () => {
    it("renders a per-card × on each detection card", async () => {
      await renderResults()

      expect(screen.getByTestId("remove-row-0")).toBeInTheDocument()
      expect(screen.getByTestId("remove-row-1")).toBeInTheDocument()
      expect(screen.getByLabelText(/remove OK Computr/i)).toBeInTheDocument()
    })

    it("× splices the row out of the detected list and reindexes the user's edits", async () => {
      const albums: DetectedAlbum[] = [
        { title: "OK Computer", artist: "Radiohead", row: 0, col: 1, source_frame: 42 },
        { title: "In Rainbows", artist: "Radiohead", row: 1, col: 0, source_frame: 42 },
        { title: "Kid A", artist: "Radiohead", row: 0, col: 0, source_frame: 42 },
      ]
      await renderResults(albums)

      fireEvent.click(screen.getByText("Kid A"))
      const editInput = screen.getByDisplayValue("Kid A")
      fireEvent.change(editInput, { target: { value: "Kid A Remastered" } })
      fireEvent.keyDown(editInput, { key: "Enter" })

      fireEvent.click(screen.getByTestId("remove-row-0"))

      expect(screen.queryByText("OK Computer")).not.toBeInTheDocument()
      expect(screen.getByText("In Rainbows")).toBeInTheDocument()
      expect(screen.getByText("Kid A Remastered")).toBeInTheDocument()

      vi.mocked(matchAlbums).mockResolvedValue({ matches: [] })
      fireEvent.click(screen.getByRole("button", { name: /add all to collection/i }))
      await screen.findByTestId("confirming-view")

      expect(matchAlbums).toHaveBeenCalledWith([
        { title: "In Rainbows", artist: "Radiohead" },
        { title: "Kid A Remastered", artist: "Radiohead" },
      ])
    })
  })

  describe("matching phase", () => {
    it("sends the user's edited title and artist to matchAlbums, not the raw OCR text", async () => {
      await renderResults()

      fireEvent.click(screen.getByText("OK Computr"))
      const titleInput = screen.getByDisplayValue("OK Computr")
      fireEvent.change(titleInput, { target: { value: "OK Computer" } })
      fireEvent.keyDown(titleInput, { key: "Enter" })

      vi.mocked(matchAlbums).mockResolvedValue({ matches: twoMatches() })
      fireEvent.click(screen.getByRole("button", { name: /add all to collection/i }))
      await screen.findByTestId("confirming-view")

      expect(matchAlbums).toHaveBeenCalledWith([
        { title: "OK Computer", artist: "Radiohed" },
        { title: "In Rainbows", artist: "Radiohead" },
      ])
    })

    it("shows the matching progress view while matchAlbums is pending", async () => {
      await renderResults()
      vi.mocked(matchAlbums).mockReturnValue(new Promise(() => {}))

      fireEvent.click(screen.getByRole("button", { name: /add all to collection/i }))

      expect(await screen.findByTestId("matching-view")).toBeInTheDocument()
      expect(screen.queryByTestId("results-view")).not.toBeInTheDocument()
    })

    it("shows an error toast and returns to results when matching fails", async () => {
      await renderResults()
      const { MatchServerError } = await import("../api/importmatch")
      vi.mocked(matchAlbums).mockRejectedValue(new MatchServerError())

      fireEvent.click(screen.getByRole("button", { name: /add all to collection/i }))

      expect(await screen.findByTestId("results-view")).toBeInTheDocument()
      expect(await screen.findByText(/server error/i)).toBeInTheDocument()
    })
  })

  describe("confirming phase", () => {
    it("renders one card per row showing the OCR text alongside the proposed match", async () => {
      await renderConfirming()

      expect(screen.getAllByTestId("match-card")).toHaveLength(2)
      expect(screen.getByText("OK Computr")).toBeInTheDocument()
      expect(screen.getByText("Radiohed")).toBeInTheDocument()
      expect(screen.getByText("OK Computer")).toBeInTheDocument()
      expect(screen.getByText("1997-05-21")).toBeInTheDocument()
      expect(screen.getAllByText("In Rainbows").length).toBeGreaterThan(0)
    })

    it("shows cover art for matched rows via getCoverArt", async () => {
      vi.mocked(getCoverArt).mockResolvedValue("http://cover/okc.jpg")

      await renderConfirming()

      const img = await screen.findByRole("img", { name: /OK Computer/ })
      expect(img).toHaveAttribute("src", "http://cover/okc.jpg")
    })

    it("excludes a dismissed row from the commit", async () => {
      stubCreatedAlbums([1])
      await renderConfirming()

      const row0 = screen.getByTestId("confirm-row-0")
      fireEvent.click(within(row0).getByRole("button", { name: /dismiss/i }))

      fireEvent.click(screen.getByRole("button", { name: /commit/i }))
      await screen.findByTestId("done-view")

      expect(createAlbum).toHaveBeenCalledTimes(1)
      expect(createAlbum).toHaveBeenCalledWith(
        expect.objectContaining({ title: "In Rainbows", artist: "Radiohead", mbid: "mbid-ir" }),
      )
      expect(screen.getByText(/added 1 album/i)).toBeInTheDocument()
    })

    it("lets the user pick an alternative release which is committed instead of the best match", async () => {
      stubCreatedAlbums([1, 2])
      await renderConfirming()

      const row0 = screen.getByTestId("confirm-row-0")
      fireEvent.click(within(row0).getByRole("button", { name: /pick alternative/i }))
      const strip = within(row0).getByTestId("alternatives-strip")
      fireEvent.click(within(strip).getByRole("button", { name: /OKNOTOK/i }))

      fireEvent.click(screen.getByRole("button", { name: /commit/i }))
      await screen.findByTestId("done-view")

      expect(createAlbum).toHaveBeenCalledWith(
        expect.objectContaining({ title: "OK Computer OKNOTOK 1997 2017", mbid: "mbid-okc2" }),
      )
    })

    it("shows an Unmatched badge on unmatched rows and excludes them from commit by default", async () => {
      stubCreatedAlbums([1])
      const matches: Match[] = [
        { input: { title: "OK Computr", artist: "Radiohed" }, best: null, alternatives: [] },
        { input: { title: "In Rainbows", artist: "Radiohead" }, best: inRainbowsBest, alternatives: [] },
      ]
      await renderConfirming(matches)

      expect(screen.getAllByTestId("unmatched-badge")).toHaveLength(1)

      fireEvent.click(screen.getByRole("button", { name: /commit/i }))
      await screen.findByTestId("done-view")

      expect(createAlbum).toHaveBeenCalledTimes(1)
      expect(createAlbum).toHaveBeenCalledWith(
        expect.objectContaining({ title: "In Rainbows", mbid: "mbid-ir" }),
      )
    })

    it("commits the OCR text with mbid null when Add without MBID is chosen", async () => {
      stubCreatedAlbums([1])
      const matches: Match[] = [
        { input: { title: "OK Computr", artist: "Radiohed" }, best: null, alternatives: [] },
      ]
      await renderConfirming(matches, [baseAlbums[0]])

      const row0 = screen.getByTestId("confirm-row-0")
      fireEvent.click(within(row0).getByRole("button", { name: /add without mbid/i }))

      fireEvent.click(screen.getByRole("button", { name: /commit/i }))
      await screen.findByTestId("done-view")

      expect(createAlbum).toHaveBeenCalledTimes(1)
      expect(createAlbum).toHaveBeenCalledWith({ title: "OK Computr", artist: "Radiohed", release: null, mbid: null })
    })

    it("cancel returns to the results view with edits preserved", async () => {
      await renderResults()

      fireEvent.click(screen.getByText("OK Computr"))
      const editInput = screen.getByDisplayValue("OK Computr")
      fireEvent.change(editInput, { target: { value: "OK Computer" } })
      fireEvent.keyDown(editInput, { key: "Enter" })

      vi.mocked(matchAlbums).mockResolvedValue({ matches: twoMatches() })
      fireEvent.click(screen.getByRole("button", { name: /add all to collection/i }))
      await screen.findByTestId("confirming-view")

      fireEvent.click(screen.getByRole("button", { name: /^cancel$/i }))

      expect(screen.getByTestId("results-view")).toBeInTheDocument()
      expect(screen.queryByTestId("confirming-view")).not.toBeInTheDocument()
      expect(screen.getByText("OK Computer")).toBeInTheDocument()
    })
  })

  describe("committing phase", () => {
    it("shows the committing progress view while albums are being added", async () => {
      stubCreatedAlbums([1, 2])
      await renderConfirming()

      fireEvent.click(screen.getByRole("button", { name: /commit/i }))

      expect(screen.getByTestId("committing-view")).toBeInTheDocument()
      expect(createAlbum).toHaveBeenCalledTimes(1)
      await screen.findByTestId("done-view")
      expect(createAlbum).toHaveBeenCalledTimes(2)
    })

    it("calls createAlbum for each accepted row once at a time through the commit loop", async () => {
      const calls: string[] = []
      vi.mocked(createAlbum).mockImplementation(async (album) => {
        calls.push(album.title)
        return { ...album, id: calls.length }
      })
      await renderConfirming()

      fireEvent.click(screen.getByRole("button", { name: /commit/i }))

      expect(screen.getByTestId("committing-view")).toBeInTheDocument()
      expect(createAlbum).toHaveBeenCalledTimes(1)
      expect(calls).toEqual(["OK Computer"])

      await screen.findByTestId("done-view")
      expect(calls).toEqual(["OK Computer", "In Rainbows"])
    })

    it("does not double-insert when Commit is clicked twice", async () => {
      stubCreatedAlbums([1])
      await renderConfirming([twoMatches()[0]])

      const commitButton = screen.getByRole("button", { name: /commit/i })
      fireEvent.click(commitButton)
      fireEvent.click(commitButton)

      await screen.findByTestId("done-view")
      expect(createAlbum).toHaveBeenCalledTimes(1)
    })
  })

  describe("done phase", () => {
    it("shows the done view with the new albums and a next-step action pair", async () => {
      stubCreatedAlbums([1, 2])
      await renderConfirming()

      fireEvent.click(screen.getByRole("button", { name: /commit/i }))
      expect(await screen.findByTestId("done-view")).toBeInTheDocument()

      expect(screen.getByText(/added 2 albums/i)).toBeInTheDocument()
      expect(screen.getByText("OK Computer")).toBeInTheDocument()
      expect(screen.getByText("1997-05-21")).toBeInTheDocument()
      expect(screen.getByRole("button", { name: /import more/i })).toBeInTheDocument()
      expect(screen.getByRole("button", { name: /view collection/i })).toBeInTheDocument()
    })

    it("× on a done card calls deleteAlbum with the new id, greys the card out and toasts", async () => {
      stubCreatedAlbums([7])
      vi.mocked(deleteAlbum).mockResolvedValue(undefined)
      await renderConfirming([twoMatches()[0]])

      fireEvent.click(screen.getByRole("button", { name: /commit/i }))
      await screen.findByTestId("done-view")

      fireEvent.click(screen.getByRole("button", { name: /remove from collection/i }))

      await waitFor(() => expect(deleteAlbum).toHaveBeenCalledWith(7))
      const card = screen.getByTestId("added-card-7")
      expect(card.className).toContain("opacity-40")
      expect(await screen.findByText(/removed from collection/i)).toBeInTheDocument()
    })

    it("Import more resets the page to the upload view", async () => {
      stubCreatedAlbums([1])
      await renderConfirming([twoMatches()[0]])

      fireEvent.click(screen.getByRole("button", { name: /commit/i }))
      await screen.findByTestId("done-view")
      fireEvent.click(screen.getByRole("button", { name: /import more/i }))

      expect(screen.getByTestId("upload-zone")).toBeInTheDocument()
      expect(screen.queryByTestId("done-view")).not.toBeInTheDocument()
    })

    it("View Collection navigates to /albums", async () => {
      stubCreatedAlbums([1])
      await renderConfirming([twoMatches()[0]])

      fireEvent.click(screen.getByRole("button", { name: /commit/i }))
      await screen.findByTestId("done-view")
      fireEvent.click(screen.getByRole("button", { name: /view collection/i }))

      expect(mockNavigate).toHaveBeenCalledWith("/albums")
    })
  })
})
