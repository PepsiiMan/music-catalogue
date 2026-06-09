import React from "react"
import { render, screen } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { AlbumsPage } from "../pages/AlbumsPage"
import { ToastProvider } from "../components/Toast"

const mockGetAlbums = vi.fn()

vi.mock("../api/albums", () => ({
  getAlbums: (...args: unknown[]) => mockGetAlbums(...args),
  createAlbum: vi.fn(),
  deleteAlbum: vi.fn(),
}))

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

describe("AlbumsPage", () => {
  beforeEach(() => {
    mockGetAlbums.mockReset()
  })

  it("shows skeleton cards while loading", () => {
    mockGetAlbums.mockReturnValue(new Promise(() => {}))
    const { container } = render(<AlbumsPage />, { wrapper: Wrapper })
    const skeletons = container.querySelectorAll(".animate-pulse")
    expect(skeletons.length).toBeGreaterThan(0)
    expect(screen.queryByText("Loading albums...")).not.toBeInTheDocument()
  })

  it("shows empty state when collection has no albums", async () => {
    mockGetAlbums.mockResolvedValue([])
    render(<AlbumsPage />, { wrapper: Wrapper })
    expect(await screen.findByText("Your collection is empty")).toBeInTheDocument()
    expect(screen.getByText(/Search for music/)).toBeInTheDocument()
  })
})
