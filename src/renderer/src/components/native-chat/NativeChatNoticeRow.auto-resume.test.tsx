// @vitest-environment happy-dom
import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { projectStructuredItemsToNativeChat } from '../../../../shared/agent-session/view/structured-agent-session-projection'
import type { AgentJournalStatusItem } from '../../../../shared/agent-session/journal/agent-session-journal-types'
import { TooltipProvider } from '@/components/ui/tooltip'
import { i18n } from '@/i18n/i18n'
import { agentSessionFailureWords } from '../../../../shared/agent-session/failures/agent-session-failure-words'
import { agentSessionFailureFact } from '../../../../shared/agent-session/failures/agent-session-failure'
import { MessageRow } from './NativeChatMessageRow'
import {
  NativeChatOrcaStopContext,
  type NativeChatOrcaStopView
} from './native-chat-orca-stop-context'

// BrzA: "Resume automatically" on a usage limit's row, beside the upstream's Continue Now and the
// account and agent hand-off actions. Split from NativeChatNoticeRow.test.tsx, at its line limit.
afterEach(async () => {
  cleanup()
  await i18n.changeLanguage('en')
})

const resetsAt = new Date(2026, 9, 18, 15, 0).getTime()
const limitRow: AgentJournalStatusItem = {
  kind: 'status',
  tone: 'warning',
  ...agentSessionFailureWords(
    agentSessionFailureFact('usageLimitReached', { usageLimit: { window: 'session', resetsAt } }),
    { agentName: 'Claude', surface: 'row' }
  )
}

function orcaStopView(view: Partial<NativeChatOrcaStopView>): NativeChatOrcaStopView {
  return {
    hostLabel: null,
    remoteHost: false,
    continueAvailable: false,
    offeredTurnItemId: null,
    continueNow: () => {},
    usageLimitTurnItemId: 'cut-turn',
    continueUsageLimit: () => {},
    ...view
  }
}

function renderLimitRow(view: Partial<NativeChatOrcaStopView>) {
  const [message] = projectStructuredItemsToNativeChat([
    {
      itemId: 'notice',
      sequence: 1,
      revision: 1,
      observedAt: 1,
      body: limitRow,
      turnScope: { kind: 'turn', turnItemId: 'cut-turn' }
    }
  ])
  const stop = orcaStopView(view)
  return render(
    <TooltipProvider>
      <NativeChatOrcaStopContext.Provider value={stop}>
        <MessageRow
          message={message!}
          agentName="Claude"
          expandSignal={false}
          onScrollMessageToTop={vi.fn()}
        />
      </NativeChatOrcaStopContext.Provider>
    </TooltipProvider>
  )
}

describe('the row a usage limit leaves, with Resume automatically', () => {
  it('offers Resume automatically on the limit row, then shows when and Cancel', () => {
    const autoResume = {
      turnItemId: 'cut-turn',
      resumeAt: null,
      plannedAt: resetsAt + 60_000,
      busy: false,
      schedule: vi.fn(),
      cancel: vi.fn()
    }
    const { unmount } = renderLimitRow({ usageLimitAutoResume: autoResume })
    fireEvent.click(screen.getByRole('button', { name: 'Resume automatically' }))
    expect(autoResume.schedule).toHaveBeenCalledTimes(1)
    unmount()

    vi.useFakeTimers({ now: new Date(2026, 9, 18, 12, 30), toFake: ['Date'] })
    renderLimitRow({ usageLimitAutoResume: { ...autoResume, resumeAt: resetsAt + 60_000 } })
    vi.useRealTimers()
    const clock = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(
      resetsAt + 60_000
    )
    expect(screen.getByText(`Resumes at ${clock}`)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Resume automatically' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(autoResume.cancel).toHaveBeenCalledTimes(1)
  })

  it('has no Resume automatically when the limit gave no reset time', () => {
    renderLimitRow({ usageLimitAutoResume: null })
    expect(screen.queryByRole('button', { name: 'Resume automatically' })).toBeNull()
  })
})
