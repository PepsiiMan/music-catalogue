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
    expect(screen.getByText(/1 album\(s\)/i)).toBeInTheDocument()
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
})
