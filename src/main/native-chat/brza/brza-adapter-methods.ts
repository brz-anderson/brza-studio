import type { AgentSessionAccountHome } from '../../../shared/agent-session/lifecycle/accounts/agent-session-account-home'
import type { AgentSessionRecord } from '../../../shared/agent-session/lifecycle/agent-session-record'

/** The BrzA methods of a structured adapter, split out of the upstream type, which sits at its
 *  line limit. */
export type BrzaStructuredAgentSessionAdapterMethods = {
  /** Ready another account for this chat (its folder, its transcripts) before the record moves to
   *  it; a refusal leaves the chat where it was. */
  prepareAccountSwitch?(input: {
    record: AgentSessionRecord
    accountId: string | null
  }): Promise<
    | { ok: true; accountHome: AgentSessionAccountHome; account: string }
    | { ok: false; reason: 'unknown-account' | 'setup-failed' }
  >
}
