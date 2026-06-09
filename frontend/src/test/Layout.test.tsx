import React from "react"
import { render, screen } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import { Layout } from "../components/Layout"

function renderWithRouter(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Layout><p>child content</p></Layout>
    </MemoryRouter>
  )
}

describe("Layout", () => {
  it("renders children", () => {
    renderWithRouter("/")
    expect(screen.getByText("child content")).toBeInTheDocument()
  })

  it("renders site title", () => {
    renderWithRouter("/")
    expect(screen.getByText(/batates' catalogue/i)).toBeInTheDocument()
  })

  it("renders nav links", () => {
    renderWithRouter("/")
    expect(screen.getAllByRole("link", { name: /home/i }).length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByRole("link", { name: /albums/i }).length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByRole("link", { name: /search/i }).length).toBeGreaterThanOrEqual(1)
  })

  it("applies active class to current route link", () => {
    renderWithRouter("/albums")
    const albumLinks = screen.getAllByRole("link", { name: /albums/i })
    albumLinks.forEach(link => {
      expect(link.className).toContain("text-white")
    })
  })

  it("applies inactive class to non-current route links", () => {
    renderWithRouter("/albums")
    const homeLinks = screen.getAllByRole("link", { name: /home/i })
    homeLinks.forEach(link => {
      expect(link.className).toContain("text-gray-400")
    })
  })

  it("uses responsive classes: desktop nav hidden by default, mobile nav hidden on md+", () => {
    renderWithRouter("/")
    const navs = document.querySelectorAll("nav")
    expect(navs.length).toBe(2)

    const desktopNav = navs[0]
    expect(desktopNav.className).toContain("hidden")
    expect(desktopNav.className).toContain("md:flex")

    const mobileNav = navs[1]
    expect(mobileNav.className).toContain("md:hidden")
  })
})
