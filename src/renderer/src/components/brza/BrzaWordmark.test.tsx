// @vitest-environment happy-dom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { BrzaWordmark } from './BrzaWordmark'

afterEach(cleanup)

describe('BrzaWordmark', () => {
  it('is named BrzA without a daughter and renders no daughter text', () => {
    const { container } = render(<BrzaWordmark />)
    expect(screen.getByLabelText('BrzA')).toBeTruthy()
    expect(container.querySelector('.brza-wordmark-daughter')).toBeNull()
  })

  it('is named after the daughter and hides the visual parts from the accessible name', () => {
    const { container } = render(<BrzaWordmark daughter="Studio" />)
    expect(screen.getByLabelText('BrzA Studio')).toBeTruthy()
    expect(container.querySelector('.brza-wordmark-daughter')?.getAttribute('aria-hidden')).toBe(
      'true'
    )
    expect(container.querySelector('.brza-wordmark-mother')?.getAttribute('aria-hidden')).toBe(
      'true'
    )
  })
})
