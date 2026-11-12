// @vitest-environment happy-dom

import { cleanup, render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

const voice = vi.hoisted(() => ({
  dictationState: 'idle',
  settings: { voice: { enabled: true, sttModel: 'configured' } }
}))
vi.mock('../../../store', () => ({
  useAppStore: (selector: (state: typeof voice) => unknown) => selector(voice)
}))
vi.mock('../../dictation/dictation-control-events', () => ({ dispatchDictationControl: vi.fn() }))
vi.mock('@/i18n/i18n', () => ({
  translate: (_key: string, fallback: string) => fallback
}))
vi.mock('@/components/ui/button', () => ({
  Button: ({
    children,
    variant: _variant,
    size: _size,
    ...props
  }: {
    children: ReactNode
    variant?: string
    size?: string
  } & React.ButtonHTMLAttributes<HTMLButtonElement>) => <button {...props}>{children}</button>
}))
vi.mock('@/components/ui/tooltip', () => ({
  Tooltip: ({ children }: { children: ReactNode }) => <>{children}</>,
  TooltipTrigger: ({ children }: { children: ReactNode }) => <>{children}</>,
  TooltipContent: ({ children }: { children: ReactNode }) => <div>{children}</div>
}))
vi.mock('../session/options/controls/NativeChatSessionOptionPickers', () => ({
  NativeChatSessionOptionPickers: () => <div data-testid="session-option-pickers" />
}))

import { NativeChatComposerActions } from '../composer/controls/NativeChatComposerActions'

afterEach(cleanup)

describe('the composer Send and Stop (PLN-007)', () => {
  it.each([false, true])(
    'marks Send, and never Stop, for the brand gradient (working: %s)',
    (isWorking) => {
      render(
        <NativeChatComposerActions
          attachDisabled={false}
          dictationDisabled={false}
          sendDisabled={false}
          isWorking={isWorking}
          isDictating={false}
          isDictationHoldMode={false}
          onAttach={vi.fn()}
          onDictationToggle={vi.fn()}
          onDictationHoldStart={vi.fn()}
          onDictationHoldEnd={vi.fn()}
          onSend={vi.fn()}
          onStop={vi.fn()}
          sessionOptionsSurface={null}
          sessionOptionsSnapshot={[]}
        />
      )

      const button = screen.getByRole('button', { name: isWorking ? 'Stop the agent' : 'Send' })
      expect(button.hasAttribute('data-brza-send')).toBe(!isWorking)
    }
  )
})
