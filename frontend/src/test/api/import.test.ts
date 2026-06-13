import { detectAlbums } from "../../api/import"
import { api } from "../../api/client"
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
    expect(api.post).toHaveBeenCalledWith("/import/detect", expect.any(FormData), {
      headers: { "Content-Type": "multipart/form-data" },
    })

    const formData = vi.mocked(api.post).mock.calls[0][1] as FormData
    expect(formData.get("video")).toBe(file)
  })
})
