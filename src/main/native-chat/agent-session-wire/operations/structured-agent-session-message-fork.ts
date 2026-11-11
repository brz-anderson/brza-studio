import { parseAgentJournalItemKey } from '../../../../shared/agent-session/journal/agent-session-journal-item-key'
import type { AgentSessionMessageForkResult } from '../../../../shared/agent-session-message-fork'
import type { AgentSessionRecordStore } from '../../../runtime/agent-session/records/agent-session-record-store'
import type { StructuredAgentSessionAdapter } from '../providers/structured-agent-session-adapter'
import type { AgentJournalItemBody } from '../../../../shared/agent-session/journal/agent-session-journal-types'

/** What a fork reads of the host: the chat's record, its journal, and the adapter that copies. */
type ForkSourceHost = {
  deps: {
    store: Pick<AgentSessionRecordStore, 'getRecord'>
    adapter: Pick<StructuredAgentSessionAdapter, 'forkThroughMessage'>
  }
  journalSnapshot: (
    sessionId: string
  ) => Promise<{ items: readonly { itemId: string; body: AgentJournalItemBody }[] }>
}

/** Fork the chat's conversation through one agent message into a new provider session, for a new
 *  chat to resume; the chat and its conversation do not change. */
export async function forkStructuredAgentSessionThroughMessage(
  host: ForkSourceHost,
  input: { sessionId: string; itemId: string }
): Promise<AgentSessionMessageForkResult> {
  const record = host.deps.store.getRecord(input.sessionId)
  if (!record || !host.deps.adapter.forkThroughMessage) {
    return { ok: false, reason: 'unsupported' }
  }
  const snapshot = await host.journalSnapshot(input.sessionId)
  const body = snapshot.items.find((item) => item.itemId === input.itemId)?.body
  const message =
    body?.kind === 'message' && body.role === 'assistant'
      ? parseAgentJournalItemKey(input.itemId)
      : null
  if (message?.provider !== 'claude') {
    return { ok: false, reason: 'invalid-target' }
  }
  const forked = await host.deps.adapter.forkThroughMessage({
    record,
    message: { sessionId: message.sessionId, uuid: message.uuid }
  })
  return forked.ok && record.accountSwitch
    ? { ...forked, accountSwitch: { accountId: record.accountSwitch.accountId } }
    : forked
}
