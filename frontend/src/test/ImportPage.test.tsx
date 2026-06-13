import React from "react"
import { render, screen, fireEvent } from "@testing-library/react"
import { ImportPage } from "../pages/ImportPage"
import { ToastProvider } from "../components/Toast"

vi.mock("../api/import", () => ({
  detectAlbums: vi.fn(),
}))

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

  it("transitions to processing view on valid file submission", async () => {
    const { detectAlbums } = await import("../api/import")
    vi.mocked(detectAlbums).mockReturnValue(new Promise(() => {}))

    render(<ImportPage />, { wrapper: Wrapper })
    const input = screen.getByTestId("file-input")
    const file = new File(["video"], "clip.mp4", { type: "video/mp4" })

    fireEvent.change(input, { target: { files: [file] } })

    expect(await screen.findByText(/staring at the video/i)).toBeInTheDocument()
    expect(screen.queryByTestId("upload-zone")).not.toBeInTheDocument()
  })

  it("accepts a valid video file dropped on the zone", async () => {
    const { detectAlbums } = await import("../api/import")
    vi.mocked(detectAlbums).mockReturnValue(new Promise(() => {}))

    render(<ImportPage />, { wrapper: Wrapper })
    const zone = screen.getByTestId("upload-zone")
    const file = new File(["video"], "drop.mp4", { type: "video/mp4" })

    fireEvent.drop(zone, { dataTransfer: { files: [file] } })

    expect(await screen.findByText(/staring at the video/i)).toBeInTheDocument()
  })
})
