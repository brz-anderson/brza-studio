// @vitest-environment happy-dom
import '@testing-library/jest-dom/vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import {
  BrzaContinueInOtherAccount,
  BrzaUsageLimitContinueInOtherAccount
} from './BrzaContinueInOtherAccount'
import { BrzaContinueAfterWorkLine } from './BrzaContinueAfterWorkLine'
import type { NativeChatAccountSwitchView } from '../use-native-chat-account-switch'

const row = vi.hoisted(() => {
  const state: { view: unknown; stop: unknown } = { view: null, stop: null }
  return state
})
vi.mock('../usage/NativeChatUsageLimitActions', () => ({
  useNativeChatUsageLimitContinueInOtherAccount: () => row.view
}))
vi.mock('../messages/notices/native-chat-orca-stop-context', () => ({
  useNativeChatOrcaStopView: () => row.stop
}))

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

it('says where the chat will continue while it waits, and Cancel drops the wait', () => {
  const cancel = vi.fn()
  render(
    <BrzaContinueAfterWorkLine
      status={{ turnItemId: 't', account: 'other@example.com', since: 1 }}
      onCancel={cancel}
    />
  )
  expect(
    screen.getByText('Will continue in other@example.com when the background task finishes')
  ).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
  expect(cancel).toHaveBeenCalledOnce()
})

it('says the wait ran out, and Dismiss clears it', () => {
  const cancel = vi.fn()
  render(
    <BrzaContinueAfterWorkLine
      status={{ turnItemId: 't', account: 'other@example.com', since: 1, expired: true }}
      onCancel={cancel}
    />
  )
  expect(
    screen.getByText(
      "The background task didn't finish within 30 minutes, so the chat didn't continue in other@example.com"
    )
  ).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }))
  expect(cancel).toHaveBeenCalledOnce()
})

// PLN-026 A4: the host holds the continue, so the scheduled automatic continue of that cut must not
// send it on the old account meanwhile.
it('drops the scheduled automatic continue when the host holds the continue', async () => {
  const continueUsageLimit = vi.fn()
  const cancelAutomatic = vi.fn()
  row.stop = { usageLimitTurnItemId: 'cut', usageLimitContinueDisabled: false, continueUsageLimit }
  row.view = {
    current: { id: 'current', label: 'current@example.com' },
    choices: [
      { id: 'current', label: 'current@example.com', disabled: false },
      { id: 'other', label: 'other@example.com', disabled: false }
    ],
    refresh: vi.fn(),
    switching: false,
    switchTo: async () => true,
    afterWork: { status: null, arm: async () => 'deferred', cancel: vi.fn() }
  }
  render(
    <BrzaUsageLimitContinueInOtherAccount
      autoContinue={{ kind: 'scheduled', resetsAt: 1, cancel: cancelAutomatic }}
    />
  )
  fireEvent.pointerDown(screen.getByRole('button', { name: 'Continue in another account' }), {
    button: 0,
    ctrlKey: false,
    pointerType: 'mouse'
  })
  await act(async () => {
    fireEvent.click(await screen.findByText('other@example.com'))
  })
  expect(cancelAutomatic).toHaveBeenCalledOnce()
  expect(continueUsageLimit).not.toHaveBeenCalled()
})
