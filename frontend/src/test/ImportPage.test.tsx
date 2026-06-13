import React from "react"
import { render, screen, fireEvent, act } from "@testing-library/react"
import { ImportPage } from "../pages/ImportPage"
import { ToastProvider } from "../components/Toast"
import { PROCESSING_MESSAGES } from "../config/import"
import type { DetectionResult } from "../types"

vi.mock("../api/import", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../api/import")>()
  return {
    ...actual,
    detectAlbums: vi.fn(),
  }
})

function Wrapper({ children }: { children: React.ReactNode }) {
  return <ToastProvider>{children}</ToastProvider>
}

describe("ImportPage", () => {
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
    const { detectAlbums } = await import("../api/import")
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
    const { detectAlbums } = await import("../api/import")
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
      const { detectAlbums } = await import("../api/import")
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
    const { detectAlbums } = await import("../api/import")
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
    const { detectAlbums, ImportNetworkError } = await import("../api/import")
    vi.mocked(detectAlbums).mockRejectedValue(new ImportNetworkError())

    render(<ImportPage />, { wrapper: Wrapper })
    const input = screen.getByTestId("file-input")
    const file = new File(["video"], "clip.mp4", { type: "video/mp4" })

    fireEvent.change(input, { target: { files: [file] } })

    expect(await screen.findByText(/network error/i)).toBeInTheDocument()
    expect(await screen.findByTestId("upload-zone")).toBeInTheDocument()
  })

  it("shows error toast and returns to idle on server error", async () => {
    const { detectAlbums, ImportServerError } = await import("../api/import")
    vi.mocked(detectAlbums).mockRejectedValue(new ImportServerError())

    render(<ImportPage />, { wrapper: Wrapper })
    const input = screen.getByTestId("file-input")
    const file = new File(["video"], "clip.mp4", { type: "video/mp4" })

    fireEvent.change(input, { target: { files: [file] } })

    expect(await screen.findByText(/server error/i)).toBeInTheDocument()
    expect(await screen.findByTestId("upload-zone")).toBeInTheDocument()
  })

  it("shows info toast and returns to idle when no albums are detected", async () => {
    const { detectAlbums, ImportNoAlbumsError } = await import("../api/import")
    vi.mocked(detectAlbums).mockRejectedValue(new ImportNoAlbumsError())

    render(<ImportPage />, { wrapper: Wrapper })
    const input = screen.getByTestId("file-input")
    const file = new File(["video"], "clip.mp4", { type: "video/mp4" })

    fireEvent.change(input, { target: { files: [file] } })

    expect(await screen.findByText(/no albums detected/i)).toBeInTheDocument()
    expect(await screen.findByTestId("upload-zone")).toBeInTheDocument()
  })

  it("displays detection statistics in results view", async () => {
    const { detectAlbums } = await import("../api/import")
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
    const { detectAlbums } = await import("../api/import")
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
    const { detectAlbums } = await import("../api/import")
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

  it("cancels inline edit on Escape and reverts to original text", async () => {
    const { detectAlbums } = await import("../api/import")
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
})
