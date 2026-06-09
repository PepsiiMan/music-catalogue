import React from "react"
import { render, screen, fireEvent } from "@testing-library/react"
import { ToastProvider, useToast } from "../components/Toast"

function TestHarness() {
  const { toast } = useToast()
  return <button onClick={() => toast("Toast message")}>Show toast</button>
}

function renderWithProvider(ui: React.ReactElement) {
  return render(<ToastProvider>{ui}</ToastProvider>)
}

describe("Toast", () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("renders a toast message when toast() is called", () => {
    renderWithProvider(<TestHarness />)
    fireEvent.click(screen.getByRole("button", { name: /show toast/i }))

    expect(screen.getByText("Toast message")).toBeInTheDocument()
  })

  it("schedules auto-dismiss after 3 seconds", () => {
    const setTimeoutSpy = vi.spyOn(window, "setTimeout")
    renderWithProvider(<TestHarness />)
    fireEvent.click(screen.getByRole("button", { name: /show toast/i }))

    expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), 3000)
    setTimeoutSpy.mockRestore()
  })

  it("stacks multiple toasts", () => {
    function MultiToastHarness() {
      const { toast } = useToast()
      return (
        <>
          <button onClick={() => toast("First toast")}>Show first</button>
          <button onClick={() => toast("Second toast")}>Show second</button>
        </>
      )
    }
    renderWithProvider(<MultiToastHarness />)
    fireEvent.click(screen.getByRole("button", { name: /show first/i }))
    vi.advanceTimersByTime(1)
    fireEvent.click(screen.getByRole("button", { name: /show second/i }))

    expect(screen.getByText("First toast")).toBeInTheDocument()
    expect(screen.getByText("Second toast")).toBeInTheDocument()
  })

  it("throws when useToast is used outside ToastProvider", () => {
    function BadComponent() {
      useToast()
      return null
    }

    expect(() => render(<BadComponent />)).toThrow("useToast must be used within ToastProvider")
  })

  it("renders success variant with correct class", () => {
    function VariantHarness() {
      const { toast } = useToast()
      return <button onClick={() => toast("Success!", "success")}>Show success</button>
    }
    renderWithProvider(<VariantHarness />)
    fireEvent.click(screen.getByRole("button", { name: /show success/i }))

    const toastEl = screen.getByText("Success!").closest("div")
    expect(toastEl?.className).toContain("bg-green-800")
  })

  it("renders error variant with correct class", () => {
    function VariantHarness() {
      const { toast } = useToast()
      return <button onClick={() => toast("Error!", "error")}>Show error</button>
    }
    renderWithProvider(<VariantHarness />)
    fireEvent.click(screen.getByRole("button", { name: /show error/i }))

    const toastEl = screen.getByText("Error!").closest("div")
    expect(toastEl?.className).toContain("bg-red-800")
  })

  it("renders info variant with correct class", () => {
    function VariantHarness() {
      const { toast } = useToast()
      return <button onClick={() => toast("Info!", "info")}>Show info</button>
    }
    renderWithProvider(<VariantHarness />)
    fireEvent.click(screen.getByRole("button", { name: /show info/i }))

    const toastEl = screen.getByText("Info!").closest("div")
    expect(toastEl?.className).toContain("bg-gray-800")
  })
})
