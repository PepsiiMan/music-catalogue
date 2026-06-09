import React from "react"
import { render, screen, fireEvent } from "@testing-library/react"
import { ErrorBoundary } from "../components/ErrorBoundary"

function Bomb() {
  throw new Error("Test crash")
}

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {})
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe("ErrorBoundary", () => {
  it("renders children when no error", () => {
    render(
      <ErrorBoundary>
        <p>all good</p>
      </ErrorBoundary>
    )

    expect(screen.getByText("all good")).toBeInTheDocument()
  })

  it("shows fallback when child throws", () => {
    render(
      <ErrorBoundary>
        <Bomb />
      </ErrorBoundary>
    )

    expect(screen.getByText(/something went wrong/i)).toBeInTheDocument()
    expect(screen.getByText(/test crash/i)).toBeInTheDocument()
  })

  it("shows custom fallback when provided", () => {
    render(
      <ErrorBoundary fallback={<p>custom error</p>}>
        <Bomb />
      </ErrorBoundary>
    )

    expect(screen.getByText("custom error")).toBeInTheDocument()
  })

  it("shows Try again button in fallback", () => {
    render(
      <ErrorBoundary>
        <Bomb />
      </ErrorBoundary>
    )

    expect(screen.getByRole("button", { name: /try again/i })).toBeInTheDocument()
  })

  it("resets error state when Try again is clicked and children no longer throw", () => {
    let shouldThrow = true
    function Bomb() {
      if (shouldThrow) throw new Error("oops")
      return <p>recovered</p>
    }

    render(
      <ErrorBoundary>
        <Bomb />
      </ErrorBoundary>
    )

    expect(screen.getByText(/something went wrong/i)).toBeInTheDocument()

    shouldThrow = false
    fireEvent.click(screen.getByRole("button", { name: /try again/i }))

    expect(screen.getByText("recovered")).toBeInTheDocument()
  })
})
