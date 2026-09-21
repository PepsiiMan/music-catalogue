import {
  matchAlbums,
  MatchNetworkError,
  MatchServerError,
  MatchInvalidResponseError,
} from "../../api/importmatch"
import { api } from "../../api/client"
import { AxiosError } from "axios"

vi.mock("../../api/client", () => ({
  api: {
    post: vi.fn(),
  },
}))

const input = [
  { title: "OK Computer", artist: "Radiohead" },
  { title: "Blue Lines", artist: "Massive Attack" },
]

describe("matchAlbums", () => {
  it("posts the albums as JSON to /import/match and returns the typed MatchResponse", async () => {
    const result = {
      matches: [
        {
          input: input[0],
          best: { mbid: "a1", title: "OK Computer", artist: "Radiohead", date: "1997-05-21" },
          alternatives: [],
        },
        {
          input: input[1],
          best: null,
          alternatives: [],
          error: "musicbrainz_unavailable",
        },
      ],
    }
    vi.mocked(api.post).mockResolvedValue({ data: result })

    const actual = await matchAlbums(input)

    expect(actual).toEqual(result)
    expect(api.post).toHaveBeenCalledWith("/import/match", { albums: input })
  })

  it("throws MatchNetworkError when there is no response", async () => {
    vi.mocked(api.post).mockRejectedValue(new AxiosError("Network Error", undefined, undefined, undefined, undefined))

    await expect(matchAlbums(input)).rejects.toBeInstanceOf(MatchNetworkError)
  })

  it("throws MatchServerError on 5xx response", async () => {
    const error = new AxiosError("Server Error", undefined, undefined, undefined, {
      status: 500,
      data: {},
      statusText: "Internal Server Error",
      headers: {},
      config: {} as never,
    })
    vi.mocked(api.post).mockRejectedValue(error)

    await expect(matchAlbums(input)).rejects.toBeInstanceOf(MatchServerError)
  })

  it("throws MatchInvalidResponseError when the response does not match the backend shape", async () => {
    vi.mocked(api.post).mockResolvedValue({ data: { matches: "not-an-array" } })

    await expect(matchAlbums(input)).rejects.toBeInstanceOf(MatchInvalidResponseError)
  })
})
