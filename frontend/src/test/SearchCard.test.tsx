import React from "react"
import { render, screen, fireEvent } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { SearchCard } from "../components/SearchCard"
import type { SearchResult } from "../types"

const mockGetCoverArt = vi.fn()

vi.mock("../api/search", () => ({
  getCoverArt: (...args: unknown[]) => mockGetCoverArt(...args),
}))

function Wrapper({ children }: { children: React.ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}

const result: SearchResult = {
  mbid: "test-mbid",
  title: "Test Song",
  artist: "Test Performer",
  date: "2024",
}

describe("SearchCard", () => {
  beforeEach(() => {
    mockGetCoverArt.mockReset()
    mockGetCoverArt.mockResolvedValue(null)
  })

  it("renders title, artist, and date", () => {
    render(<SearchCard result={result} onAdd={vi.fn()} isAdding={false} />, { wrapper: Wrapper })

    expect(screen.getByText("Test Song")).toBeInTheDocument()
    expect(screen.getByText("Test Performer")).toBeInTheDocument()
    expect(screen.getByText("2024")).toBeInTheDocument()
  })

  it("renders Add button", () => {
    render(<SearchCard result={result} onAdd={vi.fn()} isAdding={false} />, { wrapper: Wrapper })

    expect(screen.getByRole("button", { name: /add/i })).toBeInTheDocument()
  })

  it("disables Add button when isAdding is true", () => {
    render(<SearchCard result={result} onAdd={vi.fn()} isAdding />, { wrapper: Wrapper })

    expect(screen.getByRole("button", { name: /adding/i })).toBeDisabled()
  })

  it("calls onAdd with album data when Add is clicked", () => {
    const onAdd = vi.fn()
    render(<SearchCard result={result} onAdd={onAdd} isAdding={false} />, { wrapper: Wrapper })

    fireEvent.click(screen.getByRole("button", { name: /add/i }))

    expect(onAdd).toHaveBeenCalledWith({
      title: "Test Song",
      artist: "Test Performer",
      release: "2024",
      mbid: "test-mbid",
    })
  })

  it("shows RecordPlaceholder when no cover art", () => {
    mockGetCoverArt.mockResolvedValue(null)
    const { container } = render(<SearchCard result={result} onAdd={vi.fn()} isAdding={false} />, { wrapper: Wrapper })

    expect(container.querySelector("svg")).toBeInTheDocument()
  })
})
