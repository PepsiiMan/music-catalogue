import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { SearchCard } from '../components/SearchCard'

const mockToast = vi.fn()

vi.mock('@tanstack/react-query', () => ({
  useQuery: () => ({ data: undefined }),
}))

vi.mock('motion/react', () => ({
  motion: { div: 'div' },
}))

vi.mock('../api/search', () => ({
  getCoverArt: vi.fn(),
}))

vi.mock('../components/Toast', () => ({
  useToast: () => ({ toast: mockToast }),
}))

beforeEach(() => {
  mockToast.mockClear()
})

describe('SearchCard', () => {
  const baseResult = {
    title: 'Test Album',
    artist: 'Test Artist',
    date: '2024-01-15',
    mbid: 'test-mbid',
  }

  const defaultOnAdd = async () => {}

  it('renders title and artist from result', () => {
    render(
      <SearchCard
        result={baseResult}
        onAdd={defaultOnAdd}
      />
    )
    expect(screen.getByText('Test Album')).toBeInTheDocument()
    expect(screen.getByText('Test Artist')).toBeInTheDocument()
    expect(screen.getByText('2024-01-15')).toBeInTheDocument()
  })

  it('has border styling matching AlbumCard', () => {
    const { container } = render(
      <SearchCard
        result={baseResult}
        onAdd={defaultOnAdd}
      />
    )
    const card = container.firstChild as HTMLElement
    expect(card).toHaveClass('border-gray-700')
  })

  it('shows spinner and disables button while adding', async () => {
    let resolveAdd!: () => void
    const addPromise = new Promise<void>(resolve => { resolveAdd = resolve })
    const onAdd = vi.fn().mockReturnValue(addPromise)

    render(
      <SearchCard
        result={baseResult}
        onAdd={onAdd}
      />
    )

    const button = screen.getByRole('button', { name: 'Add' })
    fireEvent.click(button)

    expect(button).toBeDisabled()

    const spinner = button.querySelector('svg.animate-spin')
    expect(spinner).toBeInTheDocument()

    resolveAdd()
    await waitFor(() => {
      expect(onAdd).toHaveBeenCalledTimes(1)
    })
  })

  it('shows success toast after album is added', async () => {
    let resolveAdd!: () => void
    const addPromise = new Promise<void>(resolve => { resolveAdd = resolve })
    const onAdd = vi.fn().mockReturnValue(addPromise)

    render(
      <SearchCard
        result={baseResult}
        onAdd={onAdd}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: 'Add' }))
    resolveAdd()

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith('Album added', 'success')
    })
  })

  it('calls onAdd with correct album data', async () => {
    const onAdd = vi.fn().mockResolvedValue(undefined)

    render(
      <SearchCard
        result={baseResult}
        onAdd={onAdd}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: 'Add' }))

    await waitFor(() => {
      expect(onAdd).toHaveBeenCalledWith({
        title: 'Test Album',
        artist: 'Test Artist',
        release: '2024-01-15',
        mbid: 'test-mbid',
      })
    })
  })

  it('shows RecordPlaceholder when no cover art', () => {
    const { container } = render(
      <SearchCard
        result={{ ...baseResult, mbid: undefined }}
        onAdd={defaultOnAdd}
      />
    )
    expect(container.querySelector('svg')).toBeInTheDocument()
  })
})
