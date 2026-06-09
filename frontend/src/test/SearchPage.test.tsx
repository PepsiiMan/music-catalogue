import React from "react"
import { render, screen } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { MemoryRouter } from "react-router-dom"
import { ToastProvider } from "../components/Toast"
import { SearchPage } from "../pages/SearchPage"

let mockSearchParams = new URLSearchParams()
const mockSetSearchParams = vi.fn()

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom")
  return {
    ...actual,
    useSearchParams: () => [mockSearchParams, mockSetSearchParams],
  }
})

const mockGetReleasesByTitle = vi.fn()

vi.mock("../api/search", () => ({
  getReleasesByTitle: (...args: unknown[]) => mockGetReleasesByTitle(...args),
  getReleasesByArtist: vi.fn(),
  getReleasesByTitleAndArtist: vi.fn(),
  getCoverArt: vi.fn(),
}))

vi.mock("../db/albums", () => ({
  createAlbum: vi.fn(),
}))

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <MemoryRouter>
        <QueryClientProvider client={queryClient}>
          <ToastProvider>{children}</ToastProvider>
        </QueryClientProvider>
      </MemoryRouter>
    )
  }
}

describe("SearchPage", () => {
  beforeEach(() => {
    mockSearchParams = new URLSearchParams()
    mockSetSearchParams.mockClear()
    mockGetReleasesByTitle.mockReset()
  })

  it("shows skeleton cards while loading", () => {
    mockSearchParams = new URLSearchParams({ title: "test" })
    mockGetReleasesByTitle.mockReturnValue(new Promise(() => {}))

    const { container } = render(<SearchPage />, { wrapper: createWrapper() })

    const skeletons = container.querySelectorAll(".animate-pulse")
    expect(skeletons.length).toBeGreaterThan(0)
    expect(screen.queryByText("Searching...")).not.toBeInTheDocument()
  })

  it("shows initial empty state before any search", () => {
    render(<SearchPage />, { wrapper: createWrapper() })

    expect(screen.getByText(/search for music/i)).toBeInTheDocument()
  })

  it("shows no results empty state when search returns zero results", async () => {
    mockSearchParams = new URLSearchParams({ title: "nonexistent" })
    mockGetReleasesByTitle.mockResolvedValue([])

    render(<SearchPage />, { wrapper: createWrapper() })

    expect(await screen.findByText(/no results found/i)).toBeInTheDocument()
  })

  it("renders search results", async () => {
    mockSearchParams = new URLSearchParams({ title: "test" })
    mockGetReleasesByTitle.mockResolvedValue([
      { title: "Album One", artist: "Artist A", date: "2024", mbid: "mbid-1" },
      { title: "Album Two", artist: "Artist B", date: "2023", mbid: "mbid-2" },
    ])

    render(<SearchPage />, { wrapper: createWrapper() })

    expect(await screen.findByText("Album One")).toBeInTheDocument()
    expect(screen.getByText("Album Two")).toBeInTheDocument()
  })

  it("shows error state when search fails", async () => {
    mockSearchParams = new URLSearchParams({ title: "test" })
    mockGetReleasesByTitle.mockRejectedValue(new Error("Network error"))

    render(<SearchPage />, { wrapper: createWrapper() })

    expect(await screen.findByText(/search failed/i)).toBeInTheDocument()
  })
})
