import {
  detectAlbums,
  ImportNetworkError,
  ImportServerError,
  ImportNoAlbumsError,
  ImportInvalidResponseError,
} from "../../api/import"
import { api } from "../../api/client"
import { AxiosError } from "axios"
import type { DetectionResult } from "../../types"

vi.mock("../../api/client", () => ({
  api: {
    post: vi.fn(),
  },
}))

describe("detectAlbums", () => {
  it("posts the video file as FormData to /api/import/detect", async () => {
    const file = new File(["video-content"], "scan.mp4", { type: "video/mp4" })
    const result: DetectionResult = {
      albums: [{ title: "OK Computer", artist: "Radiohead", row: 0, col: 1, source_frame: 42 }],
      total_frames_processed: 100,
      frames_with_detections: 1,
    }
    vi.mocked(api.post).mockResolvedValue({ data: result })

    const actual = await detectAlbums(file)

    expect(actual).toEqual(result)
    expect(api.post).toHaveBeenCalledWith("/import/detect", expect.any(FormData))

    const formData = vi.mocked(api.post).mock.calls[0][1] as FormData
    expect(formData.get("video")).toBe(file)
  })

  it("throws ImportNetworkError when there is no response", async () => {
    const file = new File(["video-content"], "scan.mp4", { type: "video/mp4" })
    vi.mocked(api.post).mockRejectedValue(new AxiosError("Network Error", undefined, undefined, undefined, undefined))

    await expect(detectAlbums(file)).rejects.toBeInstanceOf(ImportNetworkError)
  })

  it("throws ImportServerError on 5xx response", async () => {
    const file = new File(["video-content"], "scan.mp4", { type: "video/mp4" })
    const error = new AxiosError("Server Error", undefined, undefined, undefined, {
      status: 500,
      data: {},
      statusText: "Internal Server Error",
      headers: {},
      config: {} as never,
    })
    vi.mocked(api.post).mockRejectedValue(error)

    await expect(detectAlbums(file)).rejects.toBeInstanceOf(ImportServerError)
  })

  it("throws ImportNoAlbumsError on 422 response", async () => {
    const file = new File(["video-content"], "scan.mp4", { type: "video/mp4" })
    const error = new AxiosError("Unprocessable Entity", undefined, undefined, undefined, {
      status: 422,
      data: {},
      statusText: "Unprocessable Entity",
      headers: {},
      config: {} as never,
    })
    vi.mocked(api.post).mockRejectedValue(error)

    await expect(detectAlbums(file)).rejects.toBeInstanceOf(ImportNoAlbumsError)
  })

  it("throws ImportInvalidResponseError when response data is invalid", async () => {
    const file = new File(["video-content"], "scan.mp4", { type: "video/mp4" })
    vi.mocked(api.post).mockResolvedValue({ data: { albums: "not-an-array" } })

    await expect(detectAlbums(file)).rejects.toBeInstanceOf(ImportInvalidResponseError)
  })
})
