// @vitest-environment happy-dom
import '@testing-library/jest-dom/vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { BrzaContinueInOtherAccount } from './BrzaContinueInOtherAccount'
import type { NativeChatAccountSwitchView } from '../use-native-chat-account-switch'

afterEach(cleanup)

it('hides without another saved account', () => {
  const view: NativeChatAccountSwitchView = {
    current: { id: 'only', label: 'only@example.com' },
    choices: [
      { id: null, label: 'System default', disabled: false },
      { id: 'only', label: 'only@example.com', disabled: false }
    ],
    refresh: vi.fn(),
    switching: false,
    switchTo: vi.fn()
  }
  render(<BrzaContinueInOtherAccount view={view} onContinue={vi.fn()} />)
  expect(screen.queryByRole('button', { name: 'Continue in another account' })).toBeNull()
})

it('sends Continue only after switching accounts and never after a failed switch', async () => {
  let finishSwitch: (changed: boolean) => void = () => {}
  const switchTo = vi.fn(
    () =>
      new Promise<boolean>((resolve) => {
        finishSwitch = resolve
      })
  )
  const continueUsageLimit = vi.fn()
  const view: NativeChatAccountSwitchView = {
    current: { id: 'current', label: 'current@example.com' },
    choices: [
      { id: 'current', label: 'current@example.com', disabled: false },
      { id: 'other', label: 'other@example.com', disabled: false }
    ],
    refresh: vi.fn(),
    switching: false,
    switchTo
  }
  const { rerender } = render(
    <BrzaContinueInOtherAccount view={view} onContinue={continueUsageLimit} />
  )
  fireEvent.pointerDown(screen.getByRole('button', { name: 'Continue in another account' }), {
    button: 0,
    ctrlKey: false,
    pointerType: 'mouse'
  })
  fireEvent.click(screen.getByText('other@example.com'))
  expect(switchTo).toHaveBeenCalledWith('other')
  expect(continueUsageLimit).not.toHaveBeenCalled()
  await act(async () => finishSwitch(false))
  expect(continueUsageLimit).not.toHaveBeenCalled()

  rerender(<BrzaContinueInOtherAccount view={view} onContinue={continueUsageLimit} />)
  fireEvent.pointerDown(screen.getByRole('button', { name: 'Continue in another account' }), {
    button: 0,
    ctrlKey: false,
    pointerType: 'mouse'
  })
  fireEvent.click(screen.getByText('other@example.com'))
  expect(continueUsageLimit).not.toHaveBeenCalled()
  await act(async () => finishSwitch(true))
  expect(continueUsageLimit).toHaveBeenCalledOnce()
})
