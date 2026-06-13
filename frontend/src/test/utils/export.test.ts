import { toCsv, toJson, downloadBlob } from "../../utils/export"
import type { DetectedAlbum } from "../../types"

const sampleAlbums: DetectedAlbum[] = [
  { title: "OK Computer", artist: "Radiohead", row: 0, col: 1, source_frame: 42 },
  { title: "In Rainbows", artist: "Radiohead", row: 1, col: 0, source_frame: 42 },
]

describe("toCsv", () => {
  it("produces header row and data rows with all detection fields", () => {
    const csv = toCsv(sampleAlbums)
    expect(csv).toBe(
      "title,artist,row,col,source_frame\n" +
      "OK Computer,Radiohead,0,1,42\n" +
      "In Rainbows,Radiohead,1,0,42"
    )
  })

  it("handles empty albums array", () => {
    const csv = toCsv([])
    expect(csv).toBe("title,artist,row,col,source_frame")
  })

  it("reflects edits in exported data", () => {
    const edited: DetectedAlbum[] = [
      { title: "Kid A", artist: "Radiohead", row: 0, col: 1, source_frame: 42 },
    ]
    const csv = toCsv(edited)
    expect(csv).toContain("Kid A")
    expect(csv).not.toContain("OK Computer")
  })
})

describe("toJson", () => {
  it("produces pretty-printed JSON array with all detection fields", () => {
    const json = toJson(sampleAlbums)
    const parsed = JSON.parse(json)
    expect(parsed).toEqual(sampleAlbums)
    expect(json).toContain("\n")
  })

  it("handles empty albums array", () => {
    const json = toJson([])
    expect(JSON.parse(json)).toEqual([])
  })

  it("reflects edits in exported data", () => {
    const edited: DetectedAlbum[] = [
      { title: "Kid A", artist: "Radiohead", row: 0, col: 1, source_frame: 42 },
    ]
    const json = toJson(edited)
    const parsed = JSON.parse(json)
    expect(parsed[0].title).toBe("Kid A")
  })
})

describe("downloadBlob", () => {
  it("creates blob, triggers download, and revokes URL", () => {
    const createObjectURL = vi.fn(() => "blob:mock")
    const revokeObjectURL = vi.fn()
    vi.stubGlobal("URL", { createObjectURL, revokeObjectURL })

    const clickSpy = vi.fn()
    const originalCreateElement = document.createElement.bind(document)
    vi.spyOn(document, "createElement").mockImplementation((tag: string) => {
      if (tag === "a") return { href: "", download: "", click: clickSpy } as unknown as HTMLAnchorElement
      return originalCreateElement(tag)
    })

    downloadBlob("test content", "test.csv", "text/csv")

    expect(createObjectURL).toHaveBeenCalledOnce()
    const blob = createObjectURL.mock.calls[0][0] as Blob
    expect(blob.type).toBe("text/csv")
    expect(clickSpy).toHaveBeenCalledOnce()
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:mock")

    vi.restoreAllMocks()
  })
})
