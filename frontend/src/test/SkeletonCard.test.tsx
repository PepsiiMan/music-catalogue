import React from 'react'
import { render } from '@testing-library/react'
import { SkeletonCard } from '../components/SkeletonCard'

describe('SkeletonCard', () => {
  it('renders pulsing placeholder elements', () => {
    const { container } = render(<SkeletonCard />)
    expect(container.firstChild).toHaveClass('animate-pulse')
  })

  it('renders three inner skeleton elements', () => {
    const { container } = render(<SkeletonCard />)
    const children = container.firstChild?.childNodes
    expect(children).toHaveLength(3)
  })
})
