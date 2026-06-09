import React from "react"
import { render, screen, fireEvent } from "@testing-library/react"
import { FilterWidget } from "../components/FilterWidget"
import type { AlbumFilters } from "../api/albums"

describe("FilterWidget", () => {
  it("toggles filter content when toggle button is clicked", () => {
    const onChange = vi.fn()
    const { container } = render(<FilterWidget filters={{}} onChange={onChange} />)

    const toggle = screen.getByRole("button", { name: /filters/i })
    expect(toggle).toBeInTheDocument()

    const filterContent = container.querySelector(".flex-wrap")
    expect(filterContent).toBeInTheDocument()

    fireEvent.click(toggle)

    expect(container.querySelector(".flex-wrap")).not.toBeInTheDocument()
  })

  it("shows badge with active filter count", () => {
    const onChange = vi.fn()
    const filters: AlbumFilters = {
      search: "test",
      sortBy: "title",
    }
    render(<FilterWidget filters={filters} onChange={onChange} />)

    const badge = screen.getByText("(2)")
    expect(badge).toBeInTheDocument()
  })

  it("shows no badge when no filters are active", () => {
    const onChange = vi.fn()
    render(<FilterWidget filters={{}} onChange={onChange} />)

    expect(screen.queryByText(/\(\d+\)/)).not.toBeInTheDocument()
  })
})
