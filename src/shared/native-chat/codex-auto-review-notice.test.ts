import { expect, it } from 'vitest'
import type { AgentJournalRenderItem } from '../agent-session-journal-types'
import { projectStructuredItemToNativeChat } from '../structured-agent-session-projection'

function guardianWarning(text: string): AgentJournalRenderItem {
  return {
    itemId: text,
    sequence: 1,
    revision: 1,
    observedAt: 1,
    body: {
      kind: 'status',
      text,
      tone: 'warning',
      providerFrame: {
        provider: 'codex',
        kind: 'notification:guardianWarning',
        payload: { head: '{}', byteLength: 2, digest: 'digest', truncated: false }
      }
    }
  }
}

it('hides Codex auto-review approval confirmations but keeps other guardian warnings', () => {
  expect(
    projectStructuredItemToNativeChat(
      guardianWarning(
        'Automatic approval review approved (risk: low, authorization: high): Allowed.'
      )
    )
  ).toBeNull()
  expect(
    projectStructuredItemToNativeChat(
      guardianWarning('Automatic approval review rejected: Access denied.')
    )?.blocks
  ).toEqual([expect.objectContaining({ type: 'text', text: expect.stringContaining('rejected') })])
})
